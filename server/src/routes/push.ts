import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../index';

const router = Router();
router.use(authMiddleware);

// Register (or refresh) this device's FCM token for the current user
router.post('/register', async (req: Request, res: Response) => {
  const { token, platform } = req.body as { token?: string; platform?: string };
  if (!token) {
    res.status(400).json({ error: 'Missing token' });
    return;
  }

  await prisma.pushToken.upsert({
    where: { token },
    update: { userId: req.user!.id, platform: platform || 'android' },
    create: { userId: req.user!.id, token, platform: platform || 'android' },
  });

  console.log(`Registered push token for ${req.user!.name} (${platform || 'android'})`);
  res.json({ ok: true });
});

// Remove a device token (e.g. on logout)
router.post('/unregister', async (req: Request, res: Response) => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: 'Missing token' });
    return;
  }
  await prisma.pushToken.deleteMany({ where: { token, userId: req.user!.id } });
  res.json({ ok: true });
});

export default router;
