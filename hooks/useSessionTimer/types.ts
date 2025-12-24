/**
 * useSessionTimer - Types and Interfaces
 * 
 * Centralized type definitions for the session timer system.
 */

import { LiveSessionState, SessionSetupParams, SessionResult, SessionBlock, BlockResult } from '../../types';

// ============================================================================
// HOOK INTERFACES
// ============================================================================

export interface UseSessionTimerOptions {
    onPhaseChange?: (phase: 'work' | 'rest' | 'complete') => void;
    onIntervalComplete?: (intervalNumber: number) => void;
    onSessionComplete?: (result: SessionResult) => void;
    onTick?: (state: LiveSessionState) => void;
    onBlockChange?: (blockIndex: number, totalBlocks: number) => void; // For custom sessions
}

export interface UseSessionTimerReturn {
    state: LiveSessionState;
    start: (params: SessionSetupParams) => void;
    pause: () => void;
    resume: () => void;
    stop: () => SessionResult;
    completeEarly: () => void;
    skipToNextPhase: () => void;
    adjustWorkDuration: (deltaSeconds: number) => void;
    adjustRestDuration: (deltaSeconds: number) => void;
    adjustTargetPower: (deltaWatts: number) => void;
    isInitialized: boolean;
    completionResult: SessionResult | null;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

export const INITIAL_STATE: LiveSessionState = {
    isActive: false,
    isPaused: false,
    sessionStyle: 'interval',
    currentPhase: 'work',
    currentInterval: 0,
    totalIntervals: 0,
    phaseTimeRemaining: 0,
    sessionTimeElapsed: 0,
    sessionTimeRemaining: 0,
    workDurationSeconds: 30,
    restDurationSeconds: 30,
    targetPower: 0,
    targetRPE: 6,
    // Custom session block tracking
    currentBlockIndex: undefined,
    totalBlocks: undefined,
    blockTimeRemaining: undefined,
    blockTimeElapsed: undefined,
    currentBlockType: undefined,
    blocks: undefined,
};

// ============================================================================
// HISTORY ENTRY TYPE
// ============================================================================

export interface HistoryEntry {
    value: number;
    startTime: number;
}

// ============================================================================
// PHASE LOG ENTRY TYPE
// ============================================================================

export interface PhaseLogEntry {
    timeSeconds: number;
    power: number;
    phase: 'work' | 'rest';
}

// ============================================================================
// SESSION REFS TYPE
// ============================================================================

export interface SessionRefs {
    timer: ReturnType<typeof setInterval> | null;
    startTime: number;
    pausedTime: number;
    setupParams: SessionSetupParams | null;
    lastSteadyReminder: number;
    halfwayPlayed: boolean;
    lastCountdownSecond: number;
    sessionComplete: boolean;
    powerHistory: HistoryEntry[];
    workDurationHistory: HistoryEntry[];
    restDurationHistory: HistoryEntry[];
    wasAdjusted: boolean;
    workPhaseTime: number;
    restPhaseTime: number;
    phaseLog: PhaseLogEntry[];
    initialWorkPower: number;
    initialRestPower: number;
    initialTargetPower: number;
    completionResult: SessionResult | null;
    notificationListenerCleanup: (() => void) | null;
    notificationEndSession: boolean;
    // Custom session block tracking
    blocks: SessionBlock[];
    currentBlockIndex: number;
    blockStartTime: number;
    blockElapsed: number;
    blockIntervalsCompleted: number;
    blockResults: BlockResult[];
    currentBlockPowers: { workPower: number; restPower: number };
}

export const createInitialRefs = (): SessionRefs => ({
    timer: null,
    startTime: 0,
    pausedTime: 0,
    setupParams: null,
    lastSteadyReminder: 0,
    halfwayPlayed: false,
    lastCountdownSecond: -1,
    sessionComplete: false,
    powerHistory: [],
    workDurationHistory: [],
    restDurationHistory: [],
    wasAdjusted: false,
    workPhaseTime: 0,
    restPhaseTime: 0,
    phaseLog: [],
    initialWorkPower: 0,
    initialRestPower: 0,
    initialTargetPower: 0,
    completionResult: null,
    notificationListenerCleanup: null,
    notificationEndSession: false,
    blocks: [],
    currentBlockIndex: 0,
    blockStartTime: 0,
    blockElapsed: 0,
    blockIntervalsCompleted: 0,
    blockResults: [],
    currentBlockPowers: { workPower: 0, restPower: 0 },
});
