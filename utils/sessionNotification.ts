/**
 * Custom Session Notification Plugin (Native Android)
 * 
 * Uses prominent time display in notification title.
 * Supports interval sessions with phase-specific info.
 */

import { registerPlugin } from '@capacitor/core';

export interface SessionNotificationPlugin {
    /**
     * Start the session notification
     */
    start(options: {
        title: string;
        body?: string;
        sessionSeconds: number;
        phaseSeconds?: number;
        phase?: 'work' | 'rest';
    }): Promise<void>;

    /**
     * Update notification (called on phase changes for intervals)
     */
    updateTime(options: {
        title: string;
        body?: string;
        sessionSeconds: number;
        phaseSeconds?: number;
        phase?: 'work' | 'rest';
    }): Promise<void>;

    /**
     * Show paused state with Resume/End buttons
     */
    pause(options: {
        title: string;
        body?: string;
        sessionSeconds: number;
    }): Promise<void>;

    /**
     * Resume running state
     */
    resume(options: {
        title: string;
        body?: string;
        sessionSeconds: number;
        phaseSeconds?: number;
        phase?: 'work' | 'rest';
    }): Promise<void>;

    /**
     * Stop and dismiss the notification
     */
    stop(): Promise<void>;

    /**
     * Add listener for notification button clicks
     */
    addListener(
        eventName: 'buttonClicked',
        listenerFunc: (event: { action: 'pause' | 'resume' | 'stop' }) => void
    ): Promise<{ remove: () => Promise<void> }>;

    /**
     * Remove all listeners
     */
    removeAllListeners(): Promise<void>;
}

// Register the plugin
const SessionNotification = registerPlugin<SessionNotificationPlugin>('SessionNotification', {
    web: () => import('./sessionNotificationWeb').then(m => new m.SessionNotificationWeb()),
});

export { SessionNotification };
