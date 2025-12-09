import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ActionPerformed, LocalNotificationSchema } from '@capacitor/local-notifications';

// Notification IDs for tracking
export const NOTIFICATION_IDS = {
    TEST_REGULAR: 1001,
    TEST_PERSISTENT: 1002,
} as const;

// Action IDs for notification buttons
export const ACTION_IDS = {
    OPEN_APP: 'open_app',
    DISMISS: 'dismiss',
    SEND_DATA: 'send_data',
} as const;

export interface NotificationLogEntry {
    timestamp: Date;
    type: 'action' | 'permission' | 'scheduled' | 'error';
    message: string;
    data?: Record<string, unknown>;
}

// Check if running on native platform
export function isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
}

// Get platform name
export function getPlatformName(): string {
    return Capacitor.getPlatform();
}

// Request notification permissions
export async function requestNotificationPermissions(): Promise<{ granted: boolean; message: string }> {
    if (!isNativePlatform()) {
        return { granted: false, message: 'Notifications only work on native platforms' };
    }

    try {
        const result = await LocalNotifications.requestPermissions();
        const granted = result.display === 'granted';
        return {
            granted,
            message: granted ? 'Notification permissions granted' : 'Notification permissions denied',
        };
    } catch (error) {
        return {
            granted: false,
            message: `Error requesting permissions: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}

// Check current permission status
export async function checkNotificationPermissions(): Promise<{ status: string; canRequest: boolean }> {
    if (!isNativePlatform()) {
        return { status: 'unavailable', canRequest: false };
    }

    try {
        const result = await LocalNotifications.checkPermissions();
        return {
            status: result.display,
            canRequest: result.display === 'prompt' || result.display === 'prompt-with-rationale',
        };
    } catch (error) {
        return { status: 'error', canRequest: false };
    }
}

// Register action types for notifications
export async function registerNotificationActions(): Promise<void> {
    if (!isNativePlatform()) return;

    try {
        await LocalNotifications.registerActionTypes({
            types: [
                {
                    id: 'test_notification_actions',
                    actions: [
                        {
                            id: ACTION_IDS.OPEN_APP,
                            title: 'Open App',
                            foreground: true,
                        },
                        {
                            id: ACTION_IDS.DISMISS,
                            title: 'Dismiss',
                            destructive: true,
                        },
                        {
                            id: ACTION_IDS.SEND_DATA,
                            title: 'Send Data',
                            foreground: true,
                        },
                    ],
                },
            ],
        });
    } catch (error) {
        console.error('Failed to register notification actions:', error);
    }
}

// Send a regular (dismissable) test notification
export async function sendRegularNotification(): Promise<{ success: boolean; message: string }> {
    if (!isNativePlatform()) {
        return { success: false, message: 'Notifications only work on native platforms' };
    }

    try {
        const notification: LocalNotificationSchema = {
            id: NOTIFICATION_IDS.TEST_REGULAR,
            title: 'CardioKinetic Test',
            body: 'This is a regular dismissable notification. Swipe to dismiss.',
            largeBody: 'This notification can be dismissed by swiping. Use the action buttons to interact with the app.',
            actionTypeId: 'test_notification_actions',
            extra: {
                type: 'test_regular',
                timestamp: new Date().toISOString(),
                testData: { message: 'Hello from regular notification!' },
            },
        };

        await LocalNotifications.schedule({ notifications: [notification] });
        return { success: true, message: 'Regular notification sent' };
    } catch (error) {
        return {
            success: false,
            message: `Failed to send notification: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}

// Send a persistent (ongoing) test notification
export async function sendPersistentNotification(): Promise<{ success: boolean; message: string }> {
    if (!isNativePlatform()) {
        return { success: false, message: 'Notifications only work on native platforms' };
    }

    try {
        const notification: LocalNotificationSchema = {
            id: NOTIFICATION_IDS.TEST_PERSISTENT,
            title: 'CardioKinetic Persistent',
            body: 'This notification CANNOT be swiped away. Use action buttons to dismiss.',
            largeBody: 'This is an ongoing/persistent notification. It will stay visible until you use an action button to dismiss it.',
            ongoing: true, // Makes notification persistent on Android
            autoCancel: false, // Don't auto-cancel when tapped
            actionTypeId: 'test_notification_actions',
            extra: {
                type: 'test_persistent',
                timestamp: new Date().toISOString(),
                testData: { message: 'Hello from persistent notification!' },
            },
        };

        await LocalNotifications.schedule({ notifications: [notification] });
        return { success: true, message: 'Persistent notification sent' };
    } catch (error) {
        return {
            success: false,
            message: `Failed to send notification: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}

// Cancel a specific notification by ID
export async function cancelNotification(id: number): Promise<void> {
    if (!isNativePlatform()) return;

    try {
        await LocalNotifications.cancel({ notifications: [{ id }] });
    } catch (error) {
        console.error('Failed to cancel notification:', error);
    }
}

// Cancel all test notifications
export async function cancelAllTestNotifications(): Promise<void> {
    await cancelNotification(NOTIFICATION_IDS.TEST_REGULAR);
    await cancelNotification(NOTIFICATION_IDS.TEST_PERSISTENT);
}

// Set up action listener - returns cleanup function
export function setupNotificationActionListener(
    onAction: (action: ActionPerformed) => void
): () => Promise<void> {
    if (!isNativePlatform()) {
        return () => Promise.resolve();
    }

    const listener = LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
        onAction(action);

        // If dismiss action, cancel the notification
        if (action.actionId === ACTION_IDS.DISMISS) {
            await cancelNotification(action.notification.id);
        }
    });

    // Return cleanup function
    return async () => {
        (await listener).remove();
    };
}

// Get app diagnostic info
export function getAppDiagnostics(): Record<string, string> {
    return {
        platform: Capacitor.getPlatform(),
        isNative: String(Capacitor.isNativePlatform()),
        isPluginAvailable: String(Capacitor.isPluginAvailable('LocalNotifications')),
    };
}
