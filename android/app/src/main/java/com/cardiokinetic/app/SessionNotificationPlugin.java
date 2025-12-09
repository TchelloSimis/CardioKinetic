package com.cardiokinetic.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import androidx.core.app.NotificationCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Custom Capacitor plugin for session notifications.
 * Shows time prominently in title, supports interval sessions with phase info.
 */
@CapacitorPlugin(name = "SessionNotification")
public class SessionNotificationPlugin extends Plugin {

    private static final String CHANNEL_ID = "cardiokinetic_session";
    private static final String CHANNEL_NAME = "Live Session";
    private static final int NOTIFICATION_ID = 1001;

    public static final String ACTION_PAUSE = "com.cardiokinetic.app.ACTION_PAUSE";
    public static final String ACTION_RESUME = "com.cardiokinetic.app.ACTION_RESUME";
    public static final String ACTION_STOP = "com.cardiokinetic.app.ACTION_STOP";

    private NotificationManager notificationManager;
    private boolean isRunning = false;
    private boolean isPaused = false;

    private String currentTitle = "";
    private String currentBody = "";
    private int sessionRemaining = 0;
    private int phaseRemaining = 0;
    private String currentPhase = "work";

    private Handler handler;
    private Runnable tickRunnable;

    @Override
    public void load() {
        notificationManager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
        handler = new Handler(Looper.getMainLooper());
        SessionNotificationReceiver.setPlugin(this);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Displays live session progress");
            channel.setShowBadge(false);
            notificationManager.createNotificationChannel(channel);
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        currentTitle = call.getString("title", "Session");
        currentBody = call.getString("body", "");
        sessionRemaining = call.getInt("sessionSeconds", 0);
        phaseRemaining = call.getInt("phaseSeconds", sessionRemaining);
        currentPhase = call.getString("phase", "work");

        isRunning = true;
        isPaused = false;

        showActiveNotification();
        startTick();
        call.resolve();
    }

    @PluginMethod
    public void updateTime(PluginCall call) {
        if (!isRunning || isPaused) {
            call.resolve();
            return;
        }

        currentTitle = call.getString("title", currentTitle);
        currentBody = call.getString("body", currentBody);
        sessionRemaining = call.getInt("sessionSeconds", sessionRemaining);
        phaseRemaining = call.getInt("phaseSeconds", phaseRemaining);
        currentPhase = call.getString("phase", currentPhase);

        showActiveNotification();
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        if (!isRunning) {
            call.resolve();
            return;
        }

        isPaused = true;
        stopTick();

        currentTitle = call.getString("title", currentTitle);
        currentBody = call.getString("body", currentBody);
        sessionRemaining = call.getInt("sessionSeconds", sessionRemaining);

        showPausedNotification();
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        if (!isRunning) {
            call.resolve();
            return;
        }

        isPaused = false;
        currentTitle = call.getString("title", currentTitle);
        currentBody = call.getString("body", currentBody);
        sessionRemaining = call.getInt("sessionSeconds", sessionRemaining);
        phaseRemaining = call.getInt("phaseSeconds", phaseRemaining);
        currentPhase = call.getString("phase", currentPhase);

        showActiveNotification();
        startTick();
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        isRunning = false;
        isPaused = false;
        stopTick();
        notificationManager.cancel(NOTIFICATION_ID);
        call.resolve();
    }

    private void startTick() {
        stopTick();
        tickRunnable = new Runnable() {
            @Override
            public void run() {
                if (isRunning && !isPaused) {
                    if (sessionRemaining > 0)
                        sessionRemaining--;
                    if (phaseRemaining > 0)
                        phaseRemaining--;
                    showActiveNotification();
                    handler.postDelayed(this, 1000);
                }
            }
        };
        handler.postDelayed(tickRunnable, 1000);
    }

    private void stopTick() {
        if (tickRunnable != null) {
            handler.removeCallbacks(tickRunnable);
            tickRunnable = null;
        }
    }

