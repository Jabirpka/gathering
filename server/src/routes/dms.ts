import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../index';

const router = Router();
router.use(authMiddleware);

/** Canonical pair order so each user pair maps to exactly one thread. */
function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Shape a thread for the client: the other participant + my unread state. */
function shapeThread(thread: any, myId: string) {
  const partner = thread.userAId === myId ? thread.userB : thread.userA;
  return {
    id: thread.id,
    partner: { id: partner.id, name: partner.name, nickname: partner.nickname, avatar: partner.avatar },
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
      const [unreadCount, lastMessage] = await Promise.all([
        prisma.message.count({
          where: {
            threadId: t.id,
            userId: { not: myId },
            ...(myLastRead ? { createdAt: { gt: myLastRead } } : {}),
          },
        }),
        prisma.message.findFirst({
          where: { threadId: t.id },
          orderBy: { createdAt: 'desc' },
          select: { content: true, createdAt: true, userId: true },
        }),
      ]);
      return { ...shapeThread(t, myId), unreadCount, lastMessage };
    })
  );

  res.json(shaped);
});

// Open (find or create) a DM thread with another user. Restricted to people
// who share at least one approved group with me, so strangers can't DM.
router.post('/open', async (req: Request, res: Response) => {
  const myId = req.user!.id;
  const { userId } = req.body as { userId?: string };
  if (!userId || userId === myId) {
    res.status(400).json({ error: 'Invalid userId' });
    return;
  }

  const sharesGroup = await prisma.groupMember.findFirst({
    where: {
      userId,
      status: 'APPROVED',
      group: { members: { some: { userId: myId, status: 'APPROVED' } } },
    },
  });
  if (!sharesGroup) {
    res.status(403).json({ error: 'You can only message people from your groups' });
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

// Mark my side of the thread read up to now.
router.post('/:id/read', async (req: Request, res: Response) => {
  const myId = req.user!.id;
  const thread = await prisma.dmThread.findUnique({ where: { id: req.params.id } });
  if (!thread || (thread.userAId !== myId && thread.userBId !== myId)) {
    res.status(404).json({ error: 'Thread not found' });
    return;
  }
  await prisma.dmThread.update({
    where: { id: thread.id },
    data: thread.userAId === myId ? { lastReadA: new Date() } : { lastReadB: new Date() },
  });
  res.json({ ok: true });
});

export default router;
