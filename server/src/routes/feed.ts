import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../index';

const router = Router();
router.use(authMiddleware);

const KINDS = ['PHOTO', 'NEWS', 'POLL', 'QUESTION', 'WRITEUP', 'EVENT', 'JOB_HUNT', 'JOB_FIND', 'INFO'];
const userSelect = { select: { id: true, name: true, nickname: true, avatar: true, username: true } } as const;

/** Attach like/comment counts, my like, and poll tallies to a page of posts. */
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
    pollCounts: p.kind === 'POLL' ? (tally.get(p.id) ?? {}) : undefined,
    myVote: p.kind === 'POLL' ? (myVote.has(p.id) ? myVote.get(p.id) : null) : undefined,
  }));
}

// Feed page: newest first, cursor pagination, optional category/kind filters.
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

// Create a post. Images should arrive as /api/media URLs (uploaded first).
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
      userId: req.user!.id,
      kind,
      category: category.slice(0, 40),
      title: title ? String(title).trim().slice(0, 200) : null,
      content: text.slice(0, 4000),
      image: image || null,
      extra: extra ?? undefined,
    },
    include: { user: userSelect },
  });
  res.status(201).json((await decorate([post], req.user!.id))[0]);
});

// Toggle like.
router.post('/:id/like', async (req: Request, res: Response) => {
  const postId = req.params.id;
  const existing = await prisma.postLike.findUnique({
    where: { postId_userId: { postId, userId: req.user!.id } },
  });
  if (existing) await prisma.postLike.delete({ where: { id: existing.id } });
  else {
    try {
      await prisma.postLike.create({ data: { postId, userId: req.user!.id } });
    } catch {
      return res.status(404).json({ error: 'Post not found' });
    }
  }
  const count = await prisma.postLike.count({ where: { postId } });
  res.json({ liked: !existing, likeCount: count });
});

// Comments (answers, for QUESTION posts).
router.get('/:id/comments', async (req: Request, res: Response) => {
  const comments = await prisma.postComment.findMany({
    where: { postId: req.params.id },
    include: { user: userSelect },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  res.json(comments);
});

router.post('/:id/comments', async (req: Request, res: Response) => {
  const text = String(req.body?.content ?? '').trim();
  if (!text) return res.status(400).json({ error: 'Empty comment' });
  try {
    const comment = await prisma.postComment.create({
      data: { postId: req.params.id, userId: req.user!.id, content: text.slice(0, 500) },
      include: { user: userSelect },
    });
    res.status(201).json(comment);
  } catch {
    res.status(404).json({ error: 'Post not found' });
  }
});

// Poll vote — single choice; voting the same option again removes the vote.
router.post('/:id/vote', async (req: Request, res: Response) => {
  const { optionIndex } = req.body as { optionIndex?: number };
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post || post.kind !== 'POLL') return res.status(404).json({ error: 'Poll not found' });
  const opts = ((post.extra as any)?.options ?? []) as string[];
  if (typeof optionIndex !== 'number' || optionIndex < 0 || optionIndex >= opts.length) {
    return res.status(400).json({ error: 'Invalid option' });
  }
  const existing = await prisma.postPollVote.findUnique({
    where: { postId_userId: { postId: post.id, userId: req.user!.id } },
  });
  if (existing && existing.optionIndex === optionIndex) {
    await prisma.postPollVote.delete({ where: { id: existing.id } });
  } else if (existing) {
    await prisma.postPollVote.update({ where: { id: existing.id }, data: { optionIndex } });
  } else {
    await prisma.postPollVote.create({ data: { postId: post.id, userId: req.user!.id, optionIndex } });
  }
  res.json((await decorate([{ ...post, user: undefined }], req.user!.id))[0]);
});

// Delete my own post.
router.delete('/:id', async (req: Request, res: Response) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.userId !== req.user!.id) return res.status(403).json({ error: 'Not your post' });
  await prisma.post.delete({ where: { id: post.id } });
  res.json({ ok: true });
});

export default router;
