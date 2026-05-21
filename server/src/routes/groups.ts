import { Router, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../index';
import { customAlphabet } from 'nanoid';

const router = Router();
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response) => {
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
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

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

router.get('/:id', [param('id').notEmpty()], async (req: AuthRequest, res: Response) => {
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

  if (!group) return res.status(404).json({ error: 'Group not found' });
  res.json(group);
});

router.post('/join', [body('code').trim().notEmpty()], async (req: AuthRequest, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const group = await prisma.group.findUnique({ where: { code: req.body.code } });
  if (!group) return res.status(404).json({ error: 'Invalid group code' });

  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.user!.id, groupId: group.id } },
  });

  if (existing) {
    if (existing.status === 'APPROVED') return res.status(400).json({ error: 'Already a member' });
    if (existing.status === 'PENDING') return res.status(400).json({ error: 'Join request pending' });
    if (existing.status === 'BANNED') return res.status(403).json({ error: 'You are banned from this group' });
  }

  const status = group.isPublic && !group.requireApproval ? 'APPROVED' : 'PENDING';
  const member = await prisma.groupMember.create({
    data: { userId: req.user!.id, groupId: group.id, status },
  });

  res.json({ group, member, status });
});

router.get('/:id/pending', async (req: AuthRequest, res: Response) => {
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.user!.id, groupId: req.params.id } },
  });
  if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const pending = await prisma.groupMember.findMany({
    where: { groupId: req.params.id, status: 'PENDING' },
    include: { user: { select: { id: true, name: true, avatar: true, email: true } } },
  });
  res.json(pending);
});

router.patch('/:id/members/:userId', async (req: AuthRequest, res: Response) => {
  const { action } = req.body;
  if (!['approve', 'ban'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  const myMember = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.user!.id, groupId: req.params.id } },
  });
  if (!myMember || !['OWNER', 'ADMIN'].includes(myMember.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const updated = await prisma.groupMember.update({
    where: { userId_groupId: { userId: req.params.userId, groupId: req.params.id } },
    data: { status: action === 'approve' ? 'APPROVED' : 'BANNED' },
  });

  res.json(updated);
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.user!.id, groupId: req.params.id } },
  });
  if (!member || member.role !== 'OWNER') return res.status(403).json({ error: 'Forbidden' });

  const { name, description, isPublic, requireApproval } = req.body;
  const group = await prisma.group.update({
    where: { id: req.params.id },
    data: { name, description, isPublic, requireApproval },
  });
  res.json(group);
});

router.delete('/:id/leave', async (req: AuthRequest, res: Response) => {
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.user!.id, groupId: req.params.id } },
  });
  if (!member) return res.status(404).json({ error: 'Not a member' });
  if (member.role === 'OWNER') return res.status(400).json({ error: 'Owner cannot leave. Transfer ownership first.' });

  await prisma.groupMember.delete({
    where: { userId_groupId: { userId: req.user!.id, groupId: req.params.id } },
  });
  res.json({ message: 'Left group' });
});

export default router;
