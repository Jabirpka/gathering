import { Router, Request, Response } from 'express';
import passport from 'passport';
import { generateToken, authMiddleware } from '../middleware/auth';
import { config } from '../config';
import { prisma } from '../index';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseApp } from '../config/firebase';

const router = Router();

// Temporary token store for mobile poll-based auth (pollId → token, TTL 5 min)
const pollStore = new Map<string, { token: string; expires: number }>();

// Clean up expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pollStore.entries()) {
    if (val.expires < now) pollStore.delete(key);
  }
}, 60_000);

router.get('/google', (req: Request, res: Response, next) => {
  const pollId = req.query.pollId as string | undefined;
  const state = pollId ? Buffer.from(JSON.stringify({ pollId })).toString('base64') : undefined;
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    ...(state ? { state } : {}),
  })(req, res, next);
});

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${config.clientUrl}/?error=auth`,
  }),
  (req: Request, res: Response) => {
    const token = generateToken(req.user!.id);

    // Check if this was a mobile (native app) request via pollId in state
    let isMobile = false;
    try {
      const rawState = (req.query.state as string) || '';
      if (rawState) {
        const parsed = JSON.parse(Buffer.from(rawState, 'base64').toString());
        if (parsed.pollId) isMobile = true;
      }
    } catch {}

    if (isMobile) {
      // Deep link back to the native app — Android intercepts gathering:// scheme
      res.redirect(`gathering://auth?token=${token}`);
    } else {
      res.redirect(`${config.clientUrl}/auth/callback?token=${token}`);
    }
  }
);

// Native app polls this endpoint to retrieve token after OAuth
router.get('/token-poll', (req: Request, res: Response) => {
  const pollId = req.query.pollId as string;
  if (!pollId) return res.status(400).json({ error: 'Missing pollId' });
  const entry = pollStore.get(pollId);
  if (!entry || entry.expires < Date.now()) {
    return res.json({ ready: false });
  }
  pollStore.delete(pollId);
  res.json({ ready: true, token: entry.token });
});

router.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out' });
});

// ---- Phone sign-in via Firebase Phone Auth -----------------------------
// The client runs Firebase Phone Auth (reCAPTCHA + SMS) and sends the resulting
// Firebase ID token here. We verify it with the Firebase Admin SDK (reused from
// push config), then find-or-create a user by phone and issue our own JWT.
router.post('/firebase', async (req: Request, res: Response) => {
  const idToken = req.body?.idToken;
  if (!idToken || typeof idToken !== 'string') {
    return res.status(400).json({ error: 'Missing token' });
  }
  const fbApp = getFirebaseApp();
  if (!fbApp) {
    return res.status(503).json({ error: 'Phone sign-in is not configured' });
  }
  try {
    const decoded = await getAuth(fbApp).verifyIdToken(idToken);
    const phone = decoded.phone_number;
    if (!phone) return res.status(400).json({ error: 'No phone number on this account' });

    let user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await prisma.user.create({ data: { phone, name: phone, onboarded: false } });
    }
    const token = generateToken(user.id);
    res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, avatar: user.avatar } });
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
});

export default router;
