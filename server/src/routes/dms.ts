import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../index';
import { getIO } from '../socket/index';

const router = Router();
router.use(authMiddleware);

/** Canonical pair order so each user pair maps to exactly one thread. */
function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Shape a thread for the client: the other participant + my unread state.
 *  partnerLastReadAt powers the sender's ✓✓ read ticks. */
function shapeThread(thread: any, myId: string) {
  const isA = thread.userAId === myId;
  const partner = isA ? thread.userB : thread.userA;
  return {
    id: thread.id,
    partner: { id: partner.id, name: partner.name, nickname: partner.nickname, avatar: partner.avatar },
    partnerLastReadAt: isA ? thread.lastReadB : thread.lastReadA,
    updatedAt: thread.updatedAt,
    createdAt: thread.createdAt,
  };
}

// List my DM conversations with last message + unread count, like the
// group chats list.
router.get('/', async (req: Request, res: Response) => {
  const myId = req.user!.id;
  const threads = await prisma.dmThread.findMany({
    where: { OR: [{ userAId: myId }, { userBId: myId }] },
    include: {
      userA: { select: { id: true, name: true, nickname: true, avatar: true } },
      userB: { select: { id: true, name: true, nickname: true, avatar: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const shaped = await Promise.all(
    threads.map(async (t) => {
      const myLastRead = t.userAId === myId ? t.lastReadA : t.lastReadB;
      const myClearedAt = t.userAId === myId ? t.clearedAtA : t.clearedAtB;
      const [unreadCount, lastMessage] = await Promise.all([
        prisma.message.count({
          where: {
            threadId: t.id,
            userId: { not: myId },
            ...(myClearedAt ? { createdAt: { gt: myClearedAt } } : {}),
            ...(myLastRead ? { createdAt: { gt: myLastRead } } : {}),
          },
        }),
        prisma.message.findFirst({
          where: {
            threadId: t.id,
            ...(myClearedAt ? { createdAt: { gt: myClearedAt } } : {}),
          },
          orderBy: { createdAt: 'desc' },
          select: { content: true, kind: true, createdAt: true, userId: true },
        }),
      ]);
      const preview = lastMessage
        ? { ...lastMessage, content: lastMessage.kind === 'VOICE' ? '🎤 Voice message' : lastMessage.content }
        : null;
      return { ...shapeThread(t, myId), unreadCount, lastMessage: preview, cleared: !!myClearedAt && !lastMessage };
    })
  );

  // A chat I deleted stays hidden until someone sends something new.
  res.json(shaped.filter((t) => !t.cleared));
});

// Open (find or create) a DM thread with another registered user. Contacts-based
// app: you can message anyone on Gathering (e.g. a phone contact you found),
// not only people from your groups.
router.post('/open', async (req: Request, res: Response) => {
  const myId = req.user!.id;
  const { userId } = req.body as { userId?: string };
  if (!userId || userId === myId) {
    res.status(400).json({ error: 'Invalid userId' });
    return;
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const [userAId, userBId] = orderPair(myId, userId);
  const thread = await prisma.dmThread.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    update: {},
    create: { userAId, userBId },
    include: {
      userA: { select: { id: true, name: true, nickname: true, avatar: true } },
      userB: { select: { id: true, name: true, nickname: true, avatar: true } },
    },
  });

  res.json(shapeThread(thread, myId));
});

// Mark my side of the thread read up to now, and tell the partner live so
// their sent messages flip to ✓✓ read.
router.post('/:id/read', async (req: Request, res: Response) => {
  const myId = req.user!.id;
  const thread = await prisma.dmThread.findUnique({ where: { id: req.params.id } });
  if (!thread || (thread.userAId !== myId && thread.userBId !== myId)) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }
  const at = new Date();
  await prisma.dmThread.update({
    where: { id: thread.id },
    data: thread.userAId === myId ? { lastReadA: at } : { lastReadB: at },
  });
  const partnerId = thread.userAId === myId ? thread.userBId : thread.userAId;
  try {
    getIO().to(`user:${partnerId}`).emit('dm:read', { threadId: thread.id, at: at.toISOString() });
  } catch {}
  res.json({ ok: true });
});

// "Delete chat" — WhatsApp-style, my side only: hides the conversation and
// all current messages for me; the other person keeps their copy.
router.delete('/:id', async (req: Request, res: Response) => {
  const myId = req.user!.id;
  const thread = await prisma.dmThread.findUnique({ where: { id: req.params.id } });
  if (!thread || (thread.userAId !== myId && thread.userBId !== myId)) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }
  const at = new Date();
  await prisma.dmThread.update({
    where: { id: thread.id },
    data: thread.userAId === myId
      ? { clearedAtA: at, lastReadA: at }
      : { clearedAtB: at, lastReadB: at },
  });
  res.json({ ok: true });
});

// Search text messages within a conversation (my visible window only).
router.get('/:id/search', async (req: Request, res: Response) => {
  const myId = req.user!.id;
  const q = String(req.query.q ?? '').trim();
  if (!q) {
    res.json([]);
    return;
  }
  const thread = await prisma.dmThread.findUnique({ where: { id: req.params.id } });
  if (!thread || (thread.userAId !== myId && thread.userBId !== myId)) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }
  const myClearedAt = thread.userAId === myId ? thread.clearedAtA : thread.clearedAtB;
  const results = await prisma.message.findMany({
    where: {
      threadId: thread.id,
      kind: 'TEXT',
      deletedAt: null,
      content: { contains: q, mode: 'insensitive' },
      ...(myClearedAt ? { createdAt: { gt: myClearedAt } } : {}),
    },
    include: { user: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  res.json(results);
});

export default router;
