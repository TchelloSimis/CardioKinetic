/**
 * Session Notification Service for Android
 * Handles all notification-related operations for the session timer
 */

import { SessionNotification } from '../utils/sessionNotification';
import { isAndroid } from './sessionTimerUtils';

export interface NotificationState {
    sessionSeconds: number;
    phaseSeconds: number;
    phase: 'work' | 'rest';
    power: number;
    isInterval: boolean;
}

/**
 * Block info for custom session notifications
 */
export interface BlockInfo {
    blockIndex: number;      // 0-indexed
    totalBlocks: number;
    blockType: 'steady-state' | 'interval';
}

/**
 * Build notification body text based on session type and block info
 */
const buildNotificationBody = (
    phase: 'work' | 'rest',
    isInterval: boolean,
    blockInfo?: BlockInfo
): string => {
    // Custom session with block info
    if (blockInfo) {
        const blockPrefix = `Block ${blockInfo.blockIndex + 1}/${blockInfo.totalBlocks}`;
        if (blockInfo.blockType === 'steady-state') {
            return `${blockPrefix} • Steady State`;
        } else {
            // Interval block in custom session
            return `${blockPrefix} • ${phase === 'work' ? 'Work' : 'Rest'}`;
        }
    }

    // Standard session (non-custom)
    if (isInterval) {
        return phase === 'work' ? 'Work' : 'Rest';
    } else {
        return 'Steady State';
    }
};

/**
 * Build paused notification body text
 */
const buildPausedBody = (
    phase: 'work' | 'rest',
    blockInfo?: BlockInfo
): string => {
    if (blockInfo) {
        const blockPrefix = `Block ${blockInfo.blockIndex + 1}/${blockInfo.totalBlocks}`;
        if (blockInfo.blockType === 'steady-state') {
            return `${blockPrefix} • Paused`;
        } else {
            return `${blockPrefix} • ${phase === 'work' ? 'Work' : 'Rest'} Paused`;
        }
    }

    return phase === 'work' ? 'Work Paused' : 'Rest Paused';
};

/**
 * Start the session notification
 */
export const startNotification = async (
    power: number,
    sessionSeconds: number,
    phaseSeconds: number,
    isInterval: boolean,
    blockInfo?: BlockInfo
): Promise<void> => {
    if (!isAndroid()) return;

    try {
        await SessionNotification.start({
            title: `${power}W`,
            body: buildNotificationBody('work', isInterval, blockInfo),
            sessionSeconds,
            phaseSeconds,
            phase: 'work',
        });
    } catch (err) {
        console.error('Failed to start session notification:', err);
    }
};

/**
 * Update notification with current phase info
 */
export const updateNotification = async (
    sessionSeconds: number,
    phaseSeconds: number,
    phase: 'work' | 'rest',
    power: number,
    isInterval: boolean,
    blockInfo?: BlockInfo
): Promise<void> => {
    if (!isAndroid()) return;

    try {
        await SessionNotification.updateTime({
            title: `${power}W`,
            body: buildNotificationBody(phase, isInterval, blockInfo),
            sessionSeconds: Math.floor(sessionSeconds),
            phaseSeconds: Math.floor(phaseSeconds),
            phase,
        });
    } catch (err) {
        console.error('Failed to update notification:', err);
    }
};

/**
 * Show paused notification
 */
export const pauseNotification = async (
    power: number,
    sessionSeconds: number,
    phase: 'work' | 'rest',
    blockInfo?: BlockInfo
): Promise<void> => {
    if (!isAndroid()) return;

    try {
        await SessionNotification.pause({
            title: `${power}W`,
            body: buildPausedBody(phase, blockInfo),
            sessionSeconds: Math.floor(sessionSeconds),
        });
    } catch (err) {
        console.error('Failed to pause notification:', err);
    }
};

/**
 * Resume notification
 */
export const resumeNotification = async (
    power: number,
    sessionSeconds: number,
    phaseSeconds: number,
    phase: 'work' | 'rest',
    isInterval: boolean,
    blockInfo?: BlockInfo
): Promise<void> => {
    if (!isAndroid()) return;

    try {
        await SessionNotification.resume({
            title: `${power}W`,
            body: buildNotificationBody(phase, isInterval, blockInfo),
            sessionSeconds: Math.floor(sessionSeconds),
            phaseSeconds: Math.floor(phaseSeconds),
            phase,
        });
    } catch (err) {
        console.error('Failed to resume notification:', err);
    }
};

/**
 * Stop notification
 */
export const stopNotification = async (): Promise<void> => {
    if (!isAndroid()) return;

    try {
        await SessionNotification.stop();
    } catch (err) {
        console.error('Failed to stop notification:', err);
    }
};

/**
 * Setup notification button listener
 * Returns cleanup function
 */
export const setupNotificationListener = (
    onPause: () => void,
    onResume: () => void,
    onStop: () => void
): Promise<(() => void) | null> => {
    if (!isAndroid()) return Promise.resolve(null);

    return SessionNotification.addListener('buttonClicked', (event) => {
        if (event.action === 'pause') {
            onPause();
        } else if (event.action === 'resume') {
            onResume();
        } else if (event.action === 'stop') {
            onStop();
        }
    }).then(handle => () => handle.remove());
};
