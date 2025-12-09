/**
 * Web implementation stub for SessionNotification plugin
 * Does nothing on web - notifications only work on Android
 */

import { WebPlugin } from '@capacitor/core';
import type { SessionNotificationPlugin } from './sessionNotification';

export class SessionNotificationWeb extends WebPlugin implements SessionNotificationPlugin {
    async start(): Promise<void> {
        console.log('[SessionNotification] Web: start() - no-op');
    }

    async updateTime(): Promise<void> {
        // No-op on web
    }

    async pause(): Promise<void> {
        console.log('[SessionNotification] Web: pause() - no-op');
    }

    async resume(): Promise<void> {
        console.log('[SessionNotification] Web: resume() - no-op');
    }

    async stop(): Promise<void> {
        console.log('[SessionNotification] Web: stop() - no-op');
    }
}
