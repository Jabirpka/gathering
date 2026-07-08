package com.jabirpka.gathering;

import android.app.KeyguardManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

/**
 * Native full-screen "incoming call" screen launched by the call notification's
 * full-screen intent. It is configured (here and in the manifest) to appear over
 * the lock screen and turn the screen on, so an incoming call is visible and
 * actionable even while the phone is asleep/locked.
 *
 * The continuous ringtone is driven by the notification itself (high-importance
 * "calls" channel + FLAG_INSISTENT in {@link CallNotificationHelper}); this
 * activity only owns the visuals and the Answer/Decline buttons. Both buttons
 * cancel that notification, which stops the ring.
 */
public class IncomingCallActivity extends AppCompatActivity {

    private int notificationId = -1;
    private String groupId;
    private String threadId;
    private String roomId;
    private String callType;

    private final Handler timeoutHandler = new Handler(Looper.getMainLooper());
    private final Runnable autoDismiss = this::declineCall;

    // Fires when the caller hangs up before we answer — close this screen.
    private final BroadcastReceiver cancelReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String canceledRoom = intent.getStringExtra(CallNotificationHelper.EXTRA_ROOM_ID);
            if (canceledRoom == null || canceledRoom.equals(roomId)) {
                finish();
            }
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        showWhenLockedAndTurnScreenOn();

        Bundle extras = getIntent().getExtras();
        if (extras != null) {
            notificationId = extras.getInt(CallNotificationHelper.EXTRA_NOTIFICATION_ID, -1);
            groupId = extras.getString("groupId");
            threadId = extras.getString("threadId");
            roomId = extras.getString("roomId");
            callType = extras.getString("callType");
        }

        String title = extras != null ? extras.getString("title") : null;
        String body = extras != null ? extras.getString("body") : null;
        String callerName = extras != null ? extras.getString("callerName") : null;

        setContentView(buildLayout(
                title != null ? title : "Incoming call",
                callerName != null ? callerName : (body != null ? body : "")
        ));

        ContextCompat.registerReceiver(
                this, cancelReceiver,
                new IntentFilter(CallNotificationHelper.ACTION_CANCEL),
                ContextCompat.RECEIVER_NOT_EXPORTED
        );

        // Give up at the same point the notification stops ringing, so a missed
        // call doesn't leave this screen stuck on top of the lock screen.
        timeoutHandler.postDelayed(autoDismiss, CallNotificationHelper.RING_TIMEOUT_MS + 2_000L);
    }

    @Override
    protected void onDestroy() {
        timeoutHandler.removeCallbacks(autoDismiss);
        try {
            unregisterReceiver(cancelReceiver);
        } catch (IllegalArgumentException ignored) {
            // Already unregistered — safe to ignore.
        }
        super.onDestroy();
    }

    /**
     * If this activity was relaunched (singleTop) for a newer ring, refresh the
     * call it points at so Answer joins the right room.
     */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        Bundle extras = intent.getExtras();
        if (extras != null) {
            notificationId = extras.getInt(CallNotificationHelper.EXTRA_NOTIFICATION_ID, notificationId);
            groupId = extras.getString("groupId");
            threadId = extras.getString("threadId");
            roomId = extras.getString("roomId");
            callType = extras.getString("callType");
        }
    }

    private void showWhenLockedAndTurnScreenOn() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager keyguard = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (keyguard != null) {
                keyguard.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                            | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                            | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                            | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }
    }

    private View buildLayout(String title, String subtitle) {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.parseColor("#0F0F17"));
        int pad = dp(28);
        root.setPadding(pad, pad, pad, pad);

        TextView label = new TextView(this);
        label.setText("Gathering");
        label.setTextColor(Color.parseColor("#A78BFA"));
        label.setTextSize(14);
        label.setGravity(Gravity.CENTER);
        root.addView(label);

        TextView titleView = new TextView(this);
        titleView.setText(title);
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(26);
        titleView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        titleLp.topMargin = dp(12);
        titleView.setLayoutParams(titleLp);
        root.addView(titleView);

        TextView subtitleView = new TextView(this);
        subtitleView.setText(subtitle);
        subtitleView.setTextColor(Color.parseColor("#94A3B8"));
        subtitleView.setTextSize(16);
        subtitleView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        subLp.topMargin = dp(8);
        subtitleView.setLayoutParams(subLp);
        root.addView(subtitleView);

        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        buttons.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams buttonsLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        buttonsLp.topMargin = dp(48);
        buttons.setLayoutParams(buttonsLp);

        Button decline = new Button(this);
        decline.setText("Decline");
        decline.setTextColor(Color.WHITE);
        decline.setBackgroundColor(Color.parseColor("#EF4444"));
        decline.setOnClickListener(v -> declineCall());
        LinearLayout.LayoutParams declineLp =
                new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        declineLp.rightMargin = dp(8);
        buttons.addView(decline, declineLp);

        Button answer = new Button(this);
        answer.setText("Answer");
        answer.setTextColor(Color.WHITE);
        answer.setBackgroundColor(Color.parseColor("#10B981"));
        answer.setOnClickListener(v -> answerCall());
        LinearLayout.LayoutParams answerLp =
                new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        answerLp.leftMargin = dp(8);
        buttons.addView(answer, answerLp);

        root.addView(buttons);
        return root;
    }

    private void answerCall() {
        cancelRing();
        Uri callUri = null;
        if (threadId != null) {
            String type = "AUDIO_CALL".equals(callType) ? "audio" : "video";
            callUri = Uri.parse("gathering://call?threadId=" + threadId + "&type=" + type);
        } else if (groupId != null && roomId != null) {
            callUri = Uri.parse("gathering://call?groupId=" + groupId + "&roomId=" + roomId);
        }
        if (callUri != null) {
            Intent intent = new Intent(Intent.ACTION_VIEW, callUri);
            intent.setPackage(getPackageName());
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(intent);
        }
        finish();
    }

    private void declineCall() {
        cancelRing();
        finish();
    }

    private void cancelRing() {
        if (notificationId != -1) {
            NotificationManagerCompat.from(this).cancel(notificationId);
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
