package com.cardiokinetic.app;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Register custom plugins BEFORE super.onCreate
        registerPlugin(SessionNotificationPlugin.class);

        super.onCreate(savedInstanceState);

        // Inject Material You accent color into WebView after bridge is ready
        injectMaterialYouColor();
    }

    private void injectMaterialYouColor() {
        // Get the WebView from Capacitor bridge
        WebView webView = getBridge().getWebView();
        if (webView == null)
            return;

        String accentColor = getMaterialYouAccentColor();
        if (accentColor != null) {
            // Inject CSS variable and JavaScript bridge when DOM is ready
            final String script = "document.addEventListener('DOMContentLoaded', function() {" +
                    "  document.documentElement.style.setProperty('--material-accent-primary', '" + accentColor + "');"
                    +
                    "});" +
                    "document.documentElement.style.setProperty('--material-accent-primary', '" + accentColor + "');" +
                    "window.AndroidBridge = window.AndroidBridge || {};" +
                    "window.AndroidBridge.getMaterialYouColor = function() { return '" + accentColor + "'; };";

            webView.post(() -> {
                webView.evaluateJavascript(script, null);
            });
        }
    }

    private String getMaterialYouAccentColor() {
        // Material You is only available on Android 12+ (API 31+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                // Get the system accent color (primary color from Material You)
                int colorValue = getColor(android.R.color.system_accent1_500);
                return String.format("#%06X", (0xFFFFFF & colorValue));
            } catch (Exception e) {
                // Fallback if color resource not found
                return null;
            }
        }
        return null;
    }
}