    private String formatTime(int seconds) {
        int m = seconds / 60;
        int s = seconds % 60;
        return String.format("%d:%02d", m, s);
    }

    private void showActiveNotification() {
        Context context = getContext();

        Intent openIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (openIntent != null) {
            // Use SINGLE_TOP + REORDER_TO_FRONT to resume existing activity without
            // destroying it
            openIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        }
        PendingIntent openPending = PendingIntent.getActivity(context, 0, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent pauseIntent = new Intent(context, SessionNotificationReceiver.class);
        pauseIntent.setAction(ACTION_PAUSE);
        PendingIntent pausePending = PendingIntent.getBroadcast(context, 1, pauseIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Format: "5:30 • Work - 150W" or "12:45 • Steady - 120W"
        String sessionTime = formatTime(sessionRemaining);
        String phaseTime = formatTime(phaseRemaining);

        String title = sessionTime + " remaining";
        String body;
        if (phaseRemaining != sessionRemaining && phaseRemaining > 0) {
            // Interval mode: show phase time and power only (currentBody contains Work/Rest
            // which we already show)
            String phaseLabel = "work".equals(currentPhase) ? "Work" : "Rest";
            body = phaseLabel + " " + phaseTime + " • " + currentTitle;
        } else {
            // Steady state: show power and label
            body = currentTitle;
            if (currentBody != null && !currentBody.isEmpty()) {
                body = body + " • " + currentBody;
            }
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setContentIntent(openPending)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setCategory(NotificationCompat.CATEGORY_WORKOUT)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setShowWhen(false)
                .addAction(0, "Pause", pausePending);

        notificationManager.notify(NOTIFICATION_ID, builder.build());
    }

    private void showPausedNotification() {
        Context context = getContext();

        Intent openIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (openIntent != null) {
            // Use SINGLE_TOP + REORDER_TO_FRONT to resume existing activity without
            // destroying it
            openIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        }
        PendingIntent openPending = PendingIntent.getActivity(context, 0, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Intent resumeIntent = new Intent(context, SessionNotificationReceiver.class);
        resumeIntent.setAction(ACTION_RESUME);
        PendingIntent resumePending = PendingIntent.getBroadcast(context, 2, resumeIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String title = "PAUSED • " + formatTime(sessionRemaining);
        String body = currentTitle;
        if (currentBody != null && !currentBody.isEmpty()) {
            body = body + " • " + currentBody;
        }

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setContentIntent(openPending)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setCategory(NotificationCompat.CATEGORY_WORKOUT)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setShowWhen(false)
                .addAction(0, "Resume", resumePending);

        notificationManager.notify(NOTIFICATION_ID, builder.build());
    }

    public void onButtonClicked(String action) {
        JSObject data = new JSObject();

        switch (action) {
            case ACTION_PAUSE:
                data.put("action", "pause");
                break;
            case ACTION_RESUME:
                data.put("action", "resume");
                break;
            case ACTION_STOP:
                data.put("action", "stop");
                bringAppToForeground();
                break;
            default:
                return;
        }

        notifyListeners("buttonClicked", data);
    }

    private void bringAppToForeground() {
        Context context = getContext();

        // Try using ActivityManager to bring task to front (more reliable)
        android.app.ActivityManager activityManager = (android.app.ActivityManager) context
                .getSystemService(Context.ACTIVITY_SERVICE);

        if (activityManager != null) {
            java.util.List<android.app.ActivityManager.RunningTaskInfo> tasks = activityManager.getRunningTasks(1);
            if (tasks != null && !tasks.isEmpty()) {
                int taskId = tasks.get(0).id;
                activityManager.moveTaskToFront(taskId, android.app.ActivityManager.MOVE_TASK_WITH_HOME);
            }
        }

        // Also launch activity as fallback
        Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (intent != null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
            context.startActivity(intent);
        }
    }
}
