package com.jabirpka.gathering;

import android.app.ActivityManager;
import android.content.Context;

import androidx.annotation.NonNull;
import com.google.firebase.messaging.RemoteMessage;

import java.util.List;

/**
 * Extends Capacitor's default messaging service so the web app still gets
 * its normal push events, but additionally shows a custom high-priority
 * "incoming call" notification (with Answer/Decline actions) for call_ring
 * data messages — including when the app process was woken up just to
 * handle this message.
 */
public class CallMessagingService extends com.capacitorjs.plugins.pushnotifications.MessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        String type = remoteMessage.getData().get("type");

        if ("call_ring".equals(type)) {
            // When the app is already open in the foreground, the web UI shows its
            // own in-app ring — firing the native full-screen call screen too would
            // double-ring and interrupt the user. Only ring natively when the app
            // is backgrounded or the device is asleep/locked, which is exactly when
            // the web ring can't reach the user.
            if (isAppInForeground()) return;

            CallNotificationHelper.createChannel(this);
            CallNotificationHelper.showIncomingCall(this, remoteMessage.getData());
        } else if ("call_cancel".equals(type)) {
            // Caller hung up / call ended — stop ringing on this device.
            CallNotificationHelper.cancelIncomingCall(this, remoteMessage.getData().get("roomId"));
        }
    }

    private boolean isAppInForeground() {
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) return false;
        List<ActivityManager.RunningAppProcessInfo> processes = am.getRunningAppProcesses();
        if (processes == null) return false;
        String packageName = getPackageName();
        for (ActivityManager.RunningAppProcessInfo info : processes) {
            if (info.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
                    && info.processName != null
                    && info.processName.equals(packageName)) {
                return true;
            }
        }
        return false;
    }
}
