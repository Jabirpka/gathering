package com.jabirpka.gathering;

import android.Manifest;
import android.content.pm.PackageManager;
import android.webkit.PermissionRequest;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final int PERM_REQUEST_CODE = 200;
    /** Saved WebView permission request waiting on Android runtime grants */
    private PermissionRequest pendingWebPermRequest;

    // ── Runtime permissions ───────────────────────────────────────────────────

    @Override
    public void onStart() {
        super.onStart();
        requestMediaPermissionsIfNeeded();
    }

    private void requestMediaPermissionsIfNeeded() {
        String[] perms = {
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.MODIFY_AUDIO_SETTINGS
        };
        boolean allGranted = true;
        for (String perm : perms) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
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
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERM_REQUEST_CODE && pendingWebPermRequest != null) {
            // Grant the pending WebView request now that the user responded
            pendingWebPermRequest.grant(pendingWebPermRequest.getResources());
            pendingWebPermRequest = null;
        }
    }

    // ── WebView permission requests (camera / mic from WebRTC / getUserMedia) ─

    /**
     * Called by Capacitor's BridgeWebChromeClient when the web page asks for
     * camera or microphone access via getUserMedia / WebRTC.
     */
    @Override
    public void onWebViewPermissionRequest(PermissionRequest request) {
        boolean hasCam = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED;
        boolean hasMic = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;

        if (hasCam && hasMic) {
            // Android permissions already granted — let the WebView proceed
            request.grant(request.getResources());
        } else {
            // Ask Android for permissions first, then grant the WebView request
            pendingWebPermRequest = request;
            ActivityCompat.requestPermissions(this,
                new String[]{Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO,
                             Manifest.permission.MODIFY_AUDIO_SETTINGS},
                PERM_REQUEST_CODE);
        }
    }
}
