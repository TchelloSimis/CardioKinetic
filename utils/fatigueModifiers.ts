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

import { AutoAdaptiveAdjustment, BlockAdjustment } from './autoAdaptiveTypes';

// ============================================================================
// MODIFIER APPLICATION
// ============================================================================

/**
 * Applies fatigue modifiers to a plan week based on current athlete state.
 * Only ONE modifier triggers per session - the highest priority (lowest number) matching modifier wins.
 * 
 * Auto-adaptive adjustments are applied ONLY if no coach-created modifier matches.
 * This ensures coach modifiers always take priority.
 * 
 * @param week - The plan week to modify
 * @param context - Current fatigue/readiness context
 * @param modifiers - Coach-created fatigue modifiers
 * @param autoAdaptiveAdjustment - Optional auto-adaptive adjustment (applied if no coach modifiers match)
 */
export function applyFatigueModifiers(
    week: PlanWeek,
    context: FatigueContext,
    modifiers: FatigueModifier[],
    autoAdaptiveAdjustment?: AutoAdaptiveAdjustment
): { week: PlanWeek; messages: string[]; isAutoAdaptive: boolean } {
    let modifiedWeek = { ...week };
    const messages: string[] = [];
    let isAutoAdaptive = false;

    // Collect all matching modifiers with their priorities
    const matchingModifiers: { modifier: FatigueModifier; priority: number }[] = [];

    for (const modifier of modifiers) {
        // Check fatigue condition first
        if (!checkFatigueCondition(modifier.condition, context)) {
            continue;
        }

        // Check phase condition if specified (WeekFocus type)
        if (modifier.phase !== undefined) {
            const phasesToMatch = Array.isArray(modifier.phase) ? modifier.phase : [modifier.phase];
            if (context.phase && !phasesToMatch.includes(context.phase)) {
                continue; // Skip if current phase doesn't match
            }
        }

        // Check phaseName condition if specified (string type for phase names like "Build Phase")
        if (modifier.phaseName !== undefined) {
            const phaseNamesToMatch = Array.isArray(modifier.phaseName) ? modifier.phaseName : [modifier.phaseName];
            if (!context.phaseName || !phaseNamesToMatch.includes(context.phaseName)) {
                continue; // Skip if current phaseName doesn't match
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

        // Check sessionType condition if specified (allows different strategies per session type)
        if (modifier.sessionType !== undefined && week.sessionStyle) {
            const sessionTypesToMatch = Array.isArray(modifier.sessionType) ? modifier.sessionType : [modifier.sessionType];
            if (!sessionTypesToMatch.includes(week.sessionStyle)) {
                continue; // Skip if session type doesn't match
            }
        }

        // All conditions passed - add to matching modifiers
        const priority = modifier.priority ?? 0;
        matchingModifiers.push({ modifier, priority });
    }
    // MUTEX-AWARE SELECTION:
    // - For each mutex group, only the highest priority wins
    // - Non-mutex modifiers compete globally (only one wins across all non-mutex)

    if (matchingModifiers.length > 0) {
        // Sort all by priority (lower number = higher priority)
        matchingModifiers.sort((a, b) => {
            // First by mutexRank (higher rank wins within same group)
            const rankA = a.modifier.mutexRank ?? 0;
            const rankB = b.modifier.mutexRank ?? 0;
            if (rankB !== rankA) return rankB - rankA;
            // Then by priority (lower = higher priority)
            return a.priority - b.priority;
        });

        // Track which mutex groups have been satisfied
        const mutexWinners = new Map<string, typeof matchingModifiers[0]>();
        let globalWinner: typeof matchingModifiers[0] | null = null;

        for (const match of matchingModifiers) {
            const group = match.modifier.mutexGroup;

            if (group) {
                // Mutex modifier - only one per group
                if (!mutexWinners.has(group)) {
                    mutexWinners.set(group, match);
                }
                // Skip if group already has a winner
            } else {
                // Non-mutex modifier - only first one wins
                if (!globalWinner) {
                    globalWinner = match;
                }
            }
        }

        // Collect all modifiers to apply:
        // - One winner per mutex group
        // - One global winner for non-mutex (if any)
        const toApply: typeof matchingModifiers = [];
        for (const winner of mutexWinners.values()) {
            toApply.push(winner);
        }
        if (globalWinner) {
            toApply.push(globalWinner);
        }

        // Apply all winners (typically 1-3 modifiers max)
        for (const { modifier: bestMatch } of toApply) {
            const adj = bestMatch.adjustments;

            // Apply adjustments from the single highest-priority modifier
            if (adj.powerMultiplier !== undefined) {
                modifiedWeek.plannedPower = Math.round(modifiedWeek.plannedPower * adj.powerMultiplier);
            }

            if (adj.rpeAdjust !== undefined) {
                modifiedWeek.targetRPE = Math.max(1, Math.min(10, modifiedWeek.targetRPE + adj.rpeAdjust));
            }

            // REST MULTIPLIER: Only for interval-based sessions (which have rest periods)
            if (adj.restMultiplier !== undefined) {
                // For interval sessions at the week level
                if (modifiedWeek.restDurationSeconds) {
                    modifiedWeek.restDurationSeconds = Math.round(modifiedWeek.restDurationSeconds * adj.restMultiplier);
                }
                // For custom sessions with interval blocks
                if (modifiedWeek.blocks && modifiedWeek.blocks.length > 0) {
                    modifiedWeek.blocks = modifiedWeek.blocks.map(block => {
                        if (block.type === 'interval' && block.restDurationSeconds) {
                            return {
                                ...block,
                                restDurationSeconds: Math.round(block.restDurationSeconds * adj.restMultiplier!)
                            };
                        }
                        return block;
                    });
                }
            }

            // DURATION MULTIPLIER: For steady-state sessions/blocks (no rest periods)
            if (adj.durationMultiplier !== undefined) {
                if (modifiedWeek.sessionStyle === 'steady-state' && modifiedWeek.targetDurationMinutes) {
                    modifiedWeek.targetDurationMinutes = modifiedWeek.targetDurationMinutes * adj.durationMultiplier;
                }
                // For custom sessions with steady-state blocks
                if (modifiedWeek.blocks && modifiedWeek.blocks.length > 0) {
                    modifiedWeek.blocks = modifiedWeek.blocks.map(block => {
                        if (block.type === 'steady-state') {
                            return {
                                ...block,
                                durationMinutes: block.durationMinutes * adj.durationMultiplier!
                            };
                        }
                        return block;
                    });
                    // Recalculate total duration from blocks
                    modifiedWeek.targetDurationMinutes = modifiedWeek.blocks.reduce(
                        (total, block) => total + block.durationMinutes, 0
                    );
                }
            }

            // VOLUME MULTIPLIER: Affects cycle count for intervals, duration for steady-state
            if (adj.volumeMultiplier !== undefined) {
                // Handle custom session blocks
                if (modifiedWeek.blocks && modifiedWeek.blocks.length > 0) {
                    modifiedWeek.blocks = modifiedWeek.blocks.map(block => {
                        const modifiedBlock = { ...block };

                        if (block.type === 'interval' && block.cycles !== undefined) {
                            // For interval blocks: round cycles to nearest integer
                            modifiedBlock.cycles = Math.round(block.cycles * adj.volumeMultiplier!);
                            // Recalculate durationMinutes based on new cycles
                            const workSeconds = block.workDurationSeconds || 30;
                            const restSeconds = block.restDurationSeconds || 30;
                            modifiedBlock.durationMinutes = (modifiedBlock.cycles * (workSeconds + restSeconds)) / 60;
                        } else {
                            // For steady-state blocks: apply multiplier without rounding
                            modifiedBlock.durationMinutes = block.durationMinutes * adj.volumeMultiplier!;
                        }

                        return modifiedBlock;
                    });

                    // Recalculate targetDurationMinutes based on modified blocks
                    modifiedWeek.targetDurationMinutes = modifiedWeek.blocks.reduce(
                        (total, block) => total + block.durationMinutes, 0
                    );
                } else if (modifiedWeek.sessionStyle === 'interval' && modifiedWeek.cycles !== undefined) {
                    // For interval sessions with explicit cycles: round cycles to nearest integer
                    const originalCycles = modifiedWeek.cycles;
                    modifiedWeek.cycles = Math.round(originalCycles * adj.volumeMultiplier);
                    // Recalculate duration from modified cycles
                    const workSeconds = modifiedWeek.workDurationSeconds || 30;
                    const restSeconds = modifiedWeek.restDurationSeconds || 30;
                    modifiedWeek.targetDurationMinutes = (modifiedWeek.cycles * (workSeconds + restSeconds)) / 60;
                } else if (modifiedWeek.targetDurationMinutes) {
                    // Non-custom sessions without cycles: apply to targetDurationMinutes directly
                    modifiedWeek.targetDurationMinutes = Math.round(modifiedWeek.targetDurationMinutes * adj.volumeMultiplier);
                }
            }

            if (adj.message) {
                messages.push(adj.message);
            }
        }

        return { week: modifiedWeek, messages, isAutoAdaptive: false };
    }

    // No coach modifiers matched - apply auto-adaptive adjustment if available
    if (autoAdaptiveAdjustment && autoAdaptiveAdjustment.isActive) {
        const adj = autoAdaptiveAdjustment;

        // Apply session-level adjustments
        if (adj.powerMultiplier !== 1.0) {
            modifiedWeek.plannedPower = Math.round(modifiedWeek.plannedPower * adj.powerMultiplier);
        }

        if (adj.rpeAdjust !== 0) {
            modifiedWeek.targetRPE = Math.max(1, Math.min(10, modifiedWeek.targetRPE + adj.rpeAdjust));
        }

        // Apply rest multiplier for interval sessions
        if (adj.restMultiplier !== undefined && adj.restMultiplier !== 1.0) {
            if (modifiedWeek.restDurationSeconds) {
                modifiedWeek.restDurationSeconds = Math.round(modifiedWeek.restDurationSeconds * adj.restMultiplier);
            }
        }

        // Apply duration multiplier for steady-state sessions
        if (adj.durationMultiplier !== undefined && adj.durationMultiplier !== 1.0) {
            if (modifiedWeek.sessionStyle === 'steady-state' && modifiedWeek.targetDurationMinutes) {
                modifiedWeek.targetDurationMinutes = modifiedWeek.targetDurationMinutes * adj.durationMultiplier;
            }
        }

        // Apply block-level adjustments for custom sessions
        if (adj.blockAdjustments && adj.blockAdjustments.length > 0 && modifiedWeek.blocks) {
            modifiedWeek.blocks = modifiedWeek.blocks.map((block, index) => {
                const blockAdj = adj.blockAdjustments!.find(ba => ba.blockIndex === index);
                if (!blockAdj || blockAdj.role === 'warmup' || blockAdj.role === 'cooldown') {
                    return block; // Preserve warmup/cooldown blocks
                }

                const modifiedBlock = { ...block };

                // Apply power adjustment
                if (blockAdj.powerMultiplier !== 1.0) {
                    modifiedBlock.powerMultiplier = block.powerMultiplier * blockAdj.powerMultiplier;
                }

                // Apply rest multiplier for interval blocks
                if (block.type === 'interval' && blockAdj.restMultiplier && blockAdj.restMultiplier !== 1.0) {
                    if (modifiedBlock.restDurationSeconds) {
                        modifiedBlock.restDurationSeconds = Math.round(block.restDurationSeconds! * blockAdj.restMultiplier);
                    }
                }

                // Apply duration multiplier for steady-state blocks
                if (block.type === 'steady-state' && blockAdj.durationMultiplier && blockAdj.durationMultiplier !== 1.0) {
                    modifiedBlock.durationMinutes = block.durationMinutes * blockAdj.durationMultiplier;
                }

                return modifiedBlock;
            });

            // Recalculate total duration from blocks
            modifiedWeek.targetDurationMinutes = modifiedWeek.blocks.reduce(
                (total, block) => total + block.durationMinutes, 0
            );
        }

        // Add the auto-adaptive message to Coach's Advice
        if (adj.message) {
            messages.push(adj.message);
            isAutoAdaptive = true;
        }
    }

    return { week: modifiedWeek, messages, isAutoAdaptive };
}
