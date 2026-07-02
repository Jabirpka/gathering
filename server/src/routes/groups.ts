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

  // For the WhatsApp-style chats list: attach each group's unread count
  // (group-chat messages since this user's lastReadAt) and a last-message
  // preview so the client can sort and render conversation rows.
  const withUnread = await Promise.all(
    groups.map(async (g) => {
      const mine = g.members.find((m) => m.userId === req.user!.id);
      const [unreadCount, lastMessage] = await Promise.all([
        prisma.message.count({
          where: {
            groupId: g.id,
            roomId: null,
            userId: { not: req.user!.id },
            ...(mine?.lastReadAt ? { createdAt: { gt: mine.lastReadAt } } : {}),
          },
        }),
        prisma.message.findFirst({
          where: { groupId: g.id, roomId: null },
          orderBy: { createdAt: 'desc' },
          select: {
            content: true,
            createdAt: true,
            userId: true,
            user: { select: { name: true, nickname: true } },
          },
        }),
      ]);
      return { ...g, unreadCount, lastMessage };
    })
  );

  res.json(withUnread);
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
    res.status(400).json({ error: 'Owner cannot leave. Transfer ownership or delete the group.' });
    return;
  }
  await prisma.groupMember.delete({
    where: { userId_groupId: { userId: req.user!.id, groupId: req.params.id } },
  });
  res.json({ message: 'Left group' });
});

// Mark this group's chat as read up to now for the current user.
router.post('/:id/read', async (req: Request, res: Response) => {
  await prisma.groupMember.updateMany({
    where: { userId: req.user!.id, groupId: req.params.id },
    data: { lastReadAt: new Date() },
  });
  res.json({ ok: true });
});

// Hand the group over to another member. The previous owner is demoted to ADMIN
// so they keep elevated access without owning the group.
router.post('/:id/transfer', async (req: Request, res: Response) => {
  const groupId = req.params.id;
  const { userId } = req.body as { userId?: string };
  if (!userId) {
    res.status(400).json({ error: 'Missing userId' });
    return;
  }

  const me = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.user!.id, groupId } },
  });
  if (!me || me.role !== 'OWNER') {
    res.status(403).json({ error: 'Only the owner can transfer ownership' });
    return;
  }
  if (userId === req.user!.id) {
    res.status(400).json({ error: 'You already own this group' });
    return;
  }

  const target = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!target || target.status !== 'APPROVED') {
    res.status(400).json({ error: 'New owner must be an approved member' });
    return;
  }

  await prisma.$transaction([
    prisma.groupMember.update({
      where: { userId_groupId: { userId: req.user!.id, groupId } },
      data: { role: 'ADMIN' },
    }),
    prisma.groupMember.update({
      where: { userId_groupId: { userId, groupId } },
      data: { role: 'OWNER' },
    }),
  ]);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      creator: { select: { id: true, name: true, avatar: true } },
      members: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      rooms: true,
    },
  });
  res.json(group);
});

// Permanently delete the entire group (owner only). ScheduledEvent and Message
// don't cascade from Group, so clear them explicitly before deleting the group,
// which then cascade-removes its rooms and memberships.
router.delete('/:id', async (req: Request, res: Response) => {
  const groupId = req.params.id;
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.user!.id, groupId } },
  });
  if (!member || member.role !== 'OWNER') {
    res.status(403).json({ error: 'Only the owner can delete this group' });
    return;
  }

  await prisma.$transaction([
    prisma.message.deleteMany({ where: { groupId } }),
    prisma.scheduledEvent.deleteMany({ where: { groupId } }),
    prisma.group.delete({ where: { id: groupId } }),
  ]);

  res.json({ message: 'Group deleted' });
});

export default router;
