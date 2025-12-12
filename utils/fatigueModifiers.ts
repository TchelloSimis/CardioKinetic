/**
 * Fatigue Modifiers
 * 
 * Functions for checking fatigue conditions and applying dynamic adjustments
 * to training plans based on athlete state.
 */

import { PlanWeek } from '../types';
import { FatigueModifier, FatigueCondition, FatigueContext } from '../programTemplate';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Fatigue condition thresholds */
export const FATIGUE_THRESHOLDS = {
    low_fatigue: { max: 30 },
    moderate_fatigue: { min: 30, max: 60 },
    high_fatigue: { min: 60, max: 80 },
    very_high_fatigue: { min: 80 },
} as const;

/** Readiness condition thresholds */
export const READINESS_THRESHOLDS = {
    fresh: { min: 65 },
    recovered: { min: 50, max: 65 },
    tired: { min: 35, max: 50 },
    overreached: { max: 35 },
} as const;

// ============================================================================
// FATIGUE CONDITION CHECKING
// ============================================================================

/**
 * Checks if a fatigue condition is currently active
 */
export function checkFatigueCondition(condition: FatigueCondition, context: FatigueContext): boolean {
    const { fatigueScore, readinessScore } = context;

    // Handle FlexibleCondition objects
    if (typeof condition === 'object' && condition !== null) {
        const flexCond = condition as { fatigue?: string; readiness?: string; logic: 'and' | 'or' };

        const checkThreshold = (threshold: string | undefined, score: number): boolean | null => {
            if (!threshold) return null; // No threshold defined

            // Parse operator and value (e.g., ">50", "<30", ">=40", "<=60", or just "50")
            const match = threshold.match(/^(>=|<=|>|<)?(\d+)$/);
            if (!match) return null;

            const operator = match[1] || '>='; // Default to >= if no operator
            const value = parseInt(match[2], 10);

            switch (operator) {
                case '>': return score > value;
                case '<': return score < value;
                case '>=': return score >= value;
                case '<=': return score <= value;
                default: return score >= value;
            }
        };

        const fatigueResult = checkThreshold(flexCond.fatigue, fatigueScore);
        const readinessResult = checkThreshold(flexCond.readiness, readinessScore);

        // Apply logic
        if (flexCond.logic === 'and') {
            // Both must pass (if defined)
            if (fatigueResult === false || readinessResult === false) return false;
            return (fatigueResult === true || fatigueResult === null) &&
                (readinessResult === true || readinessResult === null);
        } else {
            // Either can pass (OR logic)
            return fatigueResult === true || readinessResult === true;
        }
    }

    // Handle legacy string conditions
    switch (condition) {
        case 'low_fatigue':
            return fatigueScore < FATIGUE_THRESHOLDS.low_fatigue.max;
        case 'moderate_fatigue':
            return fatigueScore >= FATIGUE_THRESHOLDS.moderate_fatigue.min &&
                fatigueScore < FATIGUE_THRESHOLDS.moderate_fatigue.max;
        case 'high_fatigue':
            return fatigueScore >= FATIGUE_THRESHOLDS.high_fatigue.min &&
                fatigueScore < FATIGUE_THRESHOLDS.high_fatigue.max;
        case 'very_high_fatigue':
            return fatigueScore >= FATIGUE_THRESHOLDS.very_high_fatigue.min;
        case 'fresh':
            return readinessScore >= READINESS_THRESHOLDS.fresh.min;
        case 'recovered':
            return readinessScore >= READINESS_THRESHOLDS.recovered.min &&
                readinessScore < READINESS_THRESHOLDS.recovered.max;
        case 'tired':
            return readinessScore >= READINESS_THRESHOLDS.tired.min &&
                readinessScore < READINESS_THRESHOLDS.tired.max;
        case 'overreached':
            return readinessScore < READINESS_THRESHOLDS.overreached.max;
        default:
            return false;
    }
}

// ============================================================================
// MODIFIER APPLICATION
// ============================================================================

/**
 * Applies fatigue modifiers to a plan week based on current athlete state.
 * Only ONE modifier triggers per session - the highest priority (lowest number) matching modifier wins.
 */
