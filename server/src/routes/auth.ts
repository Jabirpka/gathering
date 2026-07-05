import { Router, Request, Response } from 'express';
import passport from 'passport';
import { generateToken, authMiddleware } from '../middleware/auth';
import { config } from '../config';
import { prisma } from '../index';

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

// ---- Phone OTP sign-in -------------------------------------------------
// In-memory code store (phone → code). Fine for a single long-running server;
// swap for Redis/DB if you scale to multiple instances.
const otpStore = new Map<string, { code: string; expiresAt: number; attempts: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of otpStore.entries()) if (v.expiresAt < now) otpStore.delete(k);
}, 60_000);

// Normalize to "+<digits>". Returns null when the number is too short/long.
function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return '+' + digits;
}

// Deliver the code. No SMS provider is wired yet — we log it. Plug Twilio (or
// similar) in here for production delivery.
async function sendSms(phone: string, message: string): Promise<void> {
  console.log(`[OTP] SMS to ${phone}: ${message}`);
}

// In dev (no SMS provider) the code is returned so the flow is testable.
const OTP_DEV = process.env.NODE_ENV !== 'production';

router.post('/phone/request', async (req: Request, res: Response) => {
  const phone = normalizePhone(req.body?.phone);
  if (!phone) return res.status(400).json({ error: 'Enter a valid phone number' });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(phone, { code, expiresAt: Date.now() + 5 * 60_000, attempts: 0 });
  try { await sendSms(phone, `Your Gathering code is ${code}`); } catch {}
  res.json({ sent: true, ...(OTP_DEV ? { devCode: code } : {}) });
});

router.post('/phone/verify', async (req: Request, res: Response) => {
  const phone = normalizePhone(req.body?.phone);
  const code = String(req.body?.code ?? '').trim();
  if (!phone) return res.status(400).json({ error: 'Enter a valid phone number' });

  const entry = otpStore.get(phone);
  if (!entry || entry.expiresAt < Date.now()) {
    otpStore.delete(phone);
    return res.status(400).json({ error: 'Code expired — request a new one' });
  }
  entry.attempts += 1;
  if (entry.attempts > 5) {
    otpStore.delete(phone);
    return res.status(429).json({ error: 'Too many attempts — request a new code' });
  }
  if (entry.code !== code) return res.status(400).json({ error: 'Incorrect code' });
  otpStore.delete(phone);

  let user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    user = await prisma.user.create({ data: { phone, name: phone } });
  }
  const token = generateToken(user.id);
  res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, avatar: user.avatar } });
});

export default router;
