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

// Who viewed my profile (last 30 days, latest visit per person).
router.get('/me/visitors', async (req: Request, res: Response) => {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const visits = await prisma.profileVisit.findMany({
    where: { profileId: req.user!.id, createdAt: { gt: since } },
    include: { visitor: { select: { id: true, name: true, nickname: true, avatar: true, username: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const seen = new Set<string>();
  const visitors = visits
    .filter((v) => (seen.has(v.visitorId) ? false : (seen.add(v.visitorId), true)))
    .slice(0, 20)
    .map((v) => ({ user: v.visitor, at: v.createdAt }));
  res.json({ total: visits.length, visitors });
});

// People search for Discover: name, @username, city, interests, and anything
// in the extended profile (skills, job, industry…).
router.get('/search', async (req: Request, res: Response) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) {
    res.json([]);
    return;
  }
  const like = `%${q}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User"
    WHERE id != ${req.user!.id} AND (
      name ILIKE ${like}
      OR username ILIKE ${like}
      OR city ILIKE ${like}
      OR array_to_string(interests, ' ') ILIKE ${like}
      OR COALESCE("profileExtra"::text, '') ILIKE ${like}
    )
    LIMIT 20`;
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    select: { id: true, name: true, nickname: true, avatar: true, username: true, city: true, profileExtra: true },
  });
  res.json(users.map(publicPersonCard));
});

// "Available for hire" directory for Discover's People tab.
router.get('/hire', async (req: Request, res: Response) => {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User"
    WHERE id != ${req.user!.id} AND "profileExtra"->>'availableForHire' = 'true'
    ORDER BY "updatedAt" DESC
    LIMIT 50`;
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.id) } },
    select: { id: true, name: true, nickname: true, avatar: true, username: true, city: true, profileExtra: true },
  });
  // Respect privacy: someone whose career section is hidden isn't listed.
  res.json(users.filter((u) => ((u.profileExtra as any)?.privacy?.career ?? 'everyone') === 'everyone').map(publicPersonCard));
});

/** Small public card for search/hire lists — never leaks the raw extra blob. */
function publicPersonCard(u: { id: string; name: string; nickname: string | null; avatar: string | null; username: string | null; city: string | null; profileExtra: any }) {
  const x = (u.profileExtra as any) ?? {};
  const careerPublic = (x.privacy?.career ?? 'everyone') === 'everyone';
  return {
    id: u.id,
    name: u.name,
    nickname: u.nickname,
    avatar: u.avatar,
    username: u.username,
    city: u.city,
    currentJob: careerPublic ? (x.currentJob ?? null) : null,
    industry: careerPublic ? (x.industry ?? null) : null,
    availableForHire: careerPublic ? !!x.availableForHire : false,
  };
}

// Which profileExtra keys belong to which section — mirrors the client's
// profileSchema so per-section privacy can be enforced server-side.
const SECTION_KEYS: Record<string, string[]> = {
  about: ['gender', 'languages', 'nationality', 'country', 'religion', 'maritalStatus'],
  education: ['school', 'college', 'degree', 'certifications', 'courses'],
  career: ['currentJob', 'company', 'industry', 'experienceYears', 'resumeLink', 'portfolio', 'availableForHire'],
  personality: ['strength', 'threeWords', 'lifeGoal', 'values', 'personalityType', 'socialType', 'quote'],
  skills: ['skills'],
  lifestyle: ['smoke', 'drink', 'workout', 'food', 'sleep', 'pets', 'children'],
  achievements: ['achievements'],
  socials: ['instagram', 'facebook', 'linkedin', 'github', 'x', 'youtube', 'website'],
  hobbies: ['hobbies'],
  favorites: ['favMovie', 'favBook', 'favSong', 'favFood', 'favActor', 'favSport', 'favDestination', 'favColor'],
};

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

// Get a user's public profile by id (with strike/poke count). Email/phone
// values stay private — only verified booleans go out. Per-section privacy
// (everyone / my groups / only me) is enforced here, and the visit is recorded
// for the owner's "who viewed" card.
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
        email: true,
        phone: true,
        profileExtra: true,
        createdAt: true,
        _count: { select: { pokesReceived: true } },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isSelf = user.id === req.user!.id;
    const extra = ((user.profileExtra as any) ?? {}) as Record<string, any>;
    const privacy = (extra.privacy ?? {}) as Record<string, string>;

    // 'groups' visibility means "people who share an approved group with me".
    let sharesGroup = isSelf;
    if (!isSelf && Object.values(privacy).includes('groups')) {
      sharesGroup = !!(await prisma.groupMember.findFirst({
        where: {
          userId: user.id,
          status: 'APPROVED',
          group: { members: { some: { userId: req.user!.id, status: 'APPROVED' } } },
        },
      }));
    }

    const publicExtra: Record<string, any> = { ...extra };
    delete publicExtra.privacy;
    if (!isSelf) {
      for (const [section, keys] of Object.entries(SECTION_KEYS)) {
        const level = privacy[section] ?? 'everyone';
        if (level === 'me' || (level === 'groups' && !sharesGroup)) {
          keys.forEach((k) => delete publicExtra[k]);
        }
      }
      // Emergency contact / medical info is never shown to anyone else.
      ['emergencyContact', 'bloodGroup', 'medicalNotes'].forEach((k) => delete publicExtra[k]);
    }

    // Record the visit (max one per visitor per 6h) and ping the owner.
    if (!isSelf) {
      const recent = await prisma.profileVisit.findFirst({
        where: { profileId: user.id, visitorId: req.user!.id, createdAt: { gt: new Date(Date.now() - 6 * 3600 * 1000) } },
      });
      if (!recent) {
        prisma.profileVisit.create({ data: { profileId: user.id, visitorId: req.user!.id } }).catch(() => {});
        try {
          getIO().to(`user:${user.id}`).emit('notification', {
            type: 'visit',
            from: { id: req.user!.id, name: req.user!.name, nickname: (req.user as any).nickname, avatar: req.user!.avatar },
            message: `${(req.user as any).nickname || req.user!.name} viewed your profile 👀`,
            createdAt: new Date().toISOString(),
          });
        } catch {}
      }
    }

    const { email, phone, ...rest } = user;
    res.json({
      ...rest,
      profileExtra: publicExtra,
      emailVerified: !!email,
      phoneVerified: !!phone,
      strikePoints: user._count.pokesReceived,
    });
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
