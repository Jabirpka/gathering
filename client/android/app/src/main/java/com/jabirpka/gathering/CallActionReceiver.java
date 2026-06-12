package com.jabirpka.gathering;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import androidx.core.app.NotificationManagerCompat;

/**
 * Handles the "Decline" action on an incoming-call notification by simply
 * dismissing it.
 */
public class CallActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (CallNotificationHelper.ACTION_DECLINE.equals(intent.getAction())) {
            int notificationId = intent.getIntExtra(CallNotificationHelper.EXTRA_NOTIFICATION_ID, -1);
            if (notificationId != -1) {
                NotificationManagerCompat.from(context).cancel(notificationId);
            }
        }
    }
}
