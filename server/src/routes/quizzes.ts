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

async function requireMember(userId: string, groupId: string) {
  const m = await prisma.groupMember.findUnique({ where: { userId_groupId: { userId, groupId } } });
  return !!m && m.status === 'APPROVED';
}

/** Shape a quiz for a viewer. The correct answer is only revealed once the
 *  viewer has answered (or the quiz has ended), so it stays a fair contest. */
function shapeQuiz(msg: any, answers: any[], myId: string) {
  const def = JSON.parse(msg.content);
  const counts: number[] = new Array(def.options.length).fill(0);
  let myAnswer: { optionIndex: number; correct: boolean; points: number } | null = null;
  for (const a of answers) {
    if (a.optionIndex >= 0 && a.optionIndex < counts.length) counts[a.optionIndex] += 1;
    if (a.userId === myId) myAnswer = { optionIndex: a.optionIndex, correct: a.correct, points: a.points };
  }
  const ended = !!def.endsAt && new Date(def.endsAt) < new Date();
  const reveal = !!myAnswer || ended;
  return {
    messageId: msg.id,
    question: def.question, options: def.options as string[], points: def.points,
    endsAt: def.endsAt || null,
    counts, totalAnswers: answers.length,
    myAnswer,
    correctIndex: reveal ? def.correctIndex : null,
    ended,
  };
}

router.post('/', async (req: Request, res: Response) => {
  const { groupId, question, options, correctIndex, points, endsAt } = req.body as any;
  if (!groupId || !question?.trim() || !Array.isArray(options)) { res.status(400).json({ error: 'Invalid quiz' }); return; }
  const opts = options.map((o: any) => String(o).trim()).filter(Boolean).slice(0, 8);
  if (opts.length < 2) { res.status(400).json({ error: 'Add at least two options' }); return; }
  if (typeof correctIndex !== 'number' || correctIndex < 0 || correctIndex >= opts.length) { res.status(400).json({ error: 'Pick the correct answer' }); return; }
  if (!(await requireMember(req.user!.id, groupId))) { res.status(403).json({ error: 'Not a member' }); return; }

  const content = JSON.stringify({
    question: String(question).trim().slice(0, 300),
    options: opts, correctIndex,
    points: Math.max(1, Math.min(100, Number(points) || 10)),
    endsAt: endsAt || null,
  });
  const message = await prisma.message.create({
    data: { content, kind: 'QUIZ', userId: req.user!.id, groupId },
    include: messageInclude,
  });
  getIO().to(`group:${groupId}`).emit('chat:message', message);
  try {
    const others = await prisma.groupMember.findMany({ where: { groupId, status: 'APPROVED', userId: { not: req.user!.id } }, select: { userId: true } });
    const preview = { content: '❓ Quiz', createdAt: message.createdAt, userId: message.userId, user: { name: message.user.name } };
    others.forEach((m) => getIO().to(`user:${m.userId}`).emit('chat:unread', { groupId, message: preview }));
  } catch {}
  res.status(201).json(message);
});

router.get('/:messageId', async (req: Request, res: Response) => {
  const msg = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!msg || msg.kind !== 'QUIZ' || !msg.groupId) { res.status(404).json({ error: 'Quiz not found' }); return; }
  if (!(await requireMember(req.user!.id, msg.groupId))) { res.status(403).json({ error: 'Not a member' }); return; }
  const answers = await prisma.quizAnswer.findMany({ where: { messageId: msg.id } });
  res.json(shapeQuiz(msg, answers, req.user!.id));
});

// Answer once — the first answer is final (it's a scored competition).
router.post('/:messageId/answer', async (req: Request, res: Response) => {
  const { optionIndex } = req.body as { optionIndex?: number };
  const msg = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!msg || msg.kind !== 'QUIZ' || !msg.groupId) { res.status(404).json({ error: 'Quiz not found' }); return; }
  const def = JSON.parse(msg.content);
  if (typeof optionIndex !== 'number' || optionIndex < 0 || optionIndex >= def.options.length) { res.status(400).json({ error: 'Invalid option' }); return; }
  if (def.endsAt && new Date(def.endsAt) < new Date()) { res.status(400).json({ error: 'This quiz has ended' }); return; }
  if (!(await requireMember(req.user!.id, msg.groupId))) { res.status(403).json({ error: 'Not a member' }); return; }

  const already = await prisma.quizAnswer.findUnique({ where: { messageId_userId: { messageId: msg.id, userId: req.user!.id } } });
  if (already) { res.status(400).json({ error: 'You already answered' }); return; }

  const correct = optionIndex === def.correctIndex;
  const points = correct ? def.points : 0;
  await prisma.quizAnswer.create({
    data: { messageId: msg.id, groupId: msg.groupId, userId: req.user!.id, optionIndex, correct, points },
  });
  const answers = await prisma.quizAnswer.findMany({ where: { messageId: msg.id } });
  const shaped = shapeQuiz(msg, answers, req.user!.id);
  getIO().to(`group:${msg.groupId}`).emit('quiz:update', { messageId: msg.id, groupId: msg.groupId, quiz: shaped });
  res.json(shaped);
});

// Per-group points table (the competition scoreboard).
router.get('/leaderboard/:groupId', async (req: Request, res: Response) => {
  const groupId = req.params.groupId;
  if (!(await requireMember(req.user!.id, groupId))) { res.status(403).json({ error: 'Not a member' }); return; }
  const rows = await prisma.quizAnswer.groupBy({
    by: ['userId'],
    where: { groupId },
    _sum: { points: true },
    _count: { _all: true },
  });
  const correctRows = await prisma.quizAnswer.groupBy({
    by: ['userId'],
    where: { groupId, correct: true },
    _count: { _all: true },
  });
  const correctByUser: Record<string, number> = {};
  correctRows.forEach((r) => { correctByUser[r.userId] = r._count._all; });

  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, name: true, nickname: true, avatar: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const table = rows
    .map((r) => {
      const u = userById.get(r.userId);
      return {
        userId: r.userId,
        name: u?.nickname || u?.name || 'Someone',
        avatar: u?.avatar ?? null,
        points: r._sum.points ?? 0,
        answered: r._count._all,
        correct: correctByUser[r.userId] ?? 0,
      };
    })
    .sort((a, b) => b.points - a.points || b.correct - a.correct);

  res.json(table);
});

export default router;
