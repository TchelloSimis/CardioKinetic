/**
 * Suggest Modifiers Module - Constants and Types
 * 
 * Contains all constants and TypeScript interfaces used across the modifier suggestion system.
 * Note: Legacy EWMA constants (ATL_ALPHA, CTL_ALPHA, etc.) have been removed.
 *       The system now uses the Chronic Fatigue Model (dual-compartment) from chronicFatigueModel.ts
 */

// ============================================================================
// CONSTANTS
// ============================================================================

// Simulation defaults
export const DEFAULT_SESSION_DURATION = 15;
export const DEFAULT_SESSIONS_PER_WEEK_MIN = 2;
export const DEFAULT_SESSIONS_PER_WEEK_MAX = 4;

// Percentile thresholds
// Standard tier (30th-70th interval) - for moderate deviations
export const P30 = 30;
export const P50 = 50;
export const P70 = 70;
// Extreme tier (15th-85th interval) - for significant deviations
export const P15 = 15;
export const P85 = 85;

// ============================================================================
// TYPES
// ============================================================================

export interface WeekAnalysis {
    weekNumber: number;
    phaseName: string;
    powerMultiplier: number;

    // Percentiles from simulation
    fatigueP15: number;
    fatigueP30: number;
    fatigueP50: number;
    fatigueP70: number;
    fatigueP85: number;
    readinessP15: number;
    readinessP30: number;
    readinessP50: number;
    readinessP70: number;
    readinessP85: number;

    // Derivatives
    fatigueVelocity: number;
    fatigueAcceleration: number;

    // Cycle context
    cycleIndex: number;

    // Position within phase (for position-aware thresholds)
    positionRatio?: number;

    // Flags
    isLocalPeak: boolean;
    isLocalTrough: boolean;
}

export interface TrendAnalysis {
    weekAnalyses: WeekAnalysis[];
    detectedCycles: CycleInfo[];
    globalTrend: 'improving' | 'stable' | 'declining';
    adaptationScore: number;
    adaptiveWindows: { local: number; meso: number };
}

export interface CycleInfo {
    index: number;
    startWeek: number;
    endWeek: number;
    peakWeek: number | null;
    troughWeek: number | null;
    avgFatigue: number;
    avgReadiness: number;
}
