/**
 * Foreground Service Utility for Live Sessions
 * 
 * Manages Android foreground service with persistent notification during live sessions.
 * This keeps the app alive in the background so audio cues continue to play.
 * 
 * Enhanced notifications show:
 * - Target power
 * - Phase time remaining (intervals) or total time (steady state)
 * - Dynamic pause/stop buttons based on session state
 */

import { Capacitor } from '@capacitor/core';
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service';

// Notification channel and ID constants
const NOTIFICATION_ID = 1001;
const NOTIFICATION_CHANNEL_ID = 'cardiokinetic_session';
const NOTIFICATION_CHANNEL_NAME = 'Live Session';

// Button ID constants for notification actions
export const BUTTON_ID_PAUSE = 1;
export const BUTTON_ID_RESUME = 2;
export const BUTTON_ID_STOP = 3;

let isServiceRunning = false;

/**
 * Check if running on Android native platform
 */
export const isAndroid = (): boolean => {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};

/**
 * Check current notification permission status
 */
export const checkNotificationPermission = async (): Promise<boolean> => {
    if (!isAndroid()) return true;

    try {
        const result = await ForegroundService.checkPermissions();
        return result.display === 'granted';
    } catch (error) {
        console.warn('Failed to check notification permission:', error);
        return false;
    }
};

/**
 * Request notification permission (Android 13+)
 * Should be called proactively on app start
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
    if (!isAndroid()) return true;

    try {
        const result = await ForegroundService.requestPermissions();
        return result.display === 'granted';
    } catch (error) {
        console.warn('Failed to request notification permission:', error);
        return false;
    }
};

/**
 * Bring the app to the foreground
 * Used when user taps End Session from notification
 */
export const moveToForeground = async (): Promise<void> => {
    if (!isAndroid()) return;

    try {
        await ForegroundService.moveToForeground();
    } catch (error) {
        console.warn('Failed to move app to foreground:', error);
    }
};

/**
 * Format seconds into MM:SS display
 */
