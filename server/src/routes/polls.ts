import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../index';
import { getIO } from '../socket/index';

const router = Router();
router.use(authMiddleware);

const messageInclude = {
  user: { select: { id: true, name: true, avatar: true } },
  reactions: { select: { userId: true, emoji: true } },
} as const;

/** Aggregate a poll message's votes into tallies + who voted (unless hidden). */
function shapePoll(msg: any, votes: any[], myId: string) {
  const def = JSON.parse(msg.content);
  const counts: number[] = new Array(def.options.length).fill(0);
  const voters: Record<number, { id: string; name: string; avatar: string | null }[]> = {};
  const myVotes: number[] = [];
  for (const v of votes) {
    if (v.optionIndex < 0 || v.optionIndex >= def.options.length) continue;
    counts[v.optionIndex] += 1;
    if (!def.hideVoters) {
      (voters[v.optionIndex] ??= []).push({ id: v.user.id, name: v.user.nickname || v.user.name, avatar: v.user.avatar });
    }
    if (v.userId === myId) myVotes.push(v.optionIndex);
  }
  return {
    messageId: msg.id,
    question: def.question,
    options: def.options as string[],
    multiple: !!def.multiple,
    hideVoters: !!def.hideVoters,
    endsAt: def.endsAt || null,
    counts,
    voters,
    myVotes,
    totalVoters: new Set(votes.map((v) => v.userId)).size,
  };
}

async function requireMember(userId: string, groupId: string) {
  const m = await prisma.groupMember.findUnique({ where: { userId_groupId: { userId, groupId } } });
  return !!m && m.status === 'APPROVED';
}

// Create a poll — posted as a group-chat message (kind POLL, JSON content).
router.post('/', async (req: Request, res: Response) => {
  const { groupId, question, options, multiple, hideVoters, endsAt } = req.body as {
    groupId?: string; question?: string; options?: string[]; multiple?: boolean; hideVoters?: boolean; endsAt?: string | null;
  };
  if (!groupId || !question?.trim() || !Array.isArray(options)) {
    res.status(400).json({ error: 'Invalid poll' });
    return;
  }
  const opts = options.map((o) => String(o).trim()).filter(Boolean).slice(0, 12);
  if (opts.length < 2) {
    res.status(400).json({ error: 'Add at least two options' });
    return;
  }
  if (!(await requireMember(req.user!.id, groupId))) {
    res.status(403).json({ error: 'Not a member' });
    return;
  }

  const content = JSON.stringify({
    question: question.trim().slice(0, 300),
    options: opts,
    multiple: !!multiple,
    hideVoters: !!hideVoters,
    endsAt: endsAt || null,
  });
  const message = await prisma.message.create({
    data: { content, kind: 'POLL', userId: req.user!.id, groupId },
    include: messageInclude,
  });
  getIO().to(`group:${groupId}`).emit('chat:message', message);

  // Unread signal for the chats list, like a normal message.
  try {
    const others = await prisma.groupMember.findMany({
      where: { groupId, status: 'APPROVED', userId: { not: req.user!.id } },
      select: { userId: true },
    });
    const preview = { content: '📊 Poll', createdAt: message.createdAt, userId: message.userId, user: { name: message.user.name } };
    others.forEach((m) => getIO().to(`user:${m.userId}`).emit('chat:unread', { groupId, message: preview }));
  } catch {}

  res.status(201).json(message);
});

// Live tallies for a poll message.
router.get('/:messageId', async (req: Request, res: Response) => {
  const msg = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!msg || msg.kind !== 'POLL' || !msg.groupId) {
    res.status(404).json({ error: 'Poll not found' });
    return;
  }
  if (!(await requireMember(req.user!.id, msg.groupId))) {
    res.status(403).json({ error: 'Not a member' });
    return;
  }
  const votes = await prisma.pollVote.findMany({
    where: { messageId: msg.id },
    include: { user: { select: { id: true, name: true, nickname: true, avatar: true } } },
  });
  res.json(shapePoll(msg, votes, req.user!.id));
});

// Toggle my vote for an option (single- or multi-choice per the poll's setting).
router.post('/:messageId/vote', async (req: Request, res: Response) => {
  const { optionIndex } = req.body as { optionIndex?: number };
  const msg = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!msg || msg.kind !== 'POLL' || !msg.groupId) {
    res.status(404).json({ error: 'Poll not found' });
    return;
  }
  const def = JSON.parse(msg.content);
  if (typeof optionIndex !== 'number' || optionIndex < 0 || optionIndex >= def.options.length) {
    res.status(400).json({ error: 'Invalid option' });
    return;
  }
  if (def.endsAt && new Date(def.endsAt) < new Date()) {
    res.status(400).json({ error: 'This poll has ended' });
    return;
  }
  if (!(await requireMember(req.user!.id, msg.groupId))) {
    res.status(403).json({ error: 'Not a member' });
    return;
  }

  const existing = await prisma.pollVote.findUnique({
    where: { messageId_userId_optionIndex: { messageId: msg.id, userId: req.user!.id, optionIndex } },
  });
  if (existing) {
    await prisma.pollVote.delete({ where: { id: existing.id } });
  } else {
    if (!def.multiple) {
      await prisma.pollVote.deleteMany({ where: { messageId: msg.id, userId: req.user!.id } });
    }
    await prisma.pollVote.create({ data: { messageId: msg.id, userId: req.user!.id, optionIndex } });
  }

  const votes = await prisma.pollVote.findMany({
    where: { messageId: msg.id },
    include: { user: { select: { id: true, name: true, nickname: true, avatar: true } } },
  });
  const shaped = shapePoll(msg, votes, req.user!.id);
  getIO().to(`group:${msg.groupId}`).emit('poll:update', { messageId: msg.id, groupId: msg.groupId, poll: shaped });
  res.json(shaped);
});

export default router;
