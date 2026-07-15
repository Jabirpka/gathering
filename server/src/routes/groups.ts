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
            kind: true,
            createdAt: true,
            userId: true,
            user: { select: { name: true, nickname: true } },
          },
        }),
      ]);
      // Voice notes are data URLs — swap in a short label for the preview.
      const preview = lastMessage
        ? {
            ...lastMessage,
            content:
              lastMessage.kind === 'VOICE' ? '🎤 Voice message'
              : lastMessage.kind === 'POLL' ? '📊 Poll'
              : lastMessage.kind === 'EVENT' ? '📅 Event'
              : lastMessage.kind === 'QUIZ' ? '❓ Quiz'
              : lastMessage.content,
          }
        : null;
      return { ...g, unreadCount, lastMessage: preview };
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
    const { name, description, category, isPublic = false, requireApproval = true } = req.body;
    const group = await prisma.group.create({
      data: {
        name,
        description,
        category: category || null,
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

// Discover public groups to browse & join. Optional text search (q) and
// category filter. Returns member counts + my membership status so the client
// can show "Join" / "Requested" / "Open". Defined before "/:id" so the literal
// path isn't captured as an id.
router.get('/discover', async (req: Request, res: Response) => {
  const q = String(req.query.q ?? '').trim();
  const category = String(req.query.category ?? '').trim();

  const where: any = { isPublic: true };
  if (category && category !== 'All') where.category = category;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];
  }

  const groups = await prisma.group.findMany({
    where,
    include: {
      creator: { select: { id: true, name: true, avatar: true } },
      _count: { select: { members: true } },
      members: { where: { userId: req.user!.id }, select: { status: true } },
    },
    orderBy: { members: { _count: 'desc' } },
    take: 60,
  });

  const shaped = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    avatar: g.avatar,
    category: g.category,
    isPublic: g.isPublic,
    requireApproval: g.requireApproval,
    creator: g.creator,
    memberCount: g._count.members,
    myStatus: g.members[0]?.status ?? null,
  }));
  res.json(shaped);
});

// Join a public group directly by id (from Discover). Private groups still
// require an invite code (see POST /join).
router.post('/:id/join', async (req: Request, res: Response) => {
  const group = await prisma.group.findUnique({ where: { id: req.params.id } });
  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }
  if (!group.isPublic) {
    res.status(403).json({ error: 'This group is private — you need an invite code' });
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
  const status = group.requireApproval ? 'PENDING' : 'APPROVED';
  const member = await prisma.groupMember.create({
    data: { userId: req.user!.id, groupId: group.id, status },
  });
  res.json({ group, member, status });
});

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
  const { name, description, category, isPublic, requireApproval, avatar } = req.body;
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (category !== undefined) data.category = category || null;
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

// Search text messages in the group chat.
router.get('/:id/messages/search', async (req: Request, res: Response) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) {
    res.json([]);
    return;
  }
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.user!.id, groupId: req.params.id } },
  });
  if (!member || member.status !== 'APPROVED') {
    res.status(403).json({ error: 'Not a member' });
    return;
  }
  const results = await prisma.message.findMany({
    where: {
      groupId: req.params.id,
      roomId: null,
      kind: 'TEXT',
      deletedAt: null,
      content: { contains: q, mode: 'insensitive' },
    },
    include: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  res.json(results);
});

// WhatsApp-style call buttons: each group lazily gets one video and one voice
// call room. Tapping 📹/📞 resolves (or creates) the room of that type and the
// client navigates into it, which triggers the normal ring flow.
router.post('/:id/call/:type', async (req: Request, res: Response) => {
  const groupId = req.params.id;
  const type = req.params.type === 'audio' ? 'AUDIO_CALL' : 'VIDEO_CALL';

  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.user!.id, groupId } },
  });
  if (!member || member.status !== 'APPROVED') {
    res.status(403).json({ error: 'Not a member' });
    return;
  }

  let room = await prisma.room.findFirst({ where: { groupId, type } });
  if (!room) {
    room = await prisma.room.create({
      data: { groupId, type, name: type === 'AUDIO_CALL' ? 'Voice call' : 'Video call' },
    });
  }
  res.json(room);
});

// Mark this group's chat as read up to now for the current user, and tell the
// group live so senders' ✓✓ ticks update.
router.post('/:id/read', async (req: Request, res: Response) => {
  const at = new Date();
  await prisma.groupMember.updateMany({
    where: { userId: req.user!.id, groupId: req.params.id },
    data: { lastReadAt: at },
  });
  try {
    getIO().to(`group:${req.params.id}`).emit('group:read', {
      groupId: req.params.id,
      userId: req.user!.id,
      at: at.toISOString(),
    });
  } catch {}
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

// Permanently delete the entire group (owner only). Message doesn't cascade
// from Group, so clear it explicitly before deleting the group, which then
// cascade-removes its rooms and memberships.
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
    prisma.group.delete({ where: { id: groupId } }),
  ]);

  res.json({ message: 'Group deleted' });
});

export default router;
