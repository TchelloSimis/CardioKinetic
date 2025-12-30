/**
 * Auto-Adaptive Modifier System Types
 * 
 * Types for the automatic training adjustment system that uses
 * Monte Carlo simulation percentiles to dynamically adjust training.
 */

import { SessionBlock, SessionStyle } from '../types';

// ============================================================================
// PERCENTILE DATA TYPES
// ============================================================================

/**
 * Simulation percentile data for a single week.
 * Stores percentile thresholds for fatigue and readiness.
 * 
 * Threshold zones:
 * - P15/P85: Extreme deviation (top/bottom 15%)
 * - P25/P75: Moderate deviation (next 10%)
 * - P35/P65: Mild deviation (next 10%)
 * - P35-P65: Normal zone (middle 30%)
 */
export interface WeekPercentiles {
    // Fatigue percentiles (high = worse)
    fatigueP15: number;  // 15th percentile - extremely low fatigue (very good)
    fatigueP25: number;  // 25th percentile - moderately low fatigue
    fatigueP35: number;  // 35th percentile - mildly low fatigue
    fatigueP65: number;  // 65th percentile - mildly high fatigue
    fatigueP75: number;  // 75th percentile - moderately high fatigue
    fatigueP85: number;  // 85th percentile - extremely high fatigue (very bad)
    // Readiness percentiles (low = worse)
    readinessP15: number;  // 15th percentile - extremely low readiness (very bad)
    readinessP25: number;  // 25th percentile - moderately low readiness
    readinessP35: number;  // 35th percentile - mildly low readiness
    readinessP65: number;  // 65th percentile - mildly high readiness
    readinessP75: number;  // 75th percentile - moderately high readiness
    readinessP85: number;  // 85th percentile - extremely high readiness (very good)
}

/**
 * Complete simulation data for a program at a specific week length.
 */
export interface SimulationDataSet {
    weekCount: number;
    iterations: number;
    generatedAt: string;  // ISO timestamp
    weekPercentiles: WeekPercentiles[];  // Array length = weekCount
}

/**
 * Cached simulation data for a program template.
 * Stores data for each possible week length.
 */
export interface TemplateSimulationCache {
    templateId: string;
    dataByWeekCount: Record<number, SimulationDataSet>;
}

// ============================================================================
// ADJUSTMENT TYPES
// ============================================================================

/**
 * Block role within a custom session.
 * Identified by position and power characteristics.
 */
export type BlockRole = 'warmup' | 'main' | 'cooldown' | 'transition';

/**
 * Adjustment for a single block in a custom session.
 */
export interface BlockAdjustment {
    blockIndex: number;
    role: BlockRole;
    originalType: 'interval' | 'steady-state';
    powerMultiplier: number;
    // For interval blocks:
    restMultiplier?: number;
    cycleAdjust?: number;
    // For steady-state blocks:
    durationMultiplier?: number;
}

/**
 * Fatigue/readiness state classification.
 */
export type AdaptiveState =
    | 'critical'   // High fatigue + Low readiness
    | 'stressed'   // High fatigue + Normal readiness
    | 'tired'      // Normal fatigue + Low readiness
    | 'baseline'   // Normal fatigue + Normal readiness
    | 'fresh'      // Normal fatigue + High readiness
    | 'primed';    // Low fatigue + High readiness

/**
 * Deviation tier based on percentile comparison.
 */
export type DeviationTier = 'extreme' | 'moderate' | 'mild' | 'none';

/**
 * Deviation direction for a metric.
 */
export type DeviationDirection = 'high' | 'low' | 'normal';

/**
 * Auto-adaptive adjustment result.
 */
export interface AutoAdaptiveAdjustment {
    /** Whether any adjustment is active */
    isActive: boolean;
    /** The classified state */
    state: AdaptiveState;
    /** Deviation tier (extreme/moderate/none) */
    tier: DeviationTier;
    /** Fatigue deviation direction */
    fatigueDeviation: DeviationDirection;
    /** Readiness deviation direction */
    readinessDeviation: DeviationDirection;

    // Session-level adjustments (for interval/steady-state sessions):
    powerMultiplier: number;
    rpeAdjust: number;
    restMultiplier?: number;
    volumeMultiplier?: number;
    durationMultiplier?: number;

    // Block-level adjustments (for custom sessions only):
    blockAdjustments?: BlockAdjustment[];

    /** Message to display in Coach's Advice */
    message: string;
}

// ============================================================================
// PROGRESS TYPES
// ============================================================================

/**
 * Progress information for simulation generation.
 */
export interface SimulationProgress {
    currentWeekCount: number;
    totalWeekCounts: number;
    iterationsComplete: number;
    totalIterations: number;
    estimatedSecondsRemaining: number;
}

// ============================================================================
// SETTINGS TYPES
// ============================================================================

/**
 * Auto-adaptive settings stored in app preferences.
 */
export interface AutoAdaptiveSettings {
    /** Master toggle for auto-adaptive modifiers */
    enabled: boolean;
}

// ============================================================================
// HELPER TYPE GUARDS
// ============================================================================

/**
 * Check if a session style is custom.
 */
export function isCustomSession(sessionStyle: SessionStyle): boolean {
    return sessionStyle === 'custom';
}

/**
 * Check if adjustment has block-level changes.
 */
export function hasBlockAdjustments(adjustment: AutoAdaptiveAdjustment): boolean {
    return !!adjustment.blockAdjustments && adjustment.blockAdjustments.length > 0;
}
