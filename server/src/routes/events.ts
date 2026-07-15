import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../index';
import { getIO } from '../socket/index';

const router = Router();
router.use(authMiddleware);

const messageInclude = {
  user: { select: { id: true, name: true, avatar: true } },
  reactions: { select: { userId: true, emoji: true } },
} as const;

async function requireMember(userId: string, groupId: string) {
  const m = await prisma.groupMember.findUnique({ where: { userId_groupId: { userId, groupId } } });
  return !!m && m.status === 'APPROVED';
}

function shapeEvent(msg: any, rsvps: any[], myId: string) {
  const def = JSON.parse(msg.content);
  const byStatus: Record<string, { id: string; name: string; avatar: string | null; plusGuest: boolean }[]> = { GOING: [], MAYBE: [], NO: [] };
  let mine: { status: string; plusGuest: boolean } | null = null;
  let guestCount = 0;
  for (const r of rsvps) {
    (byStatus[r.status] ??= []).push({ id: r.user.id, name: r.user.nickname || r.user.name, avatar: r.user.avatar, plusGuest: r.plusGuest });
    if (r.status === 'GOING' && r.plusGuest) guestCount += 1;
    if (r.userId === myId) mine = { status: r.status, plusGuest: r.plusGuest };
  }
  return {
    messageId: msg.id,
    name: def.name, description: def.description || '', startsAt: def.startsAt,
    endsAt: def.endsAt || null, location: def.location || '', allowGuests: !!def.allowGuests,
    reminderMinutes: def.reminderMinutes ?? null,
    rsvps: byStatus, myRsvp: mine,
    goingCount: byStatus.GOING.length + guestCount,
  };
}

router.post('/', async (req: Request, res: Response) => {
  const { groupId, name, description, startsAt, endsAt, location, allowGuests, reminderMinutes } = req.body as any;
  if (!groupId || !name?.trim() || !startsAt) {
    res.status(400).json({ error: 'Name and date/time are required' });
    return;
  }
  if (!(await requireMember(req.user!.id, groupId))) {
    res.status(403).json({ error: 'Not a member' });
    return;
  }
  const content = JSON.stringify({
    name: String(name).trim().slice(0, 120),
    description: description ? String(description).trim().slice(0, 500) : '',
    startsAt, endsAt: endsAt || null,
    location: location ? String(location).trim().slice(0, 200) : '',
    allowGuests: !!allowGuests,
    reminderMinutes: typeof reminderMinutes === 'number' ? reminderMinutes : null,
  });
  const message = await prisma.message.create({
    data: { content, kind: 'EVENT', userId: req.user!.id, groupId },
    include: messageInclude,
  });
  getIO().to(`group:${groupId}`).emit('chat:message', message);
  try {
    const others = await prisma.groupMember.findMany({ where: { groupId, status: 'APPROVED', userId: { not: req.user!.id } }, select: { userId: true } });
    const preview = { content: '📅 Event', createdAt: message.createdAt, userId: message.userId, user: { name: message.user.name } };
    others.forEach((m) => getIO().to(`user:${m.userId}`).emit('chat:unread', { groupId, message: preview }));
  } catch {}
  res.status(201).json(message);
});

router.get('/:messageId', async (req: Request, res: Response) => {
  const msg = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!msg || msg.kind !== 'EVENT' || !msg.groupId) { res.status(404).json({ error: 'Event not found' }); return; }
  if (!(await requireMember(req.user!.id, msg.groupId))) { res.status(403).json({ error: 'Not a member' }); return; }
  const rsvps = await prisma.eventRsvp.findMany({
    where: { messageId: msg.id },
    include: { user: { select: { id: true, name: true, nickname: true, avatar: true } } },
  });
  res.json(shapeEvent(msg, rsvps, req.user!.id));
});

router.post('/:messageId/rsvp', async (req: Request, res: Response) => {
  const { status, plusGuest } = req.body as { status?: string; plusGuest?: boolean };
  if (!['GOING', 'MAYBE', 'NO'].includes(status || '')) { res.status(400).json({ error: 'Invalid status' }); return; }
  const msg = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!msg || msg.kind !== 'EVENT' || !msg.groupId) { res.status(404).json({ error: 'Event not found' }); return; }
  if (!(await requireMember(req.user!.id, msg.groupId))) { res.status(403).json({ error: 'Not a member' }); return; }
  const def = JSON.parse(msg.content);
  const guest = !!plusGuest && !!def.allowGuests && status === 'GOING';

  await prisma.eventRsvp.upsert({
    where: { messageId_userId: { messageId: msg.id, userId: req.user!.id } },
    update: { status: status!, plusGuest: guest },
    create: { messageId: msg.id, userId: req.user!.id, status: status!, plusGuest: guest },
  });
  const rsvps = await prisma.eventRsvp.findMany({
    where: { messageId: msg.id },
    include: { user: { select: { id: true, name: true, nickname: true, avatar: true } } },
  });
  const shaped = shapeEvent(msg, rsvps, req.user!.id);
  getIO().to(`group:${msg.groupId}`).emit('event:update', { messageId: msg.id, groupId: msg.groupId, event: shaped });
  res.json(shaped);
});

export default router;