export function applyFatigueModifiers(
    week: PlanWeek,
    context: FatigueContext,
    modifiers: FatigueModifier[]
): { week: PlanWeek; messages: string[] } {
    let modifiedWeek = { ...week };
    const messages: string[] = [];

    // Collect all matching modifiers with their priorities
    const matchingModifiers: { modifier: FatigueModifier; priority: number }[] = [];

    for (const modifier of modifiers) {
        // Check fatigue condition first
        if (!checkFatigueCondition(modifier.condition, context)) {
            continue;
        }

        // Check phase condition if specified
        if (modifier.phase !== undefined) {
            const phasesToMatch = Array.isArray(modifier.phase) ? modifier.phase : [modifier.phase];
            if (context.phase && !phasesToMatch.includes(context.phase)) {
                continue; // Skip if current phase doesn't match
            }
        }

        // Check week position condition if specified (supports relative positioning for variable-length programs)
        if (modifier.weekPosition !== undefined && context.weekNumber !== undefined && context.totalWeeks !== undefined) {
            const positions = Array.isArray(modifier.weekPosition) ? modifier.weekPosition : [modifier.weekPosition];
            const currentWeek = context.weekNumber;
            const total = context.totalWeeks;
            // Use floor semantics: progress where week 1 = 0, week N = 1
            const progress = total > 1 ? (currentWeek - 1) / (total - 1) : 0;

            let matchesAny = false;
            for (const pos of positions) {
                if (pos === 'first' && currentWeek === 1) {
                    matchesAny = true;
                    break;
                }
                if (pos === 'last' && currentWeek === total) {
                    matchesAny = true;
                    break;
                }
                if (pos === 'early' && progress <= 0.33) {
                    matchesAny = true;
                    break;
                }
                if (pos === 'mid' && progress > 0.33 && progress <= 0.66) {
                    matchesAny = true;
                    break;
                }
                if (pos === 'late' && progress > 0.66) {
                    matchesAny = true;
                    break;
                }

                if (typeof pos === 'string') {
                    // Handle comparison operators with percentages (e.g., ">50%", "<33.33%")
                    const compPercentMatch = pos.match(/^([><])(\d+(?:\.\d+)?)%$/);
                    if (compPercentMatch) {
                        const op = compPercentMatch[1];
                        const targetPercent = parseFloat(compPercentMatch[2]) / 100;
                        if (op === '>' && progress > targetPercent) {
                            matchesAny = true;
                            break;
                        }
                        if (op === '<' && progress < targetPercent) {
                            matchesAny = true;
                            break;
                        }
                        continue;
                    }

                    // Handle comparison operators with week numbers (e.g., ">5", "<10")
                    const compWeekMatch = pos.match(/^([><])(\d+)$/);
                    if (compWeekMatch) {
                        const op = compWeekMatch[1];
                        const targetWeek = parseInt(compWeekMatch[2]);
                        if (op === '>' && currentWeek > targetWeek) {
                            matchesAny = true;
                            break;
                        }
                        if (op === '<' && currentWeek < targetWeek) {
                            matchesAny = true;
                            break;
                        }
                        continue;
                    }

                    // Handle exact percentage positions like '25%', '50%', '75%', '33.3333%'
                    if (pos.endsWith('%')) {
                        const targetPercent = parseFloat(pos.slice(0, -1)) / 100;
                        // Use floor semantics: 33.33% starts at week = 1 + 0.3333 × (total - 1)
                        const targetWeek = 1 + targetPercent * (total - 1);
                        // Allow ±0.5 week tolerance for percentage matches (effectively same week)
                        if (Math.abs(currentWeek - targetWeek) <= 0.5) {
                            matchesAny = true;
                            break;
                        }
                    }
                }
            }

            if (!matchesAny) {
                continue; // Skip if week position doesn't match
            }
        }

        // All conditions passed - add to matching modifiers
        const priority = modifier.priority ?? 0;
        matchingModifiers.push({ modifier, priority });
    }

    // Sort by priority (lower number = higher priority) and pick only the first one
    if (matchingModifiers.length > 0) {
        matchingModifiers.sort((a, b) => a.priority - b.priority);
        const bestMatch = matchingModifiers[0];
        const adj = bestMatch.modifier.adjustments;

        // Apply adjustments from the single highest-priority modifier
        if (adj.powerMultiplier !== undefined) {
            modifiedWeek.plannedPower = Math.round(modifiedWeek.plannedPower * adj.powerMultiplier);
        }

        if (adj.rpeAdjust !== undefined) {
            modifiedWeek.targetRPE = Math.max(1, Math.min(10, modifiedWeek.targetRPE + adj.rpeAdjust));
        }

        if (adj.restMultiplier !== undefined && modifiedWeek.restDurationSeconds) {
            modifiedWeek.restDurationSeconds = Math.round(modifiedWeek.restDurationSeconds * adj.restMultiplier);
        }

        if (adj.volumeMultiplier !== undefined && modifiedWeek.targetDurationMinutes) {
            modifiedWeek.targetDurationMinutes = Math.round(modifiedWeek.targetDurationMinutes * adj.volumeMultiplier);
        }

        if (adj.message) {
            messages.push(adj.message);
        }
    }

    return { week: modifiedWeek, messages };
}
