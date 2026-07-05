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
  const { name, nickname, avatar, username, dateOfBirth, bio, interests, favoriteSong, favoriteMovie, city, onboarded } = req.body;
  try {
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (nickname !== undefined) data.nickname = nickname;
    if (avatar !== undefined) data.avatar = avatar;
    if (username !== undefined) data.username = (typeof username === 'string' && username.trim()) ? username.trim() : null;
    if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth || null;
    if (bio !== undefined) data.bio = bio || null;
    if (interests !== undefined) data.interests = Array.isArray(interests) ? interests.slice(0, 5) : [];
    if (favoriteSong !== undefined) data.favoriteSong = favoriteSong || null;
    if (favoriteMovie !== undefined) data.favoriteMovie = favoriteMovie || null;
    if (city !== undefined) data.city = city || null;
    if (onboarded !== undefined) data.onboarded = !!onboarded;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
      select: {
        id: true, name: true, nickname: true, email: true, avatar: true,
        username: true, dateOfBirth: true, bio: true, interests: true,
        favoriteSong: true, favoriteMovie: true, city: true, onboarded: true,
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

// Get user profile by id (with strike/poke count)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        avatar: true,
        createdAt: true,
        _count: { select: { pokesReceived: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ ...user, strikePoints: user._count.pokesReceived });
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
