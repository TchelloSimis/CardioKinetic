package com.cardiokinetic.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * BroadcastReceiver for handling notification button clicks.
 * Forwards actions to the SessionNotificationPlugin.
 */
public class SessionNotificationReceiver extends BroadcastReceiver {

    private static SessionNotificationPlugin pluginInstance;

    public static void setPlugin(SessionNotificationPlugin plugin) {
        pluginInstance = plugin;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();

        if (action != null && pluginInstance != null) {
            pluginInstance.onButtonClicked(action);
        }
    }
}