const formatTime = (seconds: number): string => {
    const mins = Math.floor(Math.max(0, seconds) / 60);
    const secs = Math.floor(Math.max(0, seconds) % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Start the foreground service with a persistent notification
 * Call this when a live session begins
 */
export const startSessionNotification = async (
    title: string = 'Session Active',
    body: string = 'Your training session is in progress'
): Promise<void> => {
    console.log('[ForegroundService] startSessionNotification called');
    console.log('[ForegroundService] isAndroid():', isAndroid());
    console.log('[ForegroundService] isNativePlatform:', Capacitor.isNativePlatform());
    console.log('[ForegroundService] platform:', Capacitor.getPlatform());

    if (!isAndroid()) {
        console.log('[ForegroundService] Not Android, skipping notification');
        return;
    }

    try {
        console.log('[ForegroundService] Creating notification channel...');
        // Create notification channel first (required for Android 8+)
        await ForegroundService.createNotificationChannel({
            id: NOTIFICATION_CHANNEL_ID,
            name: NOTIFICATION_CHANNEL_NAME,
            importance: 3, // IMPORTANCE_DEFAULT
            description: 'Notifications for active training sessions',
        });
        console.log('[ForegroundService] Channel created');

        console.log('[ForegroundService] Starting foreground service...');
        // Start the foreground service with Pause button
        await ForegroundService.startForegroundService({
            id: NOTIFICATION_ID,
            title,
            body,
            smallIcon: 'ic_stat_notification',
            buttons: [
                {
                    id: BUTTON_ID_PAUSE,
                    title: 'Pause',
                },
            ],
        });

        isServiceRunning = true;
        console.log('[ForegroundService] Foreground service started successfully');
    } catch (error) {
        console.error('[ForegroundService] Failed to start foreground service:', error);
    }
};

/**
 * Update the notification content (simple version)
 * Call this periodically to show current session status
 */
export const updateSessionNotification = async (
    title: string,
    body: string
): Promise<void> => {
    if (!isAndroid() || !isServiceRunning) return;

    try {
        await ForegroundService.updateForegroundService({
            id: NOTIFICATION_ID,
            title,
            body,
            smallIcon: 'ic_stat_notification',
            buttons: [
                {
                    id: BUTTON_ID_PAUSE,
                    title: 'Pause',
                },
            ],
        });
    } catch (error) {
        console.warn('Failed to update foreground service:', error);
    }
};

/**
 * Update notification with rich session information
 * Shows power, times, and dynamic buttons based on pause state
 */
export const updateSessionNotificationRich = async (
    isPaused: boolean,
    targetPower: number,
    phaseTimeRemaining: number,
    sessionTimeRemaining: number,
    currentPhase: 'work' | 'rest' | 'complete',
    isInterval: boolean,
    currentInterval?: number,
    totalIntervals?: number
): Promise<void> => {
    if (!isAndroid() || !isServiceRunning) return;

    try {
        let title: string;
        let body: string;
        let buttons: Array<{ id: number; title: string }>;

        if (isPaused) {
            // Paused state - show Resume and End Session buttons
            title = 'Session Paused';
            body = `${targetPower}W Target - ${formatTime(sessionTimeRemaining)} left`;
            buttons = [
                { id: BUTTON_ID_RESUME, title: 'Resume' },
                { id: BUTTON_ID_STOP, title: 'End Session' },
            ];
        } else {
            // Running state - show Pause button
            const phaseLabel = currentPhase === 'work' ? 'Work' : 'Rest';

            if (isInterval) {
                // Interval training - show phase time and total time
                title = `${phaseLabel} - ${targetPower}W`;
                const intervalInfo = currentInterval && totalIntervals
                    ? ` - ${currentInterval}/${totalIntervals}`
                    : '';
                body = `Phase: ${formatTime(phaseTimeRemaining)} | Total: ${formatTime(sessionTimeRemaining)}${intervalInfo}`;
            } else {
                // Steady state - show total time and power
                title = `Steady State - ${targetPower}W`;
                body = `Time left: ${formatTime(sessionTimeRemaining)}`;
            }

            buttons = [
                { id: BUTTON_ID_PAUSE, title: 'Pause' },
            ];
        }

        // Update notification - only include buttons if state changed (pause/resume)
        // This prevents button flickering during periodic updates
        await ForegroundService.updateForegroundService({
            id: NOTIFICATION_ID,
            title,
            body,
            smallIcon: 'ic_stat_notification',
            buttons, // Always include buttons - Android handles this properly
        });
    } catch (error) {
        console.warn('Failed to update foreground service:', error);
    }
};

/**
 * Update notification with time info only (no button changes)
 * Use this for periodic updates to avoid button flickering
 */
export const updateSessionNotificationTime = async (
    targetPower: number,
    phaseTimeRemaining: number,
    sessionTimeRemaining: number,
    currentPhase: 'work' | 'rest' | 'complete',
    isInterval: boolean,
    currentInterval?: number,
    totalIntervals?: number
): Promise<void> => {
    if (!isAndroid() || !isServiceRunning) return;

    try {
        let title: string;
        let body: string;

        const phaseLabel = currentPhase === 'work' ? 'Work' : 'Rest';

        if (isInterval) {
            title = `${phaseLabel} - ${targetPower}W`;
            const intervalInfo = currentInterval && totalIntervals
                ? ` - ${currentInterval}/${totalIntervals}`
                : '';
            body = `Phase: ${formatTime(phaseTimeRemaining)} | Total: ${formatTime(sessionTimeRemaining)}${intervalInfo}`;
        } else {
            title = `Steady State - ${targetPower}W`;
            body = `Time left: ${formatTime(sessionTimeRemaining)}`;
        }

        // Update title, body, and keep the Pause button (Android clears buttons if not included)
        await ForegroundService.updateForegroundService({
            id: NOTIFICATION_ID,
            title,
            body,
            smallIcon: 'ic_stat_notification',
            buttons: [
                { id: BUTTON_ID_PAUSE, title: 'Pause' },
            ],
        });
    } catch (error) {
        console.warn('Failed to update foreground service time:', error);
    }
};

/**
 * Stop the foreground service
 * Call this when the session ends or is cancelled
 */
export const stopSessionNotification = async (): Promise<void> => {
    if (!isAndroid() || !isServiceRunning) return;

    try {
        await ForegroundService.stopForegroundService();
        isServiceRunning = false;
        console.log('Foreground service stopped');
    } catch (error) {
        console.warn('Failed to stop foreground service:', error);
    }
};

/**
 * Check if foreground service is currently running
 */
export const isSessionNotificationActive = (): boolean => {
    return isServiceRunning;
};

/**
 * Add listener for notification button clicks
 * Handles PAUSE, RESUME, and STOP button actions
 */
export const addNotificationButtonListener = (
    callback: (buttonId: number) => void
): (() => void) => {
    if (!isAndroid()) {
        return () => { };
    }

    const listener = ForegroundService.addListener('buttonClicked', (event) => {
        callback(event.buttonId);
    });

    // Return cleanup function
    return () => {
        listener.then(l => l.remove());
    };
};
