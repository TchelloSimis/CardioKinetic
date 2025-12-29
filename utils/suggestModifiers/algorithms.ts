/**
 * Suggest Modifiers Module - Signal Processing Algorithms
 * 
 * Contains signal processing functions: smoothing, derivatives, percentiles,
 * CUSUM change-point detection, and extrema detection.
 */

// ============================================================================
// ADAPTIVE WINDOW SIZING
// ============================================================================

/**
 * Calculate adaptive window sizes based on program length.
 * 
 * Formula:
 * - localWindow = max(2, min(N-1, floor(N × 0.20)))  // ~20%, never exceeds N-1
 * - mesoWindow  = max(3, min(N, floor(N × 0.40)))    // ~40%, never exceeds N
 */
export function calculateAdaptiveWindows(programLength: number): { local: number; meso: number } {
    const N = programLength;

    const local = Math.max(2, Math.min(N - 1, Math.floor(N * 0.20)));
    const meso = Math.max(3, Math.min(N, Math.floor(N * 0.40)));

    return { local, meso };
}

// ============================================================================
// SIGNAL PROCESSING
// ============================================================================

/**
 * Savitzky-Golay style smoothing with adaptive window
 */
export function smoothSignal(data: number[], windowSize: number): number[] {
    if (data.length < windowSize) return [...data];

    const result: number[] = [];
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < data.length; i++) {
        let sum = 0;
        let count = 0;

        for (let j = -halfWindow; j <= halfWindow; j++) {
            const idx = i + j;
            if (idx >= 0 && idx < data.length) {
                const weight = halfWindow + 1 - Math.abs(j);
                sum += data[idx] * weight;
                count += weight;
            }
        }

        result.push(sum / count);
    }

    return result;
}

/**
 * Calculate first derivative (velocity)
 */
export function calculateDerivative(data: number[]): number[] {
    if (data.length < 2) return new Array(data.length).fill(0);

    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
        if (i === 0) {
            result.push(data[1] - data[0]);
        } else if (i === data.length - 1) {
            result.push(data[i] - data[i - 1]);
        } else {
            result.push((data[i + 1] - data[i - 1]) / 2);
        }
    }
    return result;
}

/**
 * Calculate percentile from array
 */
export function calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

// ============================================================================
// CUSUM CHANGE-POINT DETECTION
// ============================================================================

/**
 * Detect change points using CUSUM algorithm
 */
export function detectChangePoints(data: number[], threshold: number): number[] {
    if (data.length < 3) return [];

    const changePoints: number[] = [];
    let cusumPos = 0;
    let cusumNeg = 0;

    for (let i = 1; i < data.length; i++) {
        const diff = data[i] - data[i - 1];

        cusumPos = Math.max(0, cusumPos + diff - threshold * 0.3);
        cusumNeg = Math.min(0, cusumNeg + diff + threshold * 0.3);

        if (cusumPos > threshold) {
            changePoints.push(i);
            cusumPos = 0;
        }
        if (cusumNeg < -threshold) {
            changePoints.push(i);
            cusumNeg = 0;
        }
    }

    return changePoints;
}

/**
 * Detect local peaks and troughs
 */
export function detectExtrema(data: number[]): { peaks: number[]; troughs: number[] } {
    const peaks: number[] = [];
    const troughs: number[] = [];

    for (let i = 1; i < data.length - 1; i++) {
        if (data[i] > data[i - 1] + 2 && data[i] > data[i + 1] + 2) {
            peaks.push(i);
        }
        if (data[i] < data[i - 1] - 2 && data[i] < data[i + 1] - 2) {
            troughs.push(i);
        }
    }

    return { peaks, troughs };
}

// ============================================================================
// PHASE POSITION CALCULATION
// ============================================================================

import { CyclePhase, PhasePosition } from '../../programTemplate';
import { WeekAnalysis } from './types';

/**
 * Calculate position ratio and phase position for each week.
 * Groups consecutive weeks with the same cyclePhase and assigns
 * a position ratio (0=start, 1=end) within each group.
 * 
 * @param weekAnalyses - Array of week analysis objects with cyclePhase
 * @returns Array of position data for each week
 */
export function calculatePhasePositions(
    weekAnalyses: WeekAnalysis[]
): { positionRatio: number; phasePosition: PhasePosition }[] {
    const result: { positionRatio: number; phasePosition: PhasePosition }[] =
        new Array(weekAnalyses.length);

    let groupStart = 0;
    for (let i = 0; i < weekAnalyses.length; i++) {
        // Check if this is the end of a phase group
        const isEndOfGroup = i === weekAnalyses.length - 1 ||
            weekAnalyses[i].cyclePhase !== weekAnalyses[i + 1].cyclePhase;

        if (isEndOfGroup) {
            const groupLength = i - groupStart + 1;
            // Assign positions within this group
            for (let j = groupStart; j <= i; j++) {
                const ratio = groupLength === 1 ? 0.5 : (j - groupStart) / (groupLength - 1);
                const position: PhasePosition =
                    ratio < 0.33 ? 'early' :
                        ratio < 0.67 ? 'mid' : 'late';
                result[j] = { positionRatio: ratio, phasePosition: position };
            }
            groupStart = i + 1;
        }
    }

    return result;
}

