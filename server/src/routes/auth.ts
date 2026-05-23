import { Router, Request, Response } from 'express';
import passport from 'passport';
import { generateToken, authMiddleware } from '../middleware/auth';
import { config } from '../config';

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

    // If pollId was passed in state, save token for native app polling
    try {
      const rawState = (req.query.state as string) || '';
      if (rawState) {
        const { pollId } = JSON.parse(Buffer.from(rawState, 'base64').toString());
        if (pollId) {
          pollStore.set(pollId, { token, expires: Date.now() + 5 * 60_000 });
        }
      }
    } catch {}

    res.redirect(`${config.clientUrl}/auth/callback?token=${token}`);
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

export default router;
