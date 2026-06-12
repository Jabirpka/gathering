import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { pushApi } from '../services/api';

/**
 * Registers this device for push notifications (Android/iOS only) so that
 * incoming-call notifications can ring even when the app isn't open.
 *
 * - Requests permission + registers with FCM/APNs
 * - Sends the device token to the server so it can be targeted
 * - Handles taps on an "incoming call" notification by deep-linking
 *   straight into the call room
 */
export function usePushNotifications(enabled: boolean) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) return;

    let cancelled = false;

    const setup = async () => {
      try {
        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt') {
          perm = await PushNotifications.requestPermissions();
        }
        if (perm.receive !== 'granted' || cancelled) return;
        await PushNotifications.register();
      } catch (err) {
        console.error('Push notification setup failed', err);
      }
    };

    setup();

    const regListener = PushNotifications.addListener('registration', (token) => {
      pushApi.register(token.value, Capacitor.getPlatform()).catch(() => {});
    });

    const errListener = PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error', err);
    });

    // Tapping a notification (app backgrounded/closed) — jump to the call room
    const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification.data as Record<string, string> | undefined;
      if (data?.type === 'call_ring' && data.groupId && data.roomId) {
        navigate(`/groups/${data.groupId}/rooms/${data.roomId}`);
      }
    });

    return () => {
      cancelled = true;
      regListener.then((l) => l.remove());
      errListener.then((l) => l.remove());
      actionListener.then((l) => l.remove());
    };
  }, [enabled, navigate]);
}
