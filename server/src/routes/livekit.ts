import { Router, Request, Response } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../index';
import { config } from '../config';

const router = Router();
router.use(authMiddleware);

router.post('/token', async (req: Request, res: Response) => {
  const { roomName, groupId } = req.body;
  if (!roomName || !groupId) {
    res.status(400).json({ error: 'Missing roomName or groupId' });
    return;
  }
  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.user!.id, groupId } },
  });
  if (!member || member.status !== 'APPROVED') {
    res.status(403).json({ error: 'Not a member of this group' });
    return;
  }
  const at = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
    identity: req.user!.id,
    name: req.user!.name,
    ttl: 3600,
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  const token = await at.toJwt();
  res.json({ token, wsUrl: config.livekitWsUrl });
});

// DM call token — room is scoped to the thread; only its two participants join.
router.post('/dm-token', async (req: Request, res: Response) => {
  const { threadId } = req.body;
  if (!threadId) {
    res.status(400).json({ error: 'Missing threadId' });
    return;
  }
  const thread = await prisma.dmThread.findUnique({ where: { id: threadId } });
  if (!thread || (thread.userAId !== req.user!.id && thread.userBId !== req.user!.id)) {
    res.status(403).json({ error: 'Not part of this conversation' });
    return;
  }
  const at = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
    identity: req.user!.id,
    name: req.user!.name,
    ttl: 3600,
  });
  at.addGrant({
    roomJoin: true,
    room: `dm-${threadId}`,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  const token = await at.toJwt();
  res.json({ token, wsUrl: config.livekitWsUrl });
});

export default router;
