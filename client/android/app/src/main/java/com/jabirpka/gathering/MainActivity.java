package com.jabirpka.gathering;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

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
    }

    /**
     * Request camera + mic runtime permissions on every start.
     * Android 6+ requires explicit runtime approval even when the
     * permissions are declared in AndroidManifest.xml.
     * Capacitor's BridgeWebChromeClient auto-grants WebView
     * permission requests once these Android permissions are in place.
     */
    @Override
    public void onStart() {
        super.onStart();
        String[] perms = {
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.MODIFY_AUDIO_SETTINGS
        };
        boolean allGranted = true;
        for (String perm : perms) {
            if (ContextCompat.checkSelfPermission(this, perm)
                    != PackageManager.PERMISSION_GRANTED) {
                allGranted = false;
                break;
            }
        }
        if (!allGranted) {
            ActivityCompat.requestPermissions(this, perms, PERM_REQUEST_CODE);
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
