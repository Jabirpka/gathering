package com.jabirpka.gathering;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
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

        // Must exist before the first FCM call_ring message arrives so
        // CallMessagingService can post to this channel immediately.
        CallNotificationHelper.createChannel(this);

        ensureFullScreenIntentAllowed();
    }

    /**
     * On Android 14+ (API 34) the USE_FULL_SCREEN_INTENT permission is no longer
     * auto-granted to apps that aren't the default phone/dialer. Without it the
     * incoming-call screen can't wake the device, so a call only chimes quietly
     * instead of ringing. If it isn't granted, send the user once to the system
     * screen where they can enable it. (It's a no-op on older versions, which
     * grant it at install time.)
     */
    private void ensureFullScreenIntentAllowed() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.canUseFullScreenIntent()) return;
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
            intent.setData(Uri.parse("package:" + getPackageName()));
            startActivity(intent);
        } catch (Exception ignored) {
            // Settings screen unavailable on this device — the notification still
            // rings as a heads-up, just without waking a locked screen.
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
