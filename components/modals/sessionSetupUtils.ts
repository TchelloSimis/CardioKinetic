/**
 * Session Setup Utilities
 * 
 * Helper functions for session parameter calculation, color manipulation,
 * and work/rest ratio adjustments used by the SessionSetupModal.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

// Fallback colors
export const DEFAULT_WORK_LIGHT = '#059669';  // darker green for work
export const DEFAULT_WORK_DARK = '#34d399';   // brighter green for work in dark
export const DEFAULT_REST_LIGHT = '#0284c7';  // blue for rest
export const DEFAULT_REST_DARK = '#38bdf8';   // bright blue for rest in dark

// RPE descriptions (aligned with exercise science standards)
// Includes 0.5 increments for slider precision
export const RPE_DESCRIPTIONS: Record<number, string> = {
    1: 'Minimum Effort - Bare minimum exertion; a gentle stroll. Could continue all day',
    1.5: 'Very Light - Barely noticeable effort, completely relaxed',
    2: 'Light and Easy - Non-taxing, easy to maintain conversation. Could continue for hours',
    2.5: 'Easy - Very light effort, breathing completely relaxed',
    3: 'Comfortable Pace - Able to maintain a conversation without getting out of breath',
    3.5: 'Light Moderate - Warming up, conversation still easy',
    4: 'Comfortable With Some Effort - Slight push, can speak a few sentences without struggling',
    4.5: 'Moderate - Breaking a light sweat, conversation comfortable',
    5: 'Progressive Pace - Requires some pushing to maintain; still able to hold a conversation',
    5.5: 'Moderate Hard - Effort noticeable, conversation becoming shorter',
    6: 'Hard Activity - Labored breathing, challenging but sustainable for 30-60 mins',
    6.5: 'Challenging - Breathing heavier, can still talk in short phrases',
    7: 'Vigorous Activity - Can speak in short sentences; becomes uncomfortable quickly',
    7.5: 'Very Challenging - Requires constant effort, speaking difficult',
    8: 'Hard Intensity - Requires focus to maintain; hard to say more than 2-3 words',
    8.5: 'Very Hard - Difficult to maintain, very heavy breathing',
    9: 'Very Hard Intensity - Hard to speak, breathing labored after a few seconds',
    9.5: 'Near Maximum - Can hardly speak, mental toughness required',
    10: 'All-Out Sprint - Maximum possible effort, sustainable for just 20-30 seconds',
};

// Import HR utilities at module level (required for Vite ESM)
import { getHeartRateBandForRPE, formatHeartRateBand } from '../../utils/rpeHeartRateUtils';

/**
 * Get RPE description with optional heart rate band
 * When age is provided, appends estimated HR range naturally to the description
 * 
 * @param rpe - RPE value (1-10, supports 0.5 increments)
 * @param age - User age in years (optional)
 * @returns Description string with HR band appended when age is provided
 */
export function getRPEDescriptionWithHeartRate(rpe: number, age: number | null): string {
    const baseDescription = RPE_DESCRIPTIONS[rpe] || RPE_DESCRIPTIONS[Math.round(rpe)] || "Adjust slider to see description.";

    if (age === null || age <= 0 || rpe < 1) {
        return baseDescription;
    }

    const band = getHeartRateBandForRPE(rpe, age);
    const formattedBand = formatHeartRateBand(band);

    return `${baseDescription} (${formattedBand})`;
}

// ============================================================================
// RATIO PARSING
// ============================================================================

/**
 * Parse work:rest ratio string into parts
 */
export const parseRatio = (ratio: string): { work: number; rest: number } => {
    if (ratio === 'steady' || ratio === '1:0') {
        return { work: 1, rest: 0 };
    }
    const parts = ratio.split(':').map(Number);
    return {
        work: parts[0] || 1,
        rest: parts[1] || 1
    };
};

/**
 * Round to nearest multiple of 5
 */
export const roundTo5 = (n: number): number => Math.round(n / 5) * 5;

