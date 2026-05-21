import { Router, Request, Response } from 'express';
import passport from 'passport';
import { generateToken, authMiddleware } from '../middleware/auth';
import { config } from '../config';

const router = Router();

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${config.clientUrl}/login?error=auth`,
  }),
  (req: Request, res: Response) => {
    const token = generateToken(req.user!.id);
    res.redirect(`${config.clientUrl}/auth/callback?token=${token}`);
  }
);

router.get('/me', authMiddleware, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out' });
});

export default router;
