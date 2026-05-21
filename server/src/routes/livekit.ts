import { Router, Response } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { prisma } from '../index';
import { config } from '../config';

const router = Router();
router.use(authMiddleware);

router.post('/token', async (req: AuthRequest, res: Response) => {
  const { roomName, groupId } = req.body;
  if (!roomName || !groupId) return res.status(400).json({ error: 'Missing roomName or groupId' });

  const member = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: req.user!.id, groupId } },
  });
  if (!member || member.status !== 'APPROVED') {
    return res.status(403).json({ error: 'Not a member of this group' });
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

export default router;
