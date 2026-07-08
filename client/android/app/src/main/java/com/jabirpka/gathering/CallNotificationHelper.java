package com.jabirpka.gathering;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import java.util.HashMap;
import java.util.Map;

/**
 * Builds the high-importance "calls" notification channel and the
 * "incoming call" notification (with Answer/Decline actions) shown by
 * CallMessagingService.
 */
public final class CallNotificationHelper {

    public static final String CHANNEL_ID = "calls";
    public static final String ACTION_DECLINE = "com.jabirpka.gathering.DECLINE_CALL";
    public static final String ACTION_CANCEL = "com.jabirpka.gathering.CANCEL_CALL";
    public static final String EXTRA_NOTIFICATION_ID = "notificationId";
    public static final String EXTRA_ROOM_ID = "roomId";
    /** How long an unanswered call keeps ringing before it gives up. */
    public static final long RING_TIMEOUT_MS = 30_000L;

    private CallNotificationHelper() {}

    public static void createChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Calls",
                NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Incoming call notifications");
        channel.setShowBadge(true);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000});
        // Let the ring punch through Do Not Disturb and always show on the lock screen,
        // matching how a normal phone call behaves while the device is asleep.
        channel.setBypassDnd(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

        AudioAttributes audioAttrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        if (ringtoneUri == null) {
            ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }
        channel.setSound(ringtoneUri, audioAttrs);

        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    /**
     * Shows a heads-up "incoming call" notification with Answer/Decline
     * actions. Notification id is derived from the room id so a repeat ring
     * for the same call updates the existing notification instead of stacking.
     */
    public static void showIncomingCall(Context context, Map<String, String> data) {
        String groupId = data.get("groupId");
        String threadId = data.get("threadId");
        String roomId = data.get("roomId");
        String title = data.get("title");
        String body = data.get("body");
        // Group calls carry a groupId; 1:1 DM calls carry a threadId instead.
        if (roomId == null || (groupId == null && threadId == null)) return;

        int notificationId = roomId.hashCode();

        // "Answer" → deep-link straight into the call (DM or group room).
        Uri callUri;
        if (threadId != null) {
            String type = "AUDIO_CALL".equals(data.get("callType")) ? "audio" : "video";
            callUri = Uri.parse("gathering://call?threadId=" + threadId + "&type=" + type);
        } else {
            callUri = Uri.parse("gathering://call?groupId=" + groupId + "&roomId=" + roomId);
        }
        Intent answerIntent = new Intent(Intent.ACTION_VIEW, callUri);
        answerIntent.setPackage(context.getPackageName());
        answerIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent answerPending = PendingIntent.getActivity(
                context, notificationId, answerIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // "Decline" → dismiss the ring.
        Intent declineIntent = new Intent(context, CallActionReceiver.class);
        declineIntent.setAction(ACTION_DECLINE);
        declineIntent.putExtra(EXTRA_NOTIFICATION_ID, notificationId);
        PendingIntent declinePending = PendingIntent.getBroadcast(
                context, notificationId, declineIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Full-screen intent → the native incoming-call screen. This is what makes
        // Android wake the screen and ring like a real call while the device is
        // locked or asleep (Doze), instead of a silent background notification.
        Intent fullScreenIntent = new Intent(context, IncomingCallActivity.class);
        fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        fullScreenIntent.putExtra(EXTRA_NOTIFICATION_ID, notificationId);
        for (Map.Entry<String, String> e : new HashMap<>(data).entrySet()) {
            fullScreenIntent.putExtra(e.getKey(), e.getValue());
        }
        PendingIntent fullScreenPending = PendingIntent.getActivity(
                context, notificationId + 1, fullScreenIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title != null ? title : "Incoming call")
                .setContentText(body != null ? body : "")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                // Keep the ring sticky so it can't be casually swiped away mid-call.
                .setOngoing(true)
                // Stop ringing on its own if nobody answers, like a missed call.
                .setTimeoutAfter(RING_TIMEOUT_MS)
                .setContentIntent(answerPending)
                .setFullScreenIntent(fullScreenPending, true)
                .addAction(R.mipmap.ic_launcher, "Decline", declinePending)
                .addAction(R.mipmap.ic_launcher, "Answer", answerPending);

        Notification notification = builder.build();
        // Repeat the ringtone until the call is answered or declined, the way a
        // phone call rings continuously rather than chiming once.
        notification.flags |= Notification.FLAG_INSISTENT;

        NotificationManagerCompat.from(context).notify(notificationId, notification);
    }

    /**
     * Stops an incoming-call ring that's already showing — used when the caller
     * hangs up before the callee answers. Cancels the notification (which stops
     * the insistent ringtone) and broadcasts so the full-screen
     * {@link IncomingCallActivity}, if open, dismisses itself.
     */
    public static void cancelIncomingCall(Context context, String roomId) {
        if (roomId == null) return;
        NotificationManagerCompat.from(context).cancel(roomId.hashCode());

        Intent cancel = new Intent(ACTION_CANCEL);
        cancel.setPackage(context.getPackageName());
        cancel.putExtra(EXTRA_ROOM_ID, roomId);
        context.sendBroadcast(cancel);
    }
}
