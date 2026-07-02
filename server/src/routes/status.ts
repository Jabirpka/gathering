import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../index';

const router = Router();
router.use(authMiddleware);

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TEXT = 500;
const MAX_IMAGE = 2_500_000; // ~1.8MB image as base64

// All active (non-expired) statuses visible to me: mine plus anyone who
// shares an approved group with me. Grouped per author, mine first.
router.get('/', async (req: Request, res: Response) => {
  const myId = req.user!.id;

  const myGroups = await prisma.groupMember.findMany({
    where: { userId: myId, status: 'APPROVED' },
    select: { groupId: true },
  });
  const contactIds = await prisma.groupMember.findMany({
    where: { groupId: { in: myGroups.map((g) => g.groupId) }, status: 'APPROVED' },
    select: { userId: true },
    distinct: ['userId'],
  });

  const statuses = await prisma.status.findMany({
    where: {
      expiresAt: { gt: new Date() },
      userId: { in: [...new Set([myId, ...contactIds.map((c) => c.userId)])] },
    },
    include: { user: { select: { id: true, name: true, nickname: true, avatar: true } } },
    orderBy: { createdAt: 'asc' },
  });

  // Group by author, my own ring first, then most recently updated.
  const byUser = new Map<string, { user: any; statuses: any[] }>();
  statuses.forEach((s) => {
    if (!byUser.has(s.userId)) byUser.set(s.userId, { user: s.user, statuses: [] });
    byUser.get(s.userId)!.statuses.push({
      id: s.id, kind: s.kind, content: s.content, bg: s.bg, createdAt: s.createdAt, expiresAt: s.expiresAt,
    });
  });
  const groups = [...byUser.values()].sort((a, b) => {
    if (a.user.id === myId) return -1;
    if (b.user.id === myId) return 1;
    return +new Date(b.statuses[b.statuses.length - 1].createdAt) - +new Date(a.statuses[a.statuses.length - 1].createdAt);
  });

  res.json(groups);
});

// Post a status: TEXT (short text + optional bg color) or IMAGE (data URL).
router.post('/', async (req: Request, res: Response) => {
  const { kind, content, bg } = req.body as { kind?: string; content?: string; bg?: string };
  if (!content?.trim()) {
    res.status(400).json({ error: 'Missing content' });
    return;
  }
  if (kind === 'IMAGE') {
    if (!content.startsWith('data:image/') || content.length > MAX_IMAGE) {
      res.status(400).json({ error: 'Invalid image' });
      return;
    }
  } else if (content.length > MAX_TEXT) {
    res.status(400).json({ error: 'Status text too long' });
    return;
  }

  const status = await prisma.status.create({
    data: {
      userId: req.user!.id,
      kind: kind === 'IMAGE' ? 'IMAGE' : 'TEXT',
      content: kind === 'IMAGE' ? content : content.trim(),
      bg: bg || null,
      expiresAt: new Date(Date.now() + DAY_MS),
    },
  });
  res.status(201).json(status);
});

// Remove my own status early.
router.delete('/:id', async (req: Request, res: Response) => {
  const status = await prisma.status.findUnique({ where: { id: req.params.id } });
  if (!status || status.userId !== req.user!.id) {
    res.status(404).json({ error: 'Status not found' });
    return;
  }
  await prisma.status.delete({ where: { id: status.id } });
  res.json({ ok: true });
});

export default router;
