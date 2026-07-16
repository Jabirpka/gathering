import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../index';
import { getIO } from '../socket/index';

const router = Router();
router.use(authMiddleware);

// Get my profile
router.get('/me', (req: Request, res: Response) => {
  res.json(req.user);
});

// Update my profile (name, nickname, avatar, and v2 profile fields)
router.patch('/me', async (req: Request, res: Response) => {
  const { name, nickname, avatar, banner, username, dateOfBirth, bio, interests, favoriteSong, favoriteMovie, city, whoAreYou, whatCanYouDo, trust, lookingFor, wantToMeet, profileExtra, onboarded } = req.body;
  try {
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (nickname !== undefined) data.nickname = nickname;
    if (avatar !== undefined) data.avatar = avatar;
    if (banner !== undefined) data.banner = banner || null;
    if (username !== undefined) data.username = (typeof username === 'string' && username.trim()) ? username.trim() : null;
    if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth || null;
    if (bio !== undefined) data.bio = bio || null;
    if (interests !== undefined) data.interests = Array.isArray(interests) ? interests.slice(0, 20) : [];
    if (favoriteSong !== undefined) data.favoriteSong = favoriteSong || null;
    if (favoriteMovie !== undefined) data.favoriteMovie = favoriteMovie || null;
    if (city !== undefined) data.city = city || null;
    if (whoAreYou !== undefined) data.whoAreYou = whoAreYou || null;
    if (whatCanYouDo !== undefined) data.whatCanYouDo = whatCanYouDo || null;
    if (trust !== undefined) data.trust = trust || null;
    if (lookingFor !== undefined) data.lookingFor = lookingFor || null;
    if (wantToMeet !== undefined) data.wantToMeet = wantToMeet || null;
    if (profileExtra !== undefined) {
      // One JSON blob for the extended profile; cap its size so a client can't
      // stuff megabytes into the row.
      if (profileExtra !== null && (typeof profileExtra !== 'object' || Array.isArray(profileExtra))) {
        return res.status(400).json({ error: 'Invalid profile data' });
      }
      if (profileExtra && JSON.stringify(profileExtra).length > 100_000) {
        return res.status(400).json({ error: 'Profile data too large' });
      }
      data.profileExtra = profileExtra;
    }
    if (onboarded !== undefined) data.onboarded = !!onboarded;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
      select: {
        id: true, name: true, nickname: true, email: true, phone: true, avatar: true, banner: true,
        username: true, dateOfBirth: true, bio: true, interests: true,
        favoriteSong: true, favoriteMovie: true, city: true,
        whoAreYou: true, whatCanYouDo: true, trust: true, lookingFor: true, wantToMeet: true,
        profileExtra: true,
        onboarded: true,
      },
    });
    res.json(user);
  } catch (err: any) {
    // Unique-constraint violation on username
    if (err?.code === 'P2002') {
      return res.status(409).json({ error: 'That username is taken' });
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get my strike points (must be before /:id)
router.get('/me/strikes', async (req: Request, res: Response) => {
  try {
    const count = await prisma.poke.count({ where: { receiverId: req.user!.id } });
    res.json({ strikePoints: count });
  } catch {
    res.status(500).json({ error: 'Failed to fetch strikes' });
  }
});

// Match a list of phone contacts against registered users (People/Contacts
// screen). Compares by the last 10 digits so formatting differences don't
// matter. Only returns the contacts that are on Gathering — never other users.
router.post('/contacts', async (req: Request, res: Response) => {
  const phones: unknown = req.body?.phones;
  if (!Array.isArray(phones) || phones.length === 0) {
    res.json({ matches: [] });
    return;
  }
  const norm = (p: unknown) => String(p).replace(/\D/g, '').slice(-10);
  const wanted = new Set(phones.map(norm).filter((d) => d.length >= 7));
  if (wanted.size === 0) {
    res.json({ matches: [] });
    return;
  }
  const users = await prisma.user.findMany({
    where: { phone: { not: null }, id: { not: req.user!.id } },
    select: { id: true, name: true, nickname: true, avatar: true, phone: true, username: true },
  });
  const matches = users.filter((u) => u.phone && wanted.has(norm(u.phone)));
  res.json({ matches });
});

// Get a user's public profile by id (with strike/poke count). Email is
// intentionally omitted — it's private and only returned for /me.
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        nickname: true,
        avatar: true,
        banner: true,
        username: true,
        dateOfBirth: true,
        bio: true,
        interests: true,
        favoriteSong: true,
        favoriteMovie: true,
        city: true,
        whoAreYou: true,
        whatCanYouDo: true,
        trust: true,
        lookingFor: true,
        wantToMeet: true,
        profileExtra: true,
        createdAt: true,
        _count: { select: { pokesReceived: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Emergency contact / medical info is private — never shown to others.
    const { emergency: _emergency, ...publicExtra } = ((user.profileExtra as any) ?? {});
    res.json({ ...user, profileExtra: publicExtra, strikePoints: user._count.pokesReceived });
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Poke a user
router.post('/:id/poke', async (req: Request, res: Response) => {
  const receiverId = req.params.id;
  const senderId = req.user!.id;

  if (receiverId === senderId) {
    return res.status(400).json({ error: "You can't poke yourself" });
  }

  try {
    const poke = await prisma.poke.create({
      data: { senderId, receiverId },
      include: { sender: { select: { id: true, name: true, nickname: true, avatar: true } } },
    });

    // Count total strikes for receiver
    const strikePoints = await prisma.poke.count({ where: { receiverId } });

    // Emit real-time notification to receiver
    const io = getIO();
    io.to(`user:${receiverId}`).emit('notification', {
      type: 'poke',
      from: poke.sender,
      message: `${poke.sender.nickname || poke.sender.name} poked you! 👉`,
      strikePoints,
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true, strikePoints });
  } catch {
    res.status(500).json({ error: 'Failed to poke user' });
  }
});

export default router;
