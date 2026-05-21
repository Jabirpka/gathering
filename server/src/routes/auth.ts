import { Router } from 'express';
import passport from 'passport';
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import { config } from '../config';

const router = Router();

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${config.clientUrl}/login?error=auth` }),
  (req, res) => {
    const user = req.user as any;
    const token = generateToken(user.id);
    res.redirect(`${config.clientUrl}/auth/callback?token=${token}`);
  }
);

router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

router.post('/logout', (_req, res) => {
  res.json({ message: 'Logged out' });
});

export default router;
