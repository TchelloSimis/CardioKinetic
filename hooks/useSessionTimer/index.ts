/**
 * useSessionTimer Module - Index
 * 
 * Re-exports all types and utilities for the session timer hook.
 * The main hook implementation remains in the parent useSessionTimer.ts,
 * importing from these modular files.
 */

// Types and interfaces
export * from './types';
export type { PhaseLogEntry, SessionRefs, HistoryEntry } from './types';

// Session state management
export { buildSessionResult, createBlockResult, addPhaseLogEntry } from './sessionState';

// Timer core utilities
export {
    handleCountdownAudio,
    handleHalfwayAudio,
    handleSteadyReminder,
    initCustomSessionState,
    initStandardSessionState,
    TICK_INTERVAL,
    STEADY_REMINDER_INTERVAL
} from './timerCore';
