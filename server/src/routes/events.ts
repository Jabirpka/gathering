import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../index';

const router = Router();
router.use(authMiddleware);

router.get('/group/:groupId', async (req: Request, res: Response) => {
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.user!.id, groupId: req.params.groupId } },
  });
  if (!member || member.status !== 'APPROVED') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const events = await prisma.scheduledEvent.findMany({
    where: { groupId: req.params.groupId },
    orderBy: { scheduledAt: 'asc' },
  });
  res.json(events);
});

router.post(
  '/group/:groupId',
  [
    body('title').trim().isLength({ min: 1, max: 100 }),
    body('scheduledAt').isISO8601(),
    body('description').optional().trim(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    const member = await prisma.groupMember.findUnique({
      where: { userId_groupId: { userId: req.user!.id, groupId: req.params.groupId } },
    });
    if (!member || member.status !== 'APPROVED') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    const event = await prisma.scheduledEvent.create({
      data: {
        title: req.body.title,
        description: req.body.description,
        scheduledAt: new Date(req.body.scheduledAt),
        groupId: req.params.groupId,
        meetupData: req.body.meetupData || null,
      },
    });
    res.status(201).json(event);
  }
);

router.delete('/:id', async (req: Request, res: Response) => {
  const event = await prisma.scheduledEvent.findUnique({ where: { id: req.params.id } });
  if (!event) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.user!.id, groupId: event.groupId } },
  });
  if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  await prisma.scheduledEvent.delete({ where: { id: req.params.id } });
  res.json({ message: 'Deleted' });
});

export default router;
