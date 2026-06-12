import { getMessaging, type MulticastMessage, type SendResponse } from 'firebase-admin/messaging';
import { getFirebaseApp } from '../config/firebase';
import { prisma } from '../index';

interface CallPushPayload {
  groupId: string;
  roomId: string;
  roomName: string;
  groupName: string;
  callerName: string;
  callType: 'VIDEO_CALL' | 'AUDIO_CALL';
}

/**
 * Sends a high-priority "incoming call" push notification to every member of
 * the group except the caller. Uses a dedicated "calls" Android notification
 * channel (created natively in MainActivity) so the notification rings/heads-up
 * even when the app is closed. Tapping it deep-links straight into the call room.
 */
export async function sendCallPush(userIds: string[], payload: CallPushPayload) {
  const fbApp = getFirebaseApp();
  if (!fbApp || userIds.length === 0) return;

  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: userIds } },
  });
  if (tokens.length === 0) return;

  const isVideo = payload.callType === 'VIDEO_CALL';
  const title = `Incoming ${isVideo ? 'video' : 'audio'} call`;
  const body = `${payload.callerName} is calling in ${payload.roomName} · ${payload.groupName}`;

  const message: MulticastMessage = {
    tokens: tokens.map((t) => t.token),
    notification: { title, body },
    data: {
      type: 'call_ring',
      groupId: payload.groupId,
      roomId: payload.roomId,
      roomName: payload.roomName,
      groupName: payload.groupName,
      callerName: payload.callerName,
      callType: payload.callType,
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'calls',
        priority: 'max',
        visibility: 'public',
        sound: 'default',
        tag: `call-${payload.roomId}`,
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          contentAvailable: true,
        },
      },
    },
  };

  try {
    const res = await getMessaging(fbApp).sendEachForMulticast(message);
    // Clean up tokens that are no longer valid (app uninstalled, token rotated, etc.)
    const invalid: string[] = [];
    res.responses.forEach((r: SendResponse, i: number) => {
      if (!r.success) {
        const code = r.error?.code;
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          invalid.push(tokens[i].token);
        }
      }
    });
    if (invalid.length > 0) {
      await prisma.pushToken.deleteMany({ where: { token: { in: invalid } } });
    }
  } catch (err) {
    console.error('Failed to send call push notifications', err);
  }
}
