import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../index';
import { customAlphabet } from 'nanoid';
import { getIO } from '../socket/index';

const router = Router();
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

router.use(authMiddleware);

router.get('/', async (req: Request, res: Response) => {
  const groups = await prisma.group.findMany({
    where: {
      members: { some: { userId: req.user!.id, status: 'APPROVED' } },
    },
    include: {
      creator: { select: { id: true, name: true, avatar: true } },
      members: {
        where: { status: 'APPROVED' },
        include: { user: { select: { id: true, name: true, avatar: true } } },
      },
      _count: { select: { members: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(groups);
});

router.post(
  '/',
  [
    body('name').trim().isLength({ min: 1, max: 60 }),
    body('description').optional().trim().isLength({ max: 300 }),
    body('isPublic').optional().isBoolean(),
    body('requireApproval').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const { name, description, isPublic = false, requireApproval = true } = req.body;
    const group = await prisma.group.create({
      data: {
        name,
        description,
        isPublic,
        requireApproval,
        code: nanoid(),
        creatorId: req.user!.id,
        members: {
          create: { userId: req.user!.id, role: 'OWNER', status: 'APPROVED' },
        },
        rooms: {
          create: [
            { name: 'General', type: 'VIDEO_CALL' },
            { name: 'Watch Party', type: 'VIDEO_WATCH' },
          ],
        },
      },
      include: {
        creator: { select: { id: true, name: true, avatar: true } },
        members: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
        rooms: true,
      },
    });
    res.status(201).json(group);
  }
);

router.get('/:id', async (req: Request, res: Response) => {
  const group = await prisma.group.findFirst({
    where: {
      id: req.params.id,
      members: { some: { userId: req.user!.id, status: 'APPROVED' } },
    },
    include: {
      creator: { select: { id: true, name: true, avatar: true } },
      members: {
        include: { user: { select: { id: true, name: true, avatar: true } } },
        orderBy: { joinedAt: 'asc' },
      },
      rooms: { where: { isActive: true } },
      scheduledEvents: { orderBy: { scheduledAt: 'asc' } },
    },
  });
  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }
  res.json(group);
});

router.post('/join', [body('code').trim().notEmpty()], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return;
  }
  const group = await prisma.group.findUnique({ where: { code: req.body.code } });
  if (!group) {
    res.status(404).json({ error: 'Invalid group code' });
    return;
  }
  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.user!.id, groupId: group.id } },
  });
  if (existing) {
    if (existing.status === 'APPROVED') { res.status(400).json({ error: 'Already a member' }); return; }
    if (existing.status === 'PENDING') { res.status(400).json({ error: 'Join request pending' }); return; }
    if (existing.status === 'BANNED') { res.status(403).json({ error: 'You are banned from this group' }); return; }
  }
  const status = group.isPublic && !group.requireApproval ? 'APPROVED' : 'PENDING';
  const member = await prisma.groupMember.create({
    data: { userId: req.user!.id, groupId: group.id, status },
  });
  res.json({ group, member, status });
});

router.get('/:id/pending', async (req: Request, res: Response) => {
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.user!.id, groupId: req.params.id } },
  });
  if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const pending = await prisma.groupMember.findMany({
    where: { groupId: req.params.id, status: 'PENDING' },
    include: { user: { select: { id: true, name: true, avatar: true, email: true } } },
  });
  res.json(pending);
});

router.patch('/:id/members/:userId', async (req: Request, res: Response) => {
  const { action } = req.body;
  if (!['approve', 'ban'].includes(action)) {
    res.status(400).json({ error: 'Invalid action' });
    return;
  }
  const myMember = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.user!.id, groupId: req.params.id } },
  });
  if (!myMember || !['OWNER', 'ADMIN'].includes(myMember.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const group = await prisma.group.findUnique({ where: { id: req.params.id }, select: { name: true } });
  const updated = await prisma.groupMember.update({
    where: { userId_groupId: { userId: req.params.userId, groupId: req.params.id } },
    data: { status: action === 'approve' ? 'APPROVED' : 'BANNED' },
  });

  // Notify the user
  try {
    const io = getIO();
    if (action === 'approve') {
      io.to(`user:${req.params.userId}`).emit('notification', {
        type: 'approved',
        message: `You were approved to join "${group?.name}" 🎉`,
        groupId: req.params.id,
        createdAt: new Date().toISOString(),
      });
    }
  } catch {}

  res.json(updated);
});

router.patch('/:id', async (req: Request, res: Response) => {
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.user!.id, groupId: req.params.id } },
  });
  if (!member || member.role !== 'OWNER') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const { name, description, isPublic, requireApproval, avatar } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (isPublic !== undefined) data.isPublic = isPublic;
  if (requireApproval !== undefined) data.requireApproval = requireApproval;
  if (avatar !== undefined) data.avatar = avatar;
  const group = await prisma.group.update({ where: { id: req.params.id }, data });
  res.json(group);
});

router.delete('/:id/leave', async (req: Request, res: Response) => {
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.user!.id, groupId: req.params.id } },
  });
  if (!member) {
    res.status(404).json({ error: 'Not a member' });
    return;
  }
  if (member.role === 'OWNER') {
    res.status(400).json({ error: 'Owner cannot leave. Transfer ownership first.' });
    return;
  }
  await prisma.groupMember.delete({
    where: { userId_groupId: { userId: req.user!.id, groupId: req.params.id } },
  });
  res.json({ message: 'Left group' });
});

export default router;
