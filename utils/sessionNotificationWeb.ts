/**
 * Web implementation stub for SessionNotification plugin
 * Does nothing on web - notifications only work on Android
 */

import { WebPlugin } from '@capacitor/core';
import type { SessionNotificationPlugin } from './sessionNotification';

export class SessionNotificationWeb extends WebPlugin implements SessionNotificationPlugin {
    async start(): Promise<void> {
        // No-op on web
    }

    async updateTime(): Promise<void> {
        // No-op on web
    }

    async pause(): Promise<void> {
        // No-op on web
    }

    async resume(): Promise<void> {
        // No-op on web
    }

    async stop(): Promise<void> {
        // No-op on web
    }
}
