/**
 * Fatigue Modifiers
 * 
 * Functions for checking fatigue conditions and applying dynamic adjustments
 * to training plans based on athlete state.
 */

import { PlanWeek } from '../types';
import { FatigueModifier, FatigueCondition, FatigueContext, CyclePhase, PhasePosition } from '../programTemplate';

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
// CYCLE PHASE DETECTION
// ============================================================================

const MIN_HISTORY_POINTS = 5;       // Minimum data points for reliable detection (increased from 3)
const VELOCITY_HYSTERESIS = 1.5;    // Minimum velocity change to switch phases (prevents thrashing)

/**
 * Result of cycle phase detection with confidence scoring.
 */
export interface CyclePhaseResult {
    phase: CyclePhase | undefined;
    confidence: number;  // 0-1, higher = more certain
}

/**
 * Detect current cycle phase from recent fatigue history.
 * 
 * Analyzes fatigue velocity (rate of change) and recent pattern.
 * Returns undefined if insufficient data (<5 points).
 * 
 * Improvements over previous version:
 * - Requires minimum 5 data points (was 3) for reliable detection
 * - Uses hysteresis to prevent phase "thrashing" on noisy data
 * - Returns confidence score (0-1) for UI/decision making
 * 
 * @param fatigueHistory - Array of recent fatigue scores
 * @param recentReadiness - Optional current readiness score
 * @param previousPhase - Optional previous detected phase (for hysteresis)
 * @returns Object with phase and confidence score
 */
export function detectCyclePhase(
    fatigueHistory: number[],
    recentReadiness?: number,
    previousPhase?: CyclePhase
): CyclePhaseResult {
    // Need at least MIN_HISTORY_POINTS for reliable detection
    if (fatigueHistory.length < MIN_HISTORY_POINTS) {
        return { phase: undefined, confidence: 0 };
    }

    // Get recent values (last 5-7 points)
    const recent = fatigueHistory.slice(-Math.min(7, fatigueHistory.length));
    const n = recent.length;

    // Calculate velocity (average rate of change)
    let velocity = 0;
    for (let i = 1; i < n; i++) {
        velocity += recent[i] - recent[i - 1];
    }
    velocity /= (n - 1);

    // Calculate acceleration (rate of change of velocity)
    const velocities: number[] = [];
    for (let i = 1; i < n; i++) {
        velocities.push(recent[i] - recent[i - 1]);
    }
    let acceleration = 0;
    if (velocities.length >= 2) {
        for (let i = 1; i < velocities.length; i++) {
            acceleration += velocities[i] - velocities[i - 1];
        }
        acceleration /= (velocities.length - 1);
    }

    const currentFatigue = recent[n - 1];
    let detectedPhase: CyclePhase;
    let confidence: number;

    // Determine phase based on velocity and position
    // PEAK: High fatigue AND velocity turning negative (about to drop)
    if (currentFatigue > 60 && velocity > -2 && velocity < 3 && acceleration < -1) {
        detectedPhase = 'peak';
        confidence = Math.min(1, (currentFatigue - 60) / 30 + Math.abs(acceleration) / 3);
    }
    // ASCENDING: Fatigue is clearly rising (with hysteresis)
    else if (velocity > (2 + (previousPhase === 'ascending' ? 0 : VELOCITY_HYSTERESIS))) {
        detectedPhase = 'ascending';
        confidence = Math.min(1, velocity / 5);
    }
    // TROUGH: Low fatigue AND velocity turning positive (about to rise)
    else if (currentFatigue < 40 && velocity < 2 && velocity > -3 && acceleration > 1) {
        detectedPhase = 'trough';
        confidence = Math.min(1, (40 - currentFatigue) / 30 + acceleration / 3);
    }
    // DESCENDING: Fatigue is clearly falling (with hysteresis)
    else if (velocity < -(2 + (previousPhase === 'descending' ? 0 : VELOCITY_HYSTERESIS))) {
        detectedPhase = 'descending';
        confidence = Math.min(1, Math.abs(velocity) / 5);
    }
    // Use position as tiebreaker for stable periods
    else if (currentFatigue > 55) {
        detectedPhase = velocity >= 0 ? 'peak' : 'descending';
        confidence = 0.5;  // Lower confidence for position-based detection
    } else if (currentFatigue < 35) {
        detectedPhase = velocity <= 0 ? 'trough' : 'ascending';
        confidence = 0.5;
    } else {
        // Default based on velocity direction
        detectedPhase = velocity >= 0 ? 'ascending' : 'descending';
        confidence = 0.3;  // Lowest confidence for default case
    }

    // Apply hysteresis: stick with previous phase if change is marginal
    if (previousPhase && previousPhase !== detectedPhase && confidence < 0.6) {
        return { phase: previousPhase, confidence: confidence * 0.7 };
    }

    return { phase: detectedPhase, confidence };
}

/**
 * Calculate phase position (early/mid/late) from fatigue history.
 * 
 * Estimates position within the current phase by looking at how long
 * the current trend has been sustained. Uses velocity consistency to
 * estimate how far into the phase we are.
 * 
 * @param fatigueHistory - Array of recent fatigue scores
 * @param currentPhase - The detected cycle phase
 * @returns PhasePosition or undefined if not enough data
 */
export function calculatePhasePositionFromHistory(
    fatigueHistory: number[],
    currentPhase: CyclePhase
): PhasePosition | undefined {
    if (fatigueHistory.length < MIN_HISTORY_POINTS) {
        return undefined;
    }

    // Get recent values
    const recent = fatigueHistory.slice(-Math.min(10, fatigueHistory.length));

    // Count consecutive weeks matching current phase direction
    let consecutiveCount = 0;
    const isRising = currentPhase === 'ascending' || currentPhase === 'peak';

    // Start from most recent and count back
    for (let i = recent.length - 1; i > 0; i--) {
        const diff = recent[i] - recent[i - 1];
        const matchesDirection = isRising ? diff >= -1 : diff <= 1;

        if (matchesDirection) {
            consecutiveCount++;
        } else {
            break;
        }
    }

    // Map consecutive count to position
    // Typical phase length is 3-6 weeks
    const positionRatio = Math.min(1, consecutiveCount / 5);

    if (positionRatio < 0.33) return 'early';
    if (positionRatio < 0.67) return 'mid';
    return 'late';
}

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

        // Check cyclePhase condition if specified (auto-detected from fatigue trajectory)
        if (modifier.cyclePhase !== undefined && context.fatigueHistory && context.fatigueHistory.length >= 5) {
            const result = detectCyclePhase(context.fatigueHistory, context.readiness);
            if (result.phase) {
                const phasesToMatch = Array.isArray(modifier.cyclePhase) ? modifier.cyclePhase : [modifier.cyclePhase];
                if (!phasesToMatch.includes(result.phase)) {
                    continue; // Skip if current cycle phase doesn't match
                }

                // Check phasePosition within the detected cycle phase
                if (modifier.phasePosition !== undefined && context.fatigueHistory) {
                    const phasePosition = calculatePhasePositionFromHistory(context.fatigueHistory, result.phase);
                    if (phasePosition) {
                        const positionsToMatch = Array.isArray(modifier.phasePosition)
                            ? modifier.phasePosition : [modifier.phasePosition];
                        if (!positionsToMatch.includes(phasePosition)) {
                            continue; // Skip if phase position doesn't match
                        }
                    }
                }
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

    return { week: modifiedWeek, messages };
}
