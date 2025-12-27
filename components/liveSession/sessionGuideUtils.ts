/**
 * LiveSessionGuide - Utility Functions
 * 
 * Extracted helper functions for live session management
 */

import type { SessionSetupParams, SessionResult } from '../../types';

// ============================================================================
// SESSION PHASE HELPERS
// ============================================================================

/**
 * Determine phase color based on session type and current phase
 */
export function getPhaseColor(
    phase: 'work' | 'rest',
    sessionStyle: 'interval' | 'steady-state' | 'custom',
    accentColor: string
): string {
    if (sessionStyle === 'steady-state') {
        return accentColor;
    }
    return phase === 'work' ? accentColor : '#6b7280'; // gray for rest
}

/**
 * Get phase label text
 */
export function getPhaseLabel(
    phase: 'work' | 'rest',
    sessionStyle: 'interval' | 'steady-state' | 'custom'
): string {
    if (sessionStyle === 'steady-state') {
        return 'STEADY STATE';
    }
    return phase === 'work' ? 'WORK' : 'REST';
}

// ============================================================================
// TIME FORMATTING
// ============================================================================

/**
 * Format seconds to MM:SS display
 */
export function formatTimeDisplay(seconds: number): string {
    const mins = Math.floor(Math.abs(seconds) / 60);
    const secs = Math.abs(seconds) % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format duration in minutes to readable string
 */
export function formatDurationMinutes(minutes: number): string {
    if (minutes < 1) {
        return `${Math.round(minutes * 60)}s`;
    }
    return `${Math.round(minutes * 10) / 10}min`;
}

// ============================================================================
// PROGRESS CALCULATIONS
// ============================================================================

/**
 * Calculate overall session progress percentage
 */
export function calculateSessionProgress(
    elapsedSeconds: number,
    totalDurationMinutes: number
): number {
    const totalSeconds = totalDurationMinutes * 60;
    return Math.min(100, (elapsedSeconds / totalSeconds) * 100);
}

/**
 * Calculate phase progress percentage
 */
export function calculatePhaseProgress(
    phaseTimeRemaining: number,
    phaseDuration: number
): number {
    if (phaseDuration <= 0) return 0;
    const elapsed = phaseDuration - phaseTimeRemaining;
    return Math.min(100, Math.max(0, (elapsed / phaseDuration) * 100));
}

// ============================================================================
// SESSION RESULT HELPERS
// ============================================================================

/**
 * Create a session result summary string
 */
export function createSessionSummary(result: SessionResult): string {
    const duration = Math.round(result.actualDurationMinutes);
    const intervals = result.intervalsCompleted ?? 0;
    const avgPower = result.averagePower ?? 0;

    if (result.sessionStyle === 'steady-state') {
        return `${duration}min @ ${avgPower}W`;
    }

    return `${intervals} intervals, ${duration}min total`;
}

/**
 * Validate session params are complete
 */
export function validateSessionParams(params: SessionSetupParams | null): boolean {
    if (!params) return false;
    if (!params.sessionStyle) return false;
    if (params.totalDurationMinutes <= 0) return false;
    if (params.targetPower <= 0) return false;
    return true;
}

// ============================================================================
// POWER ADJUSTMENT
// ============================================================================

/**
 * Apply power adjustment (harder/easier)
 */
export function adjustPower(
    currentPower: number,
    adjustment: number,
    minPower: number = 50,
    maxPower: number = 500
): number {
    const newPower = currentPower + adjustment;
    return Math.min(maxPower, Math.max(minPower, newPower));
}
