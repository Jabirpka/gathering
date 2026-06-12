package com.jabirpka.gathering;

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

import java.util.Map;

/**
 * Builds the high-importance "calls" notification channel and the
 * "incoming call" notification (with Answer/Decline actions) shown by
 * CallMessagingService.
 */
public final class CallNotificationHelper {

    public static final String CHANNEL_ID = "calls";
    public static final String ACTION_DECLINE = "com.jabirpka.gathering.DECLINE_CALL";
    public static final String EXTRA_NOTIFICATION_ID = "notificationId";

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

        AudioAttributes audioAttrs = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
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
        String roomId = data.get("roomId");
        String title = data.get("title");
        String body = data.get("body");
        if (roomId == null || groupId == null) return;

        int notificationId = roomId.hashCode();

        Uri callUri = Uri.parse("gathering://call?groupId=" + groupId + "&roomId=" + roomId);
        Intent answerIntent = new Intent(Intent.ACTION_VIEW, callUri);
        answerIntent.setPackage(context.getPackageName());
        answerIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent answerPending = PendingIntent.getActivity(
                context, notificationId, answerIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent declineIntent = new Intent(context, CallActionReceiver.class);
        declineIntent.setAction(ACTION_DECLINE);
        declineIntent.putExtra(EXTRA_NOTIFICATION_ID, notificationId);
        PendingIntent declinePending = PendingIntent.getBroadcast(
                context, notificationId, declineIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title != null ? title : "Incoming call")
                .setContentText(body != null ? body : "")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setAutoCancel(true)
                .setContentIntent(answerPending)
                .addAction(R.mipmap.ic_launcher, "Decline", declinePending)
                .addAction(R.mipmap.ic_launcher, "Answer", answerPending);

        NotificationManagerCompat.from(context).notify(notificationId, builder.build());
    }
}