/**
 * Calculate cumulative fatigue estimate based on position within ascending phase.
 * Early ascending = lower expected fatigue, late ascending = higher.
 * 
 * Models fatigue accumulation during ascending phases:
 * - Early weeks: expect baseline fatigue
 * - Late weeks: expect baseline + accumulated fatigue from training load
 * 
 * @param baselineFatigue - The base fatigue level for this phase
 * @param positionRatio - Position within phase (0=start, 1=end)
 * @param cyclePhase - The detected cycle phase
 * @param fatigueVelocity - Rate of change of fatigue
 * @returns Estimated cumulative fatigue at this position
 */
export function estimateCumulativeFatigue(
    baselineFatigue: number,
    positionRatio: number,
    cyclePhase: CyclePhase,
    fatigueVelocity: number
): number {
    if (cyclePhase !== 'ascending') return baselineFatigue;

    // Model: fatigue accumulates roughly linearly during ascending
    // Early (ratio ~0): expect ~baseline
    // Late (ratio ~1): expect ~baseline + accumulation factor
    // The accumulation factor is proportional to velocity (rate of fatigue buildup)
    const accumulationFactor = Math.max(0, fatigueVelocity) * 3;
    return baselineFatigue + (positionRatio * accumulationFactor);
}

/**
 * Adjust thresholds based on position within ascending phase.
 * 
 * Problem: All ascending weeks currently use the same thresholds, but:
 * - Early ascending weeks naturally have lower fatigue (just starting to build)
 * - Late ascending weeks naturally have higher fatigue (accumulated load)
 * 
 * Solution: Shift thresholds based on position
 * - Early: lower both thresholds (low fatigue is expected, don't trigger "push harder")
 * - Late: raise both thresholds (high fatigue is expected, don't trigger "back off")
 * 
 * @param p30 - 30th percentile threshold (low fatigue trigger)
 * @param p70 - 70th percentile threshold (high fatigue trigger)
 * @param positionRatio - Position within phase (0=start, 1=end)
 * @param cyclePhase - The detected cycle phase
 * @returns Adjusted thresholds
 */
export function adjustThresholdsForPosition(
    p30: number,
    p70: number,
    positionRatio: number,
    cyclePhase: CyclePhase
): { adjustedP30: number; adjustedP70: number } {
    if (cyclePhase !== 'ascending') {
        return { adjustedP30: p30, adjustedP70: p70 };
    }

    // Shift thresholds based on position
    // At position 0 (early): shift = -7.5 (lower thresholds)
    // At position 0.5 (mid): shift = 0 (no change)
    // At position 1 (late): shift = +7.5 (higher thresholds)
    const shiftFactor = (positionRatio - 0.5) * 15;

    return {
        adjustedP30: Math.max(5, Math.min(90, p30 + shiftFactor)),
        adjustedP70: Math.min(95, Math.max(10, p70 + shiftFactor))
    };
}

// ============================================================================
// EXPECTED PHASE COMPUTATION (DETERMINISTIC)
// ============================================================================

import { WeekDefinition } from '../../programTemplate';

/**
 * Compute effective work capacity for a week.
 * Combines power, duration, and RPE to get a single "load" metric.
 * Higher value = more demanding week.
 */
function computeWorkCapacity(week: WeekDefinition): number {
    const power = week.powerMultiplier || 1;

    // Handle duration - could be number or percentage string
    let durationFactor = 1;
    if (typeof week.durationMinutes === 'number') {
        durationFactor = week.durationMinutes / 15; // Normalize to 15min baseline
    } else if (typeof week.durationMinutes === 'string') {
        // Parse percentage like "110%"
        const match = week.durationMinutes.match(/(\d+)%/);
        if (match) durationFactor = parseFloat(match[1]) / 100;
    }

    // RPE factor - higher RPE = more work
    const rpe = week.targetRPE || 7;
    const rpeFactor = rpe / 7; // Normalize to RPE 7 baseline

    // Work = power × duration × RPE
    return power * durationFactor * rpeFactor;
}

/**
 * Check if phase name or description indicates a recovery/deload week.
 * Uses pattern matching instead of exact keywords for robustness.
 */
function isRecoveryIndicator(text: string | undefined): boolean {
    if (!text) return false;
    const lower = text.toLowerCase();

    // Recovery patterns
    const recoveryPatterns = [
        /\brecov/,     // recover, recovery, recovering
        /\bdeload/,    // deload, deloading
        /\brest\b/,    // rest (word boundary to avoid "restore")
        /\bease/,      // ease, easy, easing
        /\blight/,     // light, lighter
        /\bactive\s*rec/, // active recovery
        /\bdown\s*week/,  // down week
        /\btaper/,     // taper, tapering
        /\bunload/,    // unload, unloading
        /\bback\s*off/,   // back off
        /\brestore/,   // restore, restoration
        /\brefresh/,   // refresh
    ];

    return recoveryPatterns.some(pattern => pattern.test(lower));
}