/**
 * Calculate GCD for ratio simplification
 */
export const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Interpolate between two colors based on a 0-1 factor
 */
export const interpolateColor = (color1: string, color2: string, factor: number): string => {
    try {
        const hex = (c: string) => parseInt(c, 16);
        const r1 = hex(color1.slice(1, 3)), g1 = hex(color1.slice(3, 5)), b1 = hex(color1.slice(5, 7));
        const r2 = hex(color2.slice(1, 3)), g2 = hex(color2.slice(3, 5)), b2 = hex(color2.slice(5, 7));

        const r = Math.round(r1 + (r2 - r1) * factor);
        const g = Math.round(g1 + (g2 - g1) * factor);
        const b = Math.round(b1 + (b2 - b1) * factor);

        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    } catch {
        return color1;
    }
};

/**
 * Determine if a color is light (needs dark text) or dark (needs light text)
 */
export const isLightColor = (color: string): boolean => {
    try {
        const hex = color.replace('#', '');
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        // Using relative luminance formula - threshold at 0.55 for better contrast
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.55;
    } catch {
        return false;
    }
};

// ============================================================================
// WORK/REST ADJUSTMENT
// ============================================================================

/**
 * Adjust work/rest pair to meet a target cycle time change
 * Enforces 10s steps, 5s minimums, and balanced distribution
 */
export const adjustWorkRestPair = (work: number, rest: number, direction: 1 | -1): { work: number, rest: number } => {
    const currentTotal = work + rest;

    // Determine target total (snap to next 10s increment)
    // If direction is 1 (up), go to next multiple of 10
    // If direction is -1 (down), go to prev multiple of 10
    let targetTotal;
    if (direction === 1) {
        targetTotal = Math.floor(currentTotal / 10) * 10 + 10;
    } else {
        targetTotal = Math.ceil(currentTotal / 10) * 10 - 10;
    }

    // Clamp range 10s - 600s
    targetTotal = Math.min(600, Math.max(10, targetTotal));

    if (targetTotal === currentTotal) return { work, rest };

    let diff = targetTotal - currentTotal;
    let newWork = work;
    let newRest = rest;

    // Distribute difference
    // We deal in 5s chunks
    while (diff !== 0) {
        const step = diff > 0 ? 5 : -5;

        // If we can distribute to both (diff is 10, -10, 20 etc)
        if (Math.abs(diff) >= 10) {
            // Try to add/sub from both
            // Check constraints if reducing
            if (step < 0) {
                if (newWork + step >= 5 && newRest + step >= 5) {
                    newWork += step;
                    newRest += step;
                    diff -= step * 2;
                    continue;
                }
                // If we can't reduce both, fall through to single reduction
            } else {
                newWork += step;
                newRest += step;
                diff -= step * 2;
                continue;
            }
        }

        // Single 5s adjustment needed (or fallback from above)
        // If increasing (+5): Add to smaller to balance
        if (step > 0) {
            if (newWork <= newRest) newWork += step;
            else newRest += step;
        }
        // If decreasing (-5): Subtract from larger to balance
        else {
            if (newWork > newRest && newWork + step >= 5) newWork += step;
            else if (newRest + step >= 5) newRest += step;
            else if (newWork + step >= 5) newWork += step; // Fallback if rest was somehow chosen but hit limit
            else {
                // Cannot reduce further (both at 5s)
                break;
            }
        }
        diff -= step;
    }

    return { work: newWork, rest: newRest };
};

// ============================================================================
// FORMATTING
// ============================================================================

/**
 * Format duration in minutes to a human-readable string
 */
export const formatDuration = (mins: number): string => {
    const totalSeconds = Math.round(mins * 60);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m} min`;
};

/**
 * Get RPE color based on value (interpolates between readiness and fatigue colors)
 */
export const getRPEColor = (rpe: number, readinessColor: string, fatigueColor: string): string => {
    const factor = (rpe - 1) / 9;
    return interpolateColor(readinessColor, fatigueColor, factor);
};
