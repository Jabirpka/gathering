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

// Update my profile (name, nickname, avatar)
router.patch('/me', async (req: Request, res: Response) => {
  const { name, nickname, avatar } = req.body;
  try {
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (nickname !== undefined) data.nickname = nickname;
    if (avatar !== undefined) data.avatar = avatar;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data,
      select: { id: true, name: true, nickname: true, email: true, avatar: true },
    });
    res.json(user);
  } catch {
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
