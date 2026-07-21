import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../index';
import { getIO } from '../socket/index';

const router = Router();
router.use(authMiddleware);

const KINDS = ['PHOTO', 'NEWS', 'POLL', 'QUESTION', 'WRITEUP', 'EVENT', 'JOB_HUNT', 'JOB_FIND', 'INFO'];
const userSelect = { select: { id: true, name: true, nickname: true, avatar: true, username: true } } as const;
const messageInclude = {
  user: userSelect,
  replyTo: { select: { id: true, content: true, kind: true, deletedAt: true, user: { select: { name: true } } } },
  reactions: { select: { userId: true, emoji: true } },
} as const;

// EVENT posts reuse the poll-vote table for RSVPs with these fixed options.
const RSVP_OPTIONS = ['Going', 'Maybe', 'Not going'];
const usesVotes = (kind: string) => kind === 'POLL' || kind === 'EVENT';

function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
async function openDm(meId: string, otherId: string) {
  const [userAId, userBId] = orderPair(meId, otherId);
  return prisma.dmThread.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    update: {},
    create: { userAId, userBId },
  });
}
/** "Designation at Company" from a profileExtra work list. */
function topRole(profileExtra: any): string | null {
  const work = Array.isArray(profileExtra?.work) ? profileExtra.work : [];
  const w = work.find((x: any) => x?.current) ?? work[0];
  if (!w) return null;
  return [w.designation, w.company].filter(Boolean).join(' at ') || null;
}

/** Attach like/comment counts, my like, and poll/RSVP tallies to posts. */
async function decorate(posts: any[], myId: string) {
  const ids = posts.map((p) => p.id);
  if (ids.length === 0) return [];
  const [likes, myLikes, comments, votes, myVotes] = await Promise.all([
    prisma.postLike.groupBy({ by: ['postId'], where: { postId: { in: ids } }, _count: { _all: true } }),
    prisma.postLike.findMany({ where: { postId: { in: ids }, userId: myId }, select: { postId: true } }),
    prisma.postComment.groupBy({ by: ['postId'], where: { postId: { in: ids } }, _count: { _all: true } }),
    prisma.postPollVote.groupBy({ by: ['postId', 'optionIndex'], where: { postId: { in: ids } }, _count: { _all: true } }),
    prisma.postPollVote.findMany({ where: { postId: { in: ids }, userId: myId }, select: { postId: true, optionIndex: true } }),
  ]);
  const likeCount = new Map(likes.map((l) => [l.postId, l._count._all]));
  const commentCount = new Map(comments.map((c) => [c.postId, c._count._all]));
  const liked = new Set(myLikes.map((l) => l.postId));
  const myVote = new Map(myVotes.map((v) => [v.postId, v.optionIndex]));
  const tally = new Map<string, Record<number, number>>();
  votes.forEach((v) => {
    const t = tally.get(v.postId) ?? {};
    t[v.optionIndex] = v._count._all;
    tally.set(v.postId, t);
  });
  return posts.map((p) => ({
    ...p,
    likeCount: likeCount.get(p.id) ?? 0,
    commentCount: commentCount.get(p.id) ?? 0,
    likedByMe: liked.has(p.id),
    pollCounts: usesVotes(p.kind) ? (tally.get(p.id) ?? {}) : undefined,
    myVote: usesVotes(p.kind) ? (myVote.has(p.id) ? myVote.get(p.id) : null) : undefined,
  }));
}