/**
 * Check if phase name or description indicates a peak/intensity week.
 */
function isPeakIndicator(text: string | undefined): boolean {
    if (!text) return false;
    const lower = text.toLowerCase();

    const peakPatterns = [
        /\bpeak/,      // peak, peaking
        /\bmax/,       // max, maximum, maximal
        /\btest/,      // test, testing (fitness test)
        /\bfinal/,     // final week
        /\bcompet/,    // compete, competition
        /\brace/,      // race day
        /\bpr\b/,      // PR attempt
        /\bculmina/,   // culmination
        /\bclimax/,    // climax
    ];

    return peakPatterns.some(pattern => pattern.test(lower));
}

/**
 * Check if phase name indicates a build/ascending phase.
 */
function isBuildIndicator(text: string | undefined): boolean {
    if (!text) return false;
    const lower = text.toLowerCase();

    const buildPatterns = [
        /\bbuild/,     // build, building, builder
        /\bbase/,      // base, baseline
        /\bfound/,     // foundation, foundational
        /\baccumul/,   // accumulate, accumulation
        /\bload/,      // load, loading (but not deload)
        /\bprogress/,  // progress, progressive
        /\bintensif/,  // intensify, intensification
        /\boverload/,  // overload (stimulus)
        /\bstress/,    // stress week
    ];

    // Make sure it's not a deload
    if (/\bdeload/.test(lower)) return false;

    return buildPatterns.some(pattern => pattern.test(lower));
}

/**
 * Compute expected phase for a week using DETERMINISTIC signals.
 * 
 * Uses a robust multi-signal approach:
 * 1. Coach-declared focus (Recovery = trough, 100% reliable)
 * 2. Pattern matching on phase name and description
 * 3. Work trajectory (power × duration × RPE)
 * 4. Week position relative to program length
 * 
 * @param week - The week definition from template
 * @param weekNumber - Current week number (1-indexed)
 * @param totalWeeks - Total weeks in program
 * @param prevWeek - Previous week definition (if available)
 * @param nextWeek - Next week definition (if available)
 * @returns Deterministic expected phase
 */
export function computeExpectedPhase(
    week: WeekDefinition,
    weekNumber: number,
    totalWeeks: number,
    prevWeek?: WeekDefinition,
    nextWeek?: WeekDefinition
): CyclePhase {
    // Priority 1: Coach-declared focus (100% reliable)
    if (week.focus === 'Recovery') return 'trough';

    // Priority 2: Pattern matching on phase name and description
    const textToCheck = `${week.phaseName || ''} ${week.description || ''}`;

    if (isRecoveryIndicator(textToCheck)) {
        return 'trough';
    }
    if (isPeakIndicator(textToCheck)) {
        return 'peak';
    }

    // Priority 3: Work trajectory analysis
    const currentWork = computeWorkCapacity(week);
    const prevWork = prevWeek ? computeWorkCapacity(prevWeek) : undefined;
    const nextWork = nextWeek ? computeWorkCapacity(nextWeek) : undefined;

    // Calculate relative changes
    const workChangePrev = prevWork !== undefined ? (currentWork - prevWork) / prevWork : 0;
    const workChangeNext = nextWork !== undefined ? (nextWork - currentWork) / currentWork : 0;

    // Significant work drop from previous = recovery phase
    if (workChangePrev < -0.15) {
        // We dropped significantly - are we recovering or continuing down?
        return workChangeNext >= 0 ? 'trough' : 'descending';
    }

    // Significant work increase = ascending
    if (workChangePrev > 0.10) {
        return 'ascending';
    }

    // Work about to drop significantly = peak
    if (workChangeNext < -0.15 && currentWork >= 1.0) {
        return 'peak';
    }

    // Priority 4: Focus-based inference
    if (week.focus === 'Intensity' || week.focus === 'Density') {
        // High intensity focus near end = peak, otherwise ascending
        const isNearEnd = weekNumber / totalWeeks > 0.7;
        return isNearEnd && workChangeNext <= 0 ? 'peak' : 'ascending';
    }

    // Priority 5: Week position in program
    const progress = weekNumber / totalWeeks;

    if (progress <= 0.25) {
        // First quarter: ascending (build phase)
        return 'ascending';
    }
    if (progress >= 0.9) {
        // Final 10%: likely peak or end
        return 'peak';
    }

    // Priority 6: Building phase indicator
    if (isBuildIndicator(textToCheck)) {
        return 'ascending';
    }

    // Default: ascending (most programs are progressive)
    return 'ascending';
}




