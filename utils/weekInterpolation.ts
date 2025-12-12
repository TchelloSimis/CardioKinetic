/**
 * Week Interpolation
 * 
 * Functions for resolving week positions and interpolating week definitions
 * across variable-length program templates.
 */

import { WeekDefinition, WeekPosition } from '../programTemplate';

/**
 * Resolves a WeekPosition to an actual week number given the total program length
 * 
 * Percentages are treated as "progress through the program":
 * - 0% = week 1 (first week)
 * - 100% = week N (last week)
 * - 50% = week at the halfway point
 * 
 * Formula: week = 1 + percentage × (totalWeeks - 1)
 */
export function resolveWeekPosition(position: WeekPosition, totalWeeks: number): number {
    if (typeof position === 'number') {
        return Math.min(position, totalWeeks);
    }

    if (position === 'first') {
        return 1;
    }

    if (position === 'last') {
        return totalWeeks;
    }

    // Percentage position (e.g., "50%" or "33.33333%" for arbitrary precision)
    // Treat percentage as "progress through the program" where 0% = week 1, 100% = week N
    const match = position.match(/^(\d+(?:\.\d+)?)%$/);
    if (match) {
        const percentage = parseFloat(match[1]) / 100;
        // Formula: 1 + percentage × (totalWeeks - 1)
        // For 12 weeks: 0% → 1, 33% → 1 + 0.33 × 11 ≈ 4.63 → 5, 66% → 1 + 0.66 × 11 ≈ 8.26 → 8
        // For 9 weeks: 0% → 1, 33% → 1 + 0.33 × 8 ≈ 3.64 → 4, 66% → 1 + 0.66 × 8 ≈ 6.28 → 6
        const weekNum = 1 + percentage * (totalWeeks - 1);
        return Math.max(1, Math.min(totalWeeks, Math.round(weekNum)));
    }

    return 1; // Fallback
}

/**
 * Generates all week numbers from template week definitions for a given program length
 * Uses progress-based floor semantics: each definition "owns" all weeks from its progress point
 * until the next definition starts.
 * 
 * This approach works with progress fractions (0 to 1) directly, avoiding rounding issues
 * that occur when resolving percentages to week numbers.
 */
export function interpolateWeeks(
    weekDefs: WeekDefinition[],
    totalWeeks: number
): Map<number, WeekDefinition> {
    // Convert all week definitions to progress values (0 to 1) and sort them
    const defsWithProgress = [...weekDefs]
        .map(def => {
            let defProgress = 0;
            if (def.position === 'first') {
                defProgress = 0;
            } else if (def.position === 'last') {
                defProgress = 1;
            } else if (typeof def.position === 'string' && def.position.endsWith('%')) {
                defProgress = parseFloat(def.position) / 100;
            } else if (typeof def.position === 'number') {
                // Convert absolute week number to progress
                defProgress = totalWeeks > 1 ? (def.position - 1) / (totalWeeks - 1) : 0;
            }
            return { def, defProgress };
        })
        .sort((a, b) => a.defProgress - b.defProgress);

    const weekMap = new Map<number, WeekDefinition>();

    // For each week, find the definition that "owns" it using progress-based floor semantics
    for (let week = 1; week <= totalWeeks; week++) {
        // Calculate this week's progress (0 to 1), where week 1 = 0 and week N = 1
        const weekProgress = totalWeeks > 1 ? (week - 1) / (totalWeeks - 1) : 0;

        // Find the definition with highest progress <= current week's progress (floor)
        let owningDef: WeekDefinition | null = defsWithProgress.length > 0 ? defsWithProgress[0].def : null;
        for (const { def, defProgress } of defsWithProgress) {
            if (defProgress <= weekProgress) {
                owningDef = def;
            } else {
                break; // Since sorted, no need to check further
            }
        }

        if (owningDef) {
            weekMap.set(week, { ...owningDef, position: week });
        }
    }

    return weekMap;
}

/**
 * Interpolates between two week definitions
 */
export function interpolateWeekDefinition(
    prev: WeekDefinition,
    next: WeekDefinition,
    t: number, // 0 to 1
    weekNum: number
): WeekDefinition {
    return {
        position: weekNum,
        // Use the transition point to decide which phase we're in
        phaseName: t < 0.5 ? prev.phaseName : next.phaseName,
        focus: t < 0.5 ? prev.focus : next.focus,
        description: t < 0.5 ? prev.description : next.description,
        // Numerical values are linearly interpolated
        powerMultiplier: prev.powerMultiplier + t * (next.powerMultiplier - prev.powerMultiplier),
        targetRPE: Math.round(prev.targetRPE + t * (next.targetRPE - prev.targetRPE)),
        workRestRatio: t < 0.5 ? prev.workRestRatio : next.workRestRatio,
        // Optional fields
        sessionStyle: t < 0.5 ? prev.sessionStyle : next.sessionStyle,
        // Duration can be a number or string (percentage) - just carry forward, don't interpolate percentages
        durationMinutes: t < 0.5 ? prev.durationMinutes : next.durationMinutes,
    };
}
