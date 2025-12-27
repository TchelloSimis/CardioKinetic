/**
 * Unit tests for sessionNotificationService.ts
 * 
 * Tests notification service functionality (mocked for web environment).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the sessionTimerUtils to control isAndroid
vi.mock('./sessionTimerUtils', () => ({
    isAndroid: vi.fn(() => false)
}));

// Mock SessionNotification
vi.mock('../utils/sessionNotification', () => ({
    SessionNotification: {
        start: vi.fn().mockResolvedValue(undefined),
        updateTime: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn().mockResolvedValue(undefined),
        resume: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        addListener: vi.fn().mockResolvedValue({ remove: vi.fn() })
    }
}));

import {
    startNotification,
    updateNotification,
    pauseNotification,
    resumeNotification,
    stopNotification,
    setupNotificationListener,
    NotificationState,
    BlockInfo
} from './sessionNotificationService';
import { isAndroid } from './sessionTimerUtils';
import { SessionNotification } from '../utils/sessionNotification';

describe('sessionNotificationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ============================================================================
    // startNotification TESTS
    // ============================================================================

    describe('startNotification', () => {
        it('should not call SessionNotification.start when not Android', async () => {
            vi.mocked(isAndroid).mockReturnValue(false);

            await startNotification(150, 300, 30, true);

            expect(SessionNotification.start).not.toHaveBeenCalled();
        });

        it('should call SessionNotification.start when Android', async () => {
            vi.mocked(isAndroid).mockReturnValue(true);

            await startNotification(150, 300, 30, true);

            expect(SessionNotification.start).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '150W',
                    sessionSeconds: 300,
                    phaseSeconds: 30,
                    phase: 'work'
                })
            );
        });

        it('should include block info in body when provided', async () => {
            vi.mocked(isAndroid).mockReturnValue(true);
            const blockInfo: BlockInfo = {
                blockIndex: 0,
                totalBlocks: 3,
                blockType: 'steady-state'
            };

            await startNotification(150, 300, 30, false, blockInfo);

            expect(SessionNotification.start).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: expect.stringContaining('Block 1/3')
                })
            );
        });

        it('should handle errors gracefully', async () => {
            vi.mocked(isAndroid).mockReturnValue(true);
            vi.mocked(SessionNotification.start).mockRejectedValueOnce(new Error('Test error'));

            // Should not throw
            await expect(startNotification(150, 300, 30, true)).resolves.not.toThrow();
        });
    });

    // ============================================================================
    // updateNotification TESTS
    // ============================================================================

    describe('updateNotification', () => {
        it('should not call SessionNotification.updateTime when not Android', async () => {
            vi.mocked(isAndroid).mockReturnValue(false);

            await updateNotification(300, 30, 'work', 150, true);

            expect(SessionNotification.updateTime).not.toHaveBeenCalled();
        });

        it('should call SessionNotification.updateTime when Android', async () => {
            vi.mocked(isAndroid).mockReturnValue(true);

            await updateNotification(300, 30, 'work', 150, true);

            expect(SessionNotification.updateTime).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '150W',
                    sessionSeconds: 300,
                    phaseSeconds: 30,
                    phase: 'work'
                })
            );
        });

        it('should show rest phase correctly', async () => {
            vi.mocked(isAndroid).mockReturnValue(true);

            await updateNotification(300, 30, 'rest', 80, true);

            expect(SessionNotification.updateTime).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: 'Rest',
                    phase: 'rest'
                })
            );
        });
    });

    // ============================================================================
    // pauseNotification TESTS
    // ============================================================================

    describe('pauseNotification', () => {
        it('should not call SessionNotification.pause when not Android', async () => {
            vi.mocked(isAndroid).mockReturnValue(false);

            await pauseNotification(150, 300, 'work');

            expect(SessionNotification.pause).not.toHaveBeenCalled();
        });

        it('should call SessionNotification.pause when Android', async () => {
            vi.mocked(isAndroid).mockReturnValue(true);

            await pauseNotification(150, 300, 'work');

            expect(SessionNotification.pause).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '150W',
                    sessionSeconds: 300,
                    body: expect.stringContaining('Paused')
                })
            );
        });
    });

    // ============================================================================
    // resumeNotification TESTS
    // ============================================================================

    describe('resumeNotification', () => {
        it('should not call SessionNotification.resume when not Android', async () => {
            vi.mocked(isAndroid).mockReturnValue(false);

            await resumeNotification(150, 300, 30, 'work', true);

            expect(SessionNotification.resume).not.toHaveBeenCalled();
        });

        it('should call SessionNotification.resume when Android', async () => {
            vi.mocked(isAndroid).mockReturnValue(true);

            await resumeNotification(150, 300, 30, 'work', true);

            expect(SessionNotification.resume).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: '150W',
                    sessionSeconds: 300,
                    phaseSeconds: 30,
                    phase: 'work'
                })
            );
        });
    });

    // ============================================================================
    // stopNotification TESTS
    // ============================================================================

    describe('stopNotification', () => {
        it('should not call SessionNotification.stop when not Android', async () => {
            vi.mocked(isAndroid).mockReturnValue(false);

            await stopNotification();

            expect(SessionNotification.stop).not.toHaveBeenCalled();
        });

        it('should call SessionNotification.stop when Android', async () => {
            vi.mocked(isAndroid).mockReturnValue(true);

            await stopNotification();

            expect(SessionNotification.stop).toHaveBeenCalled();
        });
    });

    // ============================================================================
    // setupNotificationListener TESTS
    // ============================================================================

    describe('setupNotificationListener', () => {
        it('should return null when not Android', async () => {
            vi.mocked(isAndroid).mockReturnValue(false);

            const cleanup = await setupNotificationListener(
                () => { },
                () => { },
                () => { }
            );

            expect(cleanup).toBeNull();
        });

        it('should return cleanup function when Android', async () => {
            vi.mocked(isAndroid).mockReturnValue(true);

            const cleanup = await setupNotificationListener(
                () => { },
                () => { },
                () => { }
            );

            expect(typeof cleanup).toBe('function');
        });

        it('should add listener for button clicks', async () => {
            vi.mocked(isAndroid).mockReturnValue(true);

            await setupNotificationListener(
                () => { },
                () => { },
                () => { }
            );

            expect(SessionNotification.addListener).toHaveBeenCalledWith(
                'buttonClicked',
                expect.any(Function)
            );
        });
    });
});

// ============================================================================
// Notification Body Builder Tests (via exports)
// ============================================================================

describe('Notification body building', () => {
    beforeEach(() => {
        vi.mocked(isAndroid).mockReturnValue(true);
    });

    it('should build "Work" body for interval work phase', async () => {
        await startNotification(150, 300, 30, true);

        expect(SessionNotification.start).toHaveBeenCalledWith(
            expect.objectContaining({
                body: 'Work'
            })
        );
    });

    it('should build "Steady State" body for non-interval', async () => {
        await startNotification(150, 300, 30, false);

        expect(SessionNotification.start).toHaveBeenCalledWith(
            expect.objectContaining({
                body: 'Steady State'
            })
        );
    });

    it('should build block info for custom sessions', async () => {
        const blockInfo: BlockInfo = {
            blockIndex: 1,
            totalBlocks: 4,
            blockType: 'interval'
        };

        await updateNotification(300, 30, 'rest', 80, true, blockInfo);

        expect(SessionNotification.updateTime).toHaveBeenCalledWith(
            expect.objectContaining({
                body: expect.stringContaining('Block 2/4')
            })
        );
    });
});
