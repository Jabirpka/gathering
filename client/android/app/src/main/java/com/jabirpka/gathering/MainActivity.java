package com.jabirpka.gathering;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final int PERM_REQUEST_CODE = 200;
    private static final String CALLS_CHANNEL_ID = "calls";

    /**
     * Apps targeting Android 15+ (SDK 35+) draw edge-to-edge by default,
     * which lets the WebView content sit underneath the status bar and
     * navigation/gesture bar. Without this, the top app bar (profile
     * avatar, notification bell, etc.) renders partially behind the
     * status bar icons. Apply the system bar insets as padding on the
     * root content view so the web UI is fully visible.
     */
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        View rootView = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(rootView, (view, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });

        createCallsNotificationChannel();
    }

    /**
     * High-importance channel for incoming call pushes so they show as a
     * heads-up notification with a ringtone sound even when the app is
     * closed. Must exist before the first FCM message arrives for the
     * channelId on that message to take effect.
     */
    private void createCallsNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationChannel channel = new NotificationChannel(
                CALLS_CHANNEL_ID,
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

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    /**
     * Request camera + mic + notification runtime permissions on every start.
     * Android 6+ requires explicit runtime approval even when the
     * permissions are declared in AndroidManifest.xml.
     * Capacitor's BridgeWebChromeClient auto-grants WebView
     * permission requests once these Android permissions are in place.
     */
    @Override
    public void onStart() {
        super.onStart();
        List<String> perms = new ArrayList<>();
        perms.add(Manifest.permission.CAMERA);
        perms.add(Manifest.permission.RECORD_AUDIO);
        perms.add(Manifest.permission.MODIFY_AUDIO_SETTINGS);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS);
        }

        List<String> missing = new ArrayList<>();
        for (String perm : perms) {
            if (ContextCompat.checkSelfPermission(this, perm)
                    != PackageManager.PERMISSION_GRANTED) {
                missing.add(perm);
            }
        }
        if (!missing.isEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toArray(new String[0]), PERM_REQUEST_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode,
                                           @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        // Let Capacitor handle its own permission callbacks first
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }
}
