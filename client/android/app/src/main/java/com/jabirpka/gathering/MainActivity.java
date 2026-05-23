package com.jabirpka.gathering;

import android.Manifest;
import android.content.pm.PackageManager;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int PERM_REQUEST_CODE = 200;

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
