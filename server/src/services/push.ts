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
 * the group except the caller. The message is data-only so the Android app's
 * CallMessagingService can build a custom "calls"-channel notification with
 * Answer/Decline actions (and so it fires even while the app is backgrounded,
 * not just when it's fully closed). Answer deep-links straight into the call room.
 */
export async function sendCallPush(userIds: string[], payload: CallPushPayload) {
  const fbApp = getFirebaseApp();
  if (!fbApp || userIds.length === 0) return;

  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: userIds } },
  });
  if (tokens.length === 0) {
    console.log(`sendCallPush: no push tokens registered for ${userIds.length} member(s)`);
    return;
  }

  const isVideo = payload.callType === 'VIDEO_CALL';
  const title = `Incoming ${isVideo ? 'video' : 'audio'} call`;
  const body = `${payload.callerName} is calling in ${payload.roomName} · ${payload.groupName}`;

  const message: MulticastMessage = {
    tokens: tokens.map((t) => t.token),
    data: {
      type: 'call_ring',
      title,
      body,
      groupId: payload.groupId,
      roomId: payload.roomId,
      roomName: payload.roomName,
      groupName: payload.groupName,
      callerName: payload.callerName,
      callType: payload.callType,
    },
    android: {
      priority: 'high',
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
    console.log(`sendCallPush: sent to ${res.successCount}/${tokens.length} device(s), ${res.failureCount} failed`);
    await pruneInvalidTokens(res.responses, tokens.map((t) => t.token));
  } catch (err) {
    console.error('Failed to send call push notifications', err);
  }
}

interface DmCallPushPayload {
  threadId: string;
  /** LiveKit/room id for this DM call — `dm-${threadId}`. */
  roomId: string;
  callerName: string;
  callType: 'VIDEO_CALL' | 'AUDIO_CALL';
}

/**
 * Same as sendCallPush but for a 1:1 DM call: rings the other participant's
 * device (even when the app is closed). Carries a threadId instead of a
 * groupId so the Android side's "Answer" deep-links straight into the DM call.
 */
export async function sendDmCallPush(userIds: string[], payload: DmCallPushPayload) {
  const fbApp = getFirebaseApp();
  if (!fbApp || userIds.length === 0) return;

  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: userIds } },
  });
  if (tokens.length === 0) {
    console.log(`sendDmCallPush: no push tokens registered for ${userIds.length} user(s)`);
    return;
  }

  const isVideo = payload.callType === 'VIDEO_CALL';
  const title = `Incoming ${isVideo ? 'video' : 'audio'} call`;
  const body = `${payload.callerName} is calling`;

  const message: MulticastMessage = {
    tokens: tokens.map((t) => t.token),
    data: {
      type: 'call_ring',
      title,
      body,
      threadId: payload.threadId,
      roomId: payload.roomId,
      callerName: payload.callerName,
      callType: payload.callType,
    },
    android: {
      priority: 'high',
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
    console.log(`sendDmCallPush: sent to ${res.successCount}/${tokens.length} device(s), ${res.failureCount} failed`);
    await pruneInvalidTokens(res.responses, tokens.map((t) => t.token));
  } catch (err) {
    console.error('Failed to send DM call push notifications', err);
  }
}

/**
 * Sends a data-only "call_cancel" push so the callees' devices stop ringing the
 * moment the call ends (caller hung up before anyone answered, or the room
 * emptied out). The Android CallMessagingService dismisses the matching
 * incoming-call notification and full-screen screen on receipt.
 */
export async function sendCallCancelPush(userIds: string[], roomId: string) {
  const fbApp = getFirebaseApp();
  if (!fbApp || userIds.length === 0) return;

  const tokens = await prisma.pushToken.findMany({
    where: { userId: { in: userIds } },
  });
  if (tokens.length === 0) return;

  const message: MulticastMessage = {
    tokens: tokens.map((t) => t.token),
    data: {
      type: 'call_cancel',
      roomId,
    },
    android: {
      priority: 'high',
    },
  };

  try {
    const res = await getMessaging(fbApp).sendEachForMulticast(message);
    console.log(`sendCallCancelPush: sent to ${res.successCount}/${tokens.length} device(s)`);
    await pruneInvalidTokens(res.responses, tokens.map((t) => t.token));
  } catch (err) {
    console.error('Failed to send call-cancel push notifications', err);
  }
}

/**
 * Removes device tokens that FCM reported as permanently invalid (app
 * uninstalled, token rotated, etc.) so we stop trying to reach them.
 */
async function pruneInvalidTokens(responses: SendResponse[], tokens: string[]) {
  const invalid: string[] = [];
  responses.forEach((r: SendResponse, i: number) => {
    if (!r.success) {
      const code = r.error?.code;
      if (
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/registration-token-not-registered'
      ) {
        invalid.push(tokens[i]);
      }
    }
  });
  if (invalid.length > 0) {
    await prisma.pushToken.deleteMany({ where: { token: { in: invalid } } });
  }
}