router.get('/', async (req: Request, res: Response) => {
  const { cursor, category, kind } = req.query as Record<string, string | undefined>;
  const posts = await prisma.post.findMany({
    where: {
      ...(category && category !== 'All' ? { category } : {}),
      ...(kind ? { kind } : {}),
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: { user: userSelect },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json(await decorate(posts, req.user!.id));
});

// Single post (used when opening a shared post from a chat).
router.get('/:id', async (req: Request, res: Response) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id }, include: { user: userSelect } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json((await decorate([post], req.user!.id))[0]);
});

router.post('/', async (req: Request, res: Response) => {
  const { kind, category, title, content, image, extra } = req.body as Record<string, any>;
  if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Invalid post type' });
  if (!category || typeof category !== 'string') return res.status(400).json({ error: 'Pick a category' });
  const text = String(content ?? '').trim();
  if (!text && kind !== 'PHOTO') return res.status(400).json({ error: 'Write something first' });
  if (kind === 'PHOTO' && !image) return res.status(400).json({ error: 'Add a photo' });
  if (image && (typeof image !== 'string' || image.length > 4_000_000)) return res.status(400).json({ error: 'Invalid image' });
  if (kind === 'POLL') {
    const opts = Array.isArray(extra?.options) ? extra.options.map((o: any) => String(o).trim()).filter(Boolean) : [];
    if (opts.length < 2) return res.status(400).json({ error: 'A poll needs at least two options' });
    if (opts.length > 8) return res.status(400).json({ error: 'Max 8 options' });
  }
  if (extra && JSON.stringify(extra).length > 10_000) return res.status(400).json({ error: 'Post details too large' });

  const post = await prisma.post.create({
    data: {
      userId: req.user!.id, kind, category: category.slice(0, 40),
      title: title ? String(title).trim().slice(0, 200) : null,
      content: text.slice(0, 4000), image: image || null, extra: extra ?? undefined,
    },
    include: { user: userSelect },
  });

  // A new hiring post pings everyone who marked themselves available for hire.
  if (kind === 'JOB_FIND') {
    try {
      const seekers = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "User" WHERE id != ${req.user!.id} AND "profileExtra"->>'availableForHire' = 'true' LIMIT 500`;
      const io = getIO();
      const name = post.user.nickname || post.user.name;
      seekers.forEach((s) => io.to(`user:${s.id}`).emit('notification', {
        type: 'job',
        message: `${name} is hiring: "${post.title || 'a role'}" · ${post.category}`,
        link: '/feed',
        createdAt: new Date().toISOString(),
      }));
    } catch { /* best-effort */ }
  }

  res.status(201).json((await decorate([post], req.user!.id))[0]);
});

router.post('/:id/like', async (req: Request, res: Response) => {
  const postId = req.params.id;
  const existing = await prisma.postLike.findUnique({ where: { postId_userId: { postId, userId: req.user!.id } } });
  if (existing) await prisma.postLike.delete({ where: { id: existing.id } });
  else {
    try { await prisma.postLike.create({ data: { postId, userId: req.user!.id } }); }
    catch { return res.status(404).json({ error: 'Post not found' }); }
  }
  const count = await prisma.postLike.count({ where: { postId } });
  res.json({ liked: !existing, likeCount: count });
});

router.get('/:id/comments', async (req: Request, res: Response) => {
  const comments = await prisma.postComment.findMany({
    where: { postId: req.params.id }, include: { user: userSelect }, orderBy: { createdAt: 'asc' }, take: 100,
  });
  res.json(comments);
});

router.post('/:id/comments', async (req: Request, res: Response) => {
  const text = String(req.body?.content ?? '').trim();
  if (!text) return res.status(400).json({ error: 'Empty comment' });
  try {
    const comment = await prisma.postComment.create({
      data: { postId: req.params.id, userId: req.user!.id, content: text.slice(0, 500) }, include: { user: userSelect },
    });
    res.status(201).json(comment);
  } catch { res.status(404).json({ error: 'Post not found' }); }
});

// Poll vote / event RSVP — single choice; re-picking the same option clears it.
router.post('/:id/vote', async (req: Request, res: Response) => {
  const { optionIndex } = req.body as { optionIndex?: number };
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post || !usesVotes(post.kind)) return res.status(404).json({ error: 'Not found' });
  const opts = post.kind === 'EVENT' ? RSVP_OPTIONS : (((post.extra as any)?.options ?? []) as string[]);
  if (typeof optionIndex !== 'number' || optionIndex < 0 || optionIndex >= opts.length) {
    return res.status(400).json({ error: 'Invalid option' });
  }
  const existing = await prisma.postPollVote.findUnique({ where: { postId_userId: { postId: post.id, userId: req.user!.id } } });
  if (existing && existing.optionIndex === optionIndex) await prisma.postPollVote.delete({ where: { id: existing.id } });
  else if (existing) await prisma.postPollVote.update({ where: { id: existing.id }, data: { optionIndex } });
  else await prisma.postPollVote.create({ data: { postId: post.id, userId: req.user!.id, optionIndex } });
  res.json((await decorate([{ ...post, user: undefined }], req.user!.id))[0]);
});

// Apply to a hiring post: DMs the poster the applicant's profile card + pings them.
router.post('/:id/apply', async (req: Request, res: Response) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id }, include: { user: userSelect } });
  if (!post || post.kind !== 'JOB_FIND') return res.status(404).json({ error: 'Job not found' });
  if (post.userId === req.user!.id) return res.status(400).json({ error: "You can't apply to your own post" });
  const me = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, name: true, nickname: true, avatar: true, username: true, city: true, profileExtra: true },
  });
  if (!me) return res.status(404).json({ error: 'User not found' });

  const thread = await openDm(req.user!.id, post.userId);
  const content = JSON.stringify({
    userId: me.id,
    name: me.nickname || me.name,
    avatar: me.avatar,
    subtitle: `Applied for "${post.title || 'your post'}"`,
    headline: topRole(me.profileExtra) || me.city || (me.username ? `@${me.username}` : ''),
  });
  const message = await prisma.message.create({
    data: { content, kind: 'PROFILE', userId: req.user!.id, threadId: thread.id }, include: messageInclude,
  });
  getIO().to(`user:${post.userId}`).emit('dm:message', message);
  getIO().to(`user:${req.user!.id}`).emit('dm:message', message);
  getIO().to(`user:${post.userId}`).emit('notification', {
    type: 'apply',
    from: { id: me.id, name: me.name, nickname: me.nickname, avatar: me.avatar },
    message: `${me.nickname || me.name} applied for "${post.title || 'your job'}"`,
    link: `/dm/${thread.id}`,
    createdAt: new Date().toISOString(),
  });
  res.json({ threadId: thread.id });
});

// Share a post into a group, an existing DM thread, or to a person (opens a DM).
router.post('/:id/share', async (req: Request, res: Response) => {
  const { groupId, threadId, userId } = req.body as { groupId?: string; threadId?: string; userId?: string };
  const post = await prisma.post.findUnique({ where: { id: req.params.id }, include: { user: userSelect } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const content = JSON.stringify({
    postId: post.id, kind: post.kind, category: post.category, title: post.title,
    snippet: (post.content || '').slice(0, 140), image: post.image,
    authorName: post.user.nickname || post.user.name,
  });

  if (groupId) {
    const member = await prisma.groupMember.findUnique({ where: { userId_groupId: { userId: req.user!.id, groupId } } });
    if (!member || member.status !== 'APPROVED') return res.status(403).json({ error: 'Not a member' });
    const message = await prisma.message.create({ data: { content, kind: 'POST', userId: req.user!.id, groupId }, include: messageInclude });
    getIO().to(`group:${groupId}`).emit('chat:message', message);
    try {
      const others = await prisma.groupMember.findMany({ where: { groupId, status: 'APPROVED', userId: { not: req.user!.id } }, select: { userId: true } });
      const preview = { content: '📎 Shared a post', createdAt: message.createdAt, userId: message.userId, user: { name: message.user.name } };
      others.forEach((m) => getIO().to(`user:${m.userId}`).emit('chat:unread', { groupId, message: preview }));
    } catch {}
    return res.json({ ok: true });
  }

  const targetThreadId = threadId ?? (userId ? (await openDm(req.user!.id, userId)).id : null);
  if (!targetThreadId) return res.status(400).json({ error: 'Choose where to share' });
  const thread = await prisma.dmThread.findUnique({ where: { id: targetThreadId } });
  if (!thread || (thread.userAId !== req.user!.id && thread.userBId !== req.user!.id)) return res.status(403).json({ error: 'Not allowed' });
  const message = await prisma.message.create({ data: { content, kind: 'POST', userId: req.user!.id, threadId: thread.id }, include: messageInclude });
  getIO().to(`user:${thread.userAId}`).emit('dm:message', message);
  getIO().to(`user:${thread.userBId}`).emit('dm:message', message);
  return res.json({ ok: true, threadId: thread.id });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.userId !== req.user!.id) return res.status(403).json({ error: 'Not your post' });
  await prisma.post.delete({ where: { id: post.id } });
  res.json({ ok: true });
});

export default router;
