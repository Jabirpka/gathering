import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../index';

const router = Router();
router.use(authMiddleware);

router.get('/me', (req: AuthRequest, res: Response) => {
  res.json(req.user);
});

router.patch('/me', async (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { name },
    select: { id: true, name: true, email: true, avatar: true },
  });
  res.json(user);
});

export default router;
