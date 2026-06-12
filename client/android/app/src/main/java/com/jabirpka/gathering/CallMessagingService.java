package com.jabirpka.gathering;

import androidx.annotation.NonNull;
import com.google.firebase.messaging.RemoteMessage;

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

        if ("call_ring".equals(remoteMessage.getData().get("type"))) {
            CallNotificationHelper.createChannel(this);
            CallNotificationHelper.showIncomingCall(this, remoteMessage.getData());
        }
    }
}
