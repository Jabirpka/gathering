import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../index';

const router = Router();

const MAX_DATA_URL = 4_000_000; // ~3MB of image after base64 overhead
const ALLOWED = /^data:(image\/(png|jpe?g|webp|gif));base64,/;

// Upload an image (data URL) → returns a short permanent URL. Profile rows
// then store `/api/media/:id` instead of the payload itself, so list/user
// queries stop dragging megabytes of base64 around.
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  const { data } = req.body as { data?: string };
  if (!data || typeof data !== 'string' || data.length > MAX_DATA_URL) {
    res.status(400).json({ error: 'Invalid image' });
    return;
  }
  const m = data.match(ALLOWED);
  if (!m) {
    res.status(400).json({ error: 'Unsupported image type' });
    return;
  }
  const media = await prisma.media.create({
    data: { userId: req.user!.id, mime: m[1], data: data.slice(m[0].length) },
    select: { id: true },
  });
  res.status(201).json({ id: media.id, url: `/api/media/${media.id}` });
});

// Serve an image. Public on purpose: <img> tags can't send JWTs, and ids are
// unguessable cuids. Content is immutable, so let clients/CDNs cache forever.
router.get('/:id', async (req: Request, res: Response) => {
  const media = await prisma.media.findUnique({ where: { id: req.params.id } });
  if (!media) {
    res.status(404).end();
    return;
  }
  res.set('Content-Type', media.mime);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(Buffer.from(media.data, 'base64'));
});

export default router;
