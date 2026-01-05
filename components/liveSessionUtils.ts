/**
 * Live Session Guide Utilities
 * 
 * Helper functions for time formatting, progress calculation, and chart data generation.
 */

import { SessionResult, SessionSetupParams, RpeLogEntry } from '../types';

// ============================================================================
// TIME FORMATTING
// ============================================================================

/**
 * Format seconds to MM:SS display
 */
export const formatTime = (seconds: number): string => {
    const mins = Math.floor(Math.max(0, seconds) / 60);
    const secs = Math.floor(Math.max(0, seconds) % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// ============================================================================
// PROGRESS CALCULATION
// ============================================================================

/**
 * Calculate progress percentage
 */
export const calculateProgress = (elapsed: number, total: number): number => {
    if (total <= 0) return 0;
    return Math.min(100, (elapsed / total) * 100);
};

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Generate a darker version of accent color for completion background
 */
export const getAccentDarkBg = (hex: string): string => {
    try {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        // Make it very dark (20% brightness)
        return `rgb(${Math.round(r * 0.15)}, ${Math.round(g * 0.15)}, ${Math.round(b * 0.15)})`;
    } catch {
        return 'rgb(15, 15, 15)';
    }
};

// ============================================================================
// CHART DATA TYPES
// ============================================================================

export interface ChartDataPoint {
    time: number;
    plannedPower?: number;
    actualPower?: number;
}

export interface RpeChartDataPoint {
    time: number;
    rpe: number;
}

export interface BlockBoundary {
    time: number;
    label: string;
}

export interface SessionChartData {
    actualData: Array<{ time: number; actualPower: number }>;
    plannedData: Array<{ time: number; plannedPower: number }>;
    blockBoundaries: BlockBoundary[];
    rpeData: RpeChartDataPoint[];
    targetRpe: number;
}

// ============================================================================
// RPE INTERPOLATION
// ============================================================================

/**
 * Interpolate RPE values between logged points
 * Uses linear interpolation with time-weighted sampling
 */
export const interpolateRpeData = (
    rpeHistory: RpeLogEntry[] | undefined,
    totalDurationSeconds: number,
    targetRpe: number
): RpeChartDataPoint[] => {
    if (!rpeHistory || rpeHistory.length === 0) {
        // No RPE logged - return empty (no line will be shown)
        return [];
    }

    const points: RpeChartDataPoint[] = [];
    const sampleInterval = 30; // Sample every 30 seconds for smooth curve

    // Sort history by time
    const sorted = [...rpeHistory].sort((a, b) => a.timeSeconds - b.timeSeconds);

    for (let t = 0; t <= totalDurationSeconds; t += sampleInterval) {
        const timeMinutes = Math.round(t / 60 * 10) / 10;

        // Find surrounding logged points
        const before = sorted.filter(p => p.timeSeconds <= t).pop();
        const after = sorted.find(p => p.timeSeconds > t);

        let interpolatedRpe: number;

        if (!before && !after) {
            // No data at all - use target
            interpolatedRpe = targetRpe;
        } else if (!before) {
            // Before first entry - use first value
            interpolatedRpe = after!.rpe;
        } else if (!after) {
            // After last entry - hold last value
            interpolatedRpe = before.rpe;
        } else {
            // Linear interpolation between points
            const ratio = (t - before.timeSeconds) / (after.timeSeconds - before.timeSeconds);
            interpolatedRpe = before.rpe + (after.rpe - before.rpe) * ratio;
        }

        points.push({
            time: timeMinutes,
            rpe: Math.round(interpolatedRpe * 10) / 10
        });
    }

    // Ensure we have an end point
    const endTime = Math.round(totalDurationSeconds / 60 * 10) / 10;
    if (points.length > 0 && points[points.length - 1].time < endTime) {
        const lastRpe = points[points.length - 1].rpe;
        points.push({ time: endTime, rpe: lastRpe });
    }

    return points;
};

// ============================================================================
// CHART DATA GENERATION
// ============================================================================

/**
 * Generate chart data for session completion screen
 * Creates both planned (original schedule) and actual (what happened) data
 */
export const generateSessionChartData = (
    params: SessionSetupParams | null,
    result: SessionResult | null | undefined,
    sessionTimeElapsed: number,
    targetPower: number,
    initialTargetPower: number | null
): SessionChartData => {
    // Calculate session duration
    let sessionDuration: number;
    if (params?.sessionStyle === 'custom' && params.blocks && params.blocks.length > 0) {
        sessionDuration = params.blocks.reduce((total, block) => total + block.durationMinutes * 60, 0);
    } else {
        sessionDuration = (result?.actualDurationMinutes || sessionTimeElapsed / 60 || params?.totalDurationMinutes || 2) * 60;
    }

    // Use INITIAL target power (stored at session start) to prevent chart changing with harder/easier
    const chartTargetPower = result?.initialTargetPower || initialTargetPower || params?.targetPower || targetPower;

    const origWork = params?.workDurationSeconds || 30;
    const origRest = params?.restDurationSeconds || 30;
    const origCycle = origWork + origRest;
    const recoveryRatio = 0.5;

    let origWorkPower = chartTargetPower;
    let origRestPower = origWorkPower;

    if (params?.sessionStyle === 'interval' && origCycle > 0) {
        origWorkPower = Math.round((chartTargetPower * origCycle) / (origWork + recoveryRatio * origRest));
        origRestPower = Math.round(origWorkPower * recoveryRatio);
    }

    // Generate PLANNED data and BLOCK BOUNDARIES
    const planned: Array<{ time: number; plannedPower: number }> = [];
    const boundaries: BlockBoundary[] = [];

    if (params?.sessionStyle === 'custom' && params.blocks && params.blocks.length > 0) {
        // Custom session: generate planned data from blocks
        let currentTime = 0;

        params.blocks.forEach((block, index) => {
            const blockDurationSeconds = block.durationMinutes * 60;
            const blockPower = Math.round(chartTargetPower * block.powerMultiplier);

            // Add block boundary (except for first block)
            if (index > 0) {
                boundaries.push({
                    time: Math.round(currentTime / 60 * 10) / 10,
                    label: block.type === 'steady-state' ? 'SS' : 'INT'
                });
            }

            if (block.type === 'steady-state') {
                // Only add start point - end point will be added by next block or final point
                planned.push({ time: Math.round(currentTime / 60 * 10) / 10, plannedPower: blockPower });
                currentTime += blockDurationSeconds;
            } else {
                const workSecs = block.workDurationSeconds || 30;
                const restSecs = block.restDurationSeconds || 30;
                const cycleSecs = workSecs + restSecs;

                const blockWorkPower = cycleSecs > 0
                    ? Math.round((blockPower * cycleSecs) / (workSecs + recoveryRatio * restSecs))
                    : blockPower;
                const blockRestPower = Math.round(blockWorkPower * recoveryRatio);

                const blockEndTime = currentTime + blockDurationSeconds;

                while (currentTime < blockEndTime) {
                    planned.push({ time: Math.round(currentTime / 60 * 10) / 10, plannedPower: blockWorkPower });
                    currentTime += workSecs;
                    if (currentTime >= blockEndTime) break;

                    planned.push({ time: Math.round(currentTime / 60 * 10) / 10, plannedPower: blockRestPower });
                    currentTime += restSecs;
                }

                currentTime = Math.min(currentTime, blockEndTime);
            }
        });

        // Add final end point to extend line to session end
        if (planned.length > 0) {
            const lastPower = planned[planned.length - 1]?.plannedPower || origWorkPower;
            const endTime = Math.round(sessionDuration / 60 * 10) / 10;
            const lastTime = planned[planned.length - 1]?.time || 0;
            // Only add if not already at end time
            if (lastTime < endTime) {
                planned.push({ time: endTime, plannedPower: lastPower });
            }
        }

    } else if (params?.sessionStyle === 'interval' && origCycle > 0) {
        let t = 0;
        while (t < sessionDuration) {
            planned.push({ time: Math.round(t / 60 * 10) / 10, plannedPower: origWorkPower });
            t += origWork;
            if (t >= sessionDuration) break;
            planned.push({ time: Math.round(t / 60 * 10) / 10, plannedPower: origRestPower });
            t += origRest;
        }
        planned.push({ time: Math.round(sessionDuration / 60 * 10) / 10, plannedPower: planned[planned.length - 1]?.plannedPower || origWorkPower });
    } else {
        planned.push({ time: 0, plannedPower: origWorkPower });
        planned.push({ time: Math.round(sessionDuration / 60 * 10) / 10, plannedPower: origWorkPower });
    }

    // Get ACTUAL data from power history
    let actual: Array<{ time: number; actualPower: number }> = [];
    if (result?.powerHistory && result.powerHistory.length > 0) {
        actual = result.powerHistory.map(p => ({
            time: Math.round(p.timeSeconds / 60 * 10) / 10,
            actualPower: p.power,
        }));
        const lastTime = actual[actual.length - 1]?.time || 0;
        const endTime = Math.round(sessionDuration / 60 * 10) / 10;
        if (lastTime < endTime) {
            actual.push({ time: endTime, actualPower: actual[actual.length - 1]?.actualPower || origWorkPower });
        }
    } else {
        actual.push({ time: 0, actualPower: result?.averagePower || targetPower });
        actual.push({ time: Math.round(sessionDuration / 60 * 10) / 10, actualPower: result?.averagePower || targetPower });
    }

    // Generate interpolated RPE data
    const sessionTargetRpe = result?.targetRPE || params?.targetRPE || 6;
    const rpeData = interpolateRpeData(
        result?.rpeHistory,
        sessionDuration,
        sessionTargetRpe
    );

    return {
        actualData: actual,
        plannedData: planned,
        blockBoundaries: boundaries,
        rpeData,
        targetRpe: sessionTargetRpe
    };
};
