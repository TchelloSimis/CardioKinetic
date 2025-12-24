/**
 * Unit tests for useSessionTimer modules
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    INITIAL_STATE,
    createInitialRefs,
    type SessionRefs,
    type HistoryEntry,
} from './types';
import {
    buildSessionResult,
    createBlockResult,
    addPhaseLogEntry,
} from './sessionState';
import type { SessionSetupParams } from '../types';

describe('useSessionTimer Types', () => {
    describe('INITIAL_STATE', () => {
        it('should have correct default values', () => {
            expect(INITIAL_STATE.isActive).toBe(false);
            expect(INITIAL_STATE.isPaused).toBe(false);
            expect(INITIAL_STATE.sessionStyle).toBe('interval');
            expect(INITIAL_STATE.currentPhase).toBe('work');
            expect(INITIAL_STATE.currentInterval).toBe(0);
            expect(INITIAL_STATE.totalIntervals).toBe(0);
            expect(INITIAL_STATE.phaseTimeRemaining).toBe(0);
            expect(INITIAL_STATE.sessionTimeElapsed).toBe(0);
            expect(INITIAL_STATE.workDurationSeconds).toBe(30);
            expect(INITIAL_STATE.restDurationSeconds).toBe(30);
        });

        it('should have undefined custom session fields by default', () => {
            expect(INITIAL_STATE.currentBlockIndex).toBeUndefined();
            expect(INITIAL_STATE.totalBlocks).toBeUndefined();
            expect(INITIAL_STATE.blockTimeRemaining).toBeUndefined();
            expect(INITIAL_STATE.blocks).toBeUndefined();
        });
    });

    describe('createInitialRefs', () => {
        it('should create refs with correct initial values', () => {
            const refs = createInitialRefs();

            expect(refs.timer).toBeNull();
            expect(refs.startTime).toBe(0);
            expect(refs.pausedTime).toBe(0);
            expect(refs.setupParams).toBeNull();
            expect(refs.halfwayPlayed).toBe(false);
            expect(refs.sessionComplete).toBe(false);
            expect(refs.wasAdjusted).toBe(false);
        });

        it('should create empty arrays', () => {
            const refs = createInitialRefs();

            expect(refs.powerHistory).toEqual([]);
            expect(refs.workDurationHistory).toEqual([]);
            expect(refs.restDurationHistory).toEqual([]);
            expect(refs.phaseLog).toEqual([]);
            expect(refs.blocks).toEqual([]);
            expect(refs.blockResults).toEqual([]);
        });

        it('should create separate instances when called multiple times', () => {
            const refs1 = createInitialRefs();
            const refs2 = createInitialRefs();

            refs1.powerHistory.push({ value: 100, startTime: 0 });
            expect(refs2.powerHistory).toEqual([]);
        });
    });
});

describe('useSessionTimer Session State', () => {
    describe('buildSessionResult', () => {
        it('should build result for completed interval session', () => {
            const state = {
                ...INITIAL_STATE,
                isActive: true,
                sessionStyle: 'interval' as const,
                currentInterval: 10,
                totalIntervals: 10,
                sessionTimeElapsed: 600,
                targetPower: 200,
                targetRPE: 7,
            };

            const refs = createInitialRefs();
            refs.setupParams = {
                totalDurationMinutes: 10,
                targetPower: 200,
                targetRPE: 7,
                sessionStyle: 'interval',
                workDurationSeconds: 30,
                restDurationSeconds: 30,
                workRestRatio: '1:1',
            } as SessionSetupParams;
            refs.powerHistory = [{ value: 200, startTime: Date.now() - 600000 }];
            refs.workDurationHistory = [{ value: 30, startTime: Date.now() - 600000 }];
            refs.restDurationHistory = [{ value: 30, startTime: Date.now() - 600000 }];
            refs.workPhaseTime = 300;
            refs.restPhaseTime = 300;
            refs.initialTargetPower = 200;
            refs.phaseLog = [{ timeSeconds: 0, power: 200, phase: 'work' }];

            const result = buildSessionResult(state, refs, true);

            expect(result.actualDurationMinutes).toBe(10);
            expect(result.intervalsCompleted).toBe(10);
            expect(result.totalIntervals).toBe(10);
            expect(result.targetPower).toBe(200);
            expect(result.sessionStyle).toBe('interval');
            expect(result.wasCompleted).toBe(true);
            expect(result.isGuidedSession).toBe(true);
        });

        it('should handle incomplete session', () => {
            const state = {
                ...INITIAL_STATE,
                isActive: true,
                sessionStyle: 'interval' as const,
                currentInterval: 5,
                totalIntervals: 10,
                sessionTimeElapsed: 300,
                targetPower: 200,
                targetRPE: 7,
            };

            const refs = createInitialRefs();
            refs.setupParams = {
                totalDurationMinutes: 10,
                targetPower: 200,
                targetRPE: 7,
                sessionStyle: 'interval',
                workDurationSeconds: 30,
                restDurationSeconds: 30,
                workRestRatio: '1:1',
            } as SessionSetupParams;
            refs.powerHistory = [{ value: 200, startTime: Date.now() - 300000 }];

            const result = buildSessionResult(state, refs, false);

            expect(result.wasCompleted).toBe(false);
            expect(result.intervalsCompleted).toBe(5);
        });

        it('should calculate actual work/rest ratio', () => {
            const state = {
                ...INITIAL_STATE,
                isActive: true,
                sessionStyle: 'interval' as const,
                sessionTimeElapsed: 600,
            };

            const refs = createInitialRefs();
            refs.setupParams = {
                totalDurationMinutes: 10,
                sessionStyle: 'interval',
                workRestRatio: '1:1',
            } as SessionSetupParams;
            refs.workPhaseTime = 400;
            refs.restPhaseTime = 200;

            const result = buildSessionResult(state, refs, true);

            expect(result.actualWorkSeconds).toBe(400);
            expect(result.actualRestSeconds).toBe(200);
            // computeActualRatio uses percentages: 400/600=67% work, 200/600=33% rest → rounds to 7:3
            expect(result.actualWorkRestRatio).toBe('7:3');
        });
    });

    describe('addPhaseLogEntry', () => {
        it('should add entry to phase log', () => {
            const refs = createInitialRefs();

            addPhaseLogEntry(refs, 0, 200, 'work');
            addPhaseLogEntry(refs, 30, 100, 'rest');
            addPhaseLogEntry(refs, 60, 200, 'work');

            expect(refs.phaseLog).toHaveLength(3);
            expect(refs.phaseLog[0]).toEqual({ timeSeconds: 0, power: 200, phase: 'work' });
            expect(refs.phaseLog[1]).toEqual({ timeSeconds: 30, power: 100, phase: 'rest' });
            expect(refs.phaseLog[2]).toEqual({ timeSeconds: 60, power: 200, phase: 'work' });
        });
    });

    describe('createBlockResult', () => {
        it('should create result for steady-state block', () => {
            const params: SessionSetupParams = {
                totalDurationMinutes: 20,
                targetPower: 200,
                targetRPE: 7,
                sessionStyle: 'custom',
                workDurationSeconds: 30,
                restDurationSeconds: 30,
                blocks: [
                    { id: 'block-1', type: 'steady-state', durationMinutes: 10, powerMultiplier: 1.0 },
                    { id: 'block-2', type: 'interval', durationMinutes: 10, powerMultiplier: 1.1 },
                ],
            };

            const refs = createInitialRefs();
            refs.blockElapsed = 600;
            refs.currentBlockPowers = { workPower: 200, restPower: 100 };
            refs.blockIntervalsCompleted = 1;

            const result = createBlockResult(params, refs, 0);

            expect(result.blockId).toBe('block-1');
            expect(result.blockIndex).toBe(0);
            expect(result.type).toBe('steady-state');
            expect(result.plannedDurationSeconds).toBe(600);
            expect(result.actualDurationSeconds).toBe(600);
            expect(result.plannedPower).toBe(200);
        });

        it('should create result for interval block', () => {
            const params: SessionSetupParams = {
                totalDurationMinutes: 20,
                targetPower: 200,
                targetRPE: 7,
                sessionStyle: 'custom',
                workDurationSeconds: 30,
                restDurationSeconds: 30,
                blocks: [
                    {
                        id: 'block-1',
                        type: 'interval',
                        durationMinutes: 10,
                        powerMultiplier: 1.1,
                        workDurationSeconds: 30,
                        restDurationSeconds: 30,
                        workRestRatio: '1:1',
                    },
                ],
            };

            const refs = createInitialRefs();
            refs.blockElapsed = 540;
            refs.currentBlockPowers = { workPower: 220, restPower: 110 };
            refs.blockIntervalsCompleted = 9;

            const result = createBlockResult(params, refs, 0);

            expect(result.blockId).toBe('block-1');
            expect(result.type).toBe('interval');
            expect(result.plannedPower).toBe(220);
            expect(result.intervalsCompleted).toBe(9);
        });
    });
});
