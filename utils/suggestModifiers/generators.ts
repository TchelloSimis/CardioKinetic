/**
 * Suggest Modifiers Module - Modifier Generators
 * 
 * Contains functions that generate FatigueModifier objects based on simulation analysis.
 * Uses percentile-based thresholds without cyclePhase filtering.
 */

import { WeekDefinition, FatigueModifier, FlexibleCondition } from '../../programTemplate';
import { TrendAnalysis, WeekAnalysis } from './types';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format adjustments into an actionable, athlete-friendly string.
 */
function formatAdjustments(adj: Partial<FatigueModifier['adjustments']>): string {
    const parts: string[] = [];

    if (adj.powerMultiplier !== undefined) {
        const pct = Math.round(adj.powerMultiplier * 100);
        if (adj.powerMultiplier < 1) {
            parts.push(`Target power at ${pct}%`);
        } else if (adj.powerMultiplier > 1) {
            parts.push(`Push power to ${pct}%`);
        }
    }

    if (adj.rpeAdjust !== undefined && adj.rpeAdjust !== 0) {
        if (adj.rpeAdjust < 0) {
            parts.push(`aim for ${Math.abs(adj.rpeAdjust)} RPE lower than planned`);
        } else {
            parts.push(`push RPE ${adj.rpeAdjust} higher`);
        }
    }

    if (adj.volumeMultiplier !== undefined && adj.volumeMultiplier !== 1) {
        const pct = Math.round(adj.volumeMultiplier * 100);
        if (adj.volumeMultiplier < 1) {
            parts.push(`reduce volume to ${pct}%`);
        } else {
            parts.push(`extend session to ${pct}% duration`);
        }
    }

    if (adj.restMultiplier !== undefined && adj.restMultiplier > 1) {
        const extra = Math.round((adj.restMultiplier - 1) * 100);
        parts.push(`take ${extra}% longer rest intervals`);
    }

    if (parts.length === 0) return '';

    const result = parts.join(', ');
    return result.charAt(0).toUpperCase() + result.slice(1) + '.';
}

// ============================================================================
// TIER-BASED ADJUSTMENTS
// ============================================================================

// Extreme tier adjustments (P85/P15)
const EXTREME_FATIGUE_HIGH_ADJ: Partial<FatigueModifier['adjustments']> = {
    powerMultiplier: 0.85,
    rpeAdjust: -2,
    restMultiplier: 1.4
};

const EXTREME_FATIGUE_LOW_ADJ: Partial<FatigueModifier['adjustments']> = {
    powerMultiplier: 1.12,
    volumeMultiplier: 1.15
};

const EXTREME_READINESS_LOW_ADJ: Partial<FatigueModifier['adjustments']> = {
    powerMultiplier: 0.80,
    rpeAdjust: -2,
    restMultiplier: 1.5
};

const EXTREME_READINESS_HIGH_ADJ: Partial<FatigueModifier['adjustments']> = {
    powerMultiplier: 1.15,
    volumeMultiplier: 1.20
};

// Moderate tier adjustments (P75/P25)
const MODERATE_FATIGUE_HIGH_ADJ: Partial<FatigueModifier['adjustments']> = {
    powerMultiplier: 0.90,
    rpeAdjust: -1,
    restMultiplier: 1.2
};

const MODERATE_FATIGUE_LOW_ADJ: Partial<FatigueModifier['adjustments']> = {
    powerMultiplier: 1.08,
    volumeMultiplier: 1.1
};

const MODERATE_READINESS_LOW_ADJ: Partial<FatigueModifier['adjustments']> = {
    powerMultiplier: 0.88,
    rpeAdjust: -1,
    restMultiplier: 1.25
};

const MODERATE_READINESS_HIGH_ADJ: Partial<FatigueModifier['adjustments']> = {
    powerMultiplier: 1.10,
    volumeMultiplier: 1.12
};

// Mild tier adjustments (P65/P35)
const MILD_FATIGUE_HIGH_ADJ: Partial<FatigueModifier['adjustments']> = {
    powerMultiplier: 0.95,
    restMultiplier: 1.1
};

const MILD_FATIGUE_LOW_ADJ: Partial<FatigueModifier['adjustments']> = {
    powerMultiplier: 1.05
};

const MILD_READINESS_LOW_ADJ: Partial<FatigueModifier['adjustments']> = {
    powerMultiplier: 0.92,
    rpeAdjust: -1
};

const MILD_READINESS_HIGH_ADJ: Partial<FatigueModifier['adjustments']> = {
    powerMultiplier: 1.05,
    volumeMultiplier: 1.05
};

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate smart modifiers based on simulation analysis.
 * Uses percentile thresholds to create tiered modifiers.
 */
export function generateSmartModifiers(analysis: TrendAnalysis, weeks: WeekDefinition[]): FatigueModifier[] {
    const modifiers: FatigueModifier[] = [];
    let priority = 10;

    const { weekAnalyses } = analysis;
    if (weekAnalyses.length === 0) return modifiers;

    // Calculate global percentile averages across all weeks
    const avgP15Fatigue = Math.round(weekAnalyses.reduce((s, w) => s + w.fatigueP15, 0) / weekAnalyses.length);
    const avgP30Fatigue = Math.round(weekAnalyses.reduce((s, w) => s + w.fatigueP30, 0) / weekAnalyses.length);
    const avgP50Fatigue = Math.round(weekAnalyses.reduce((s, w) => s + w.fatigueP50, 0) / weekAnalyses.length);
    const avgP70Fatigue = Math.round(weekAnalyses.reduce((s, w) => s + w.fatigueP70, 0) / weekAnalyses.length);
    const avgP85Fatigue = Math.round(weekAnalyses.reduce((s, w) => s + w.fatigueP85, 0) / weekAnalyses.length);

    const avgP15Readiness = Math.round(weekAnalyses.reduce((s, w) => s + w.readinessP15, 0) / weekAnalyses.length);
    const avgP30Readiness = Math.round(weekAnalyses.reduce((s, w) => s + w.readinessP30, 0) / weekAnalyses.length);
    const avgP50Readiness = Math.round(weekAnalyses.reduce((s, w) => s + w.readinessP50, 0) / weekAnalyses.length);
    const avgP70Readiness = Math.round(weekAnalyses.reduce((s, w) => s + w.readinessP70, 0) / weekAnalyses.length);
    const avgP85Readiness = Math.round(weekAnalyses.reduce((s, w) => s + w.readinessP85, 0) / weekAnalyses.length);

    // === EXTREME TIER (P85/P15) ===

    // Extremely high fatigue
    if (avgP85Fatigue <= 95 && avgP85Fatigue > avgP70Fatigue) {
        const adj = EXTREME_FATIGUE_HIGH_ADJ;
        modifiers.push({
            condition: { fatigue: `>${avgP85Fatigue}`, logic: 'and' } as FlexibleCondition,
            adjustments: {
                ...adj,
                message: `Very high fatigue (>${avgP85Fatigue}%). ${formatAdjustments(adj)}`
            },
            priority: priority++
        });
    }

    // Extremely low readiness
    if (avgP15Readiness >= 5 && avgP15Readiness < avgP30Readiness) {
        const adj = EXTREME_READINESS_LOW_ADJ;
        modifiers.push({
            condition: { readiness: `<${avgP15Readiness}`, logic: 'and' } as FlexibleCondition,
            adjustments: {
                ...adj,
                message: `Very low readiness (<${avgP15Readiness}%). ${formatAdjustments(adj)}`
            },
            priority: priority++
        });
    }

    // Extremely low fatigue (opportunity to push)
    if (avgP15Fatigue >= 5 && avgP15Fatigue < avgP30Fatigue) {
        const adj = EXTREME_FATIGUE_LOW_ADJ;
        const adjStr = formatAdjustments(adj);
        if (adjStr) {
            modifiers.push({
                condition: { fatigue: `<${avgP15Fatigue}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    ...adj,
                    message: `Very low fatigue (<${avgP15Fatigue}%). ${adjStr}`
                },
                priority: priority++
            });
        }
    }

    // Extremely high readiness (opportunity to push)
    if (avgP85Readiness <= 95 && avgP85Readiness > avgP70Readiness) {
        const adj = EXTREME_READINESS_HIGH_ADJ;
        const adjStr = formatAdjustments(adj);
        if (adjStr) {
            modifiers.push({
                condition: { readiness: `>${avgP85Readiness}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    ...adj,
                    message: `Very high readiness (>${avgP85Readiness}%). ${adjStr}`
                },
                priority: priority++
            });
        }
    }

    // === MODERATE TIER (P70/P30) ===

    // Moderately high fatigue
    if (avgP70Fatigue <= 95) {
        const adj = MODERATE_FATIGUE_HIGH_ADJ;
        modifiers.push({
            condition: { fatigue: `>${avgP70Fatigue}`, logic: 'and' } as FlexibleCondition,
            adjustments: {
                ...adj,
                message: `High fatigue (>${avgP70Fatigue}%). ${formatAdjustments(adj)}`
            },
            priority: priority++
        });
    }

    // Moderately low readiness
    if (avgP30Readiness >= 5) {
        const adj = MODERATE_READINESS_LOW_ADJ;
        modifiers.push({
            condition: { readiness: `<${avgP30Readiness}`, logic: 'and' } as FlexibleCondition,
            adjustments: {
                ...adj,
                message: `Low readiness (<${avgP30Readiness}%). ${formatAdjustments(adj)}`
            },
            priority: priority++
        });
    }

    // Moderately low fatigue
    if (avgP30Fatigue >= 5) {
        const adj = MODERATE_FATIGUE_LOW_ADJ;
        const adjStr = formatAdjustments(adj);
        if (adjStr) {
            modifiers.push({
                condition: { fatigue: `<${avgP30Fatigue}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    ...adj,
                    message: `Low fatigue (<${avgP30Fatigue}%). ${adjStr}`
                },
                priority: priority++
            });
        }
    }

    // Moderately high readiness
    if (avgP70Readiness <= 95) {
        const adj = MODERATE_READINESS_HIGH_ADJ;
        const adjStr = formatAdjustments(adj);
        if (adjStr) {
            modifiers.push({
                condition: { readiness: `>${avgP70Readiness}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    ...adj,
                    message: `High readiness (>${avgP70Readiness}%). ${adjStr}`
                },
                priority: priority++
            });
        }
    }

    // === PHASE NAME-BASED MODIFIERS ===
    // Generate modifiers per phaseName for block-based programs

    const nameGroups = new Map<string, WeekAnalysis[]>();
    for (const week of weekAnalyses) {
        if (week.phaseName) {
            if (!nameGroups.has(week.phaseName)) {
                nameGroups.set(week.phaseName, []);
            }
            nameGroups.get(week.phaseName)!.push(week);
        }
    }

    for (const [phaseName, phaseWeeks] of nameGroups) {
        // Calculate phase-specific percentiles
        const phaseP30Fatigue = Math.round(phaseWeeks.reduce((s, w) => s + w.fatigueP30, 0) / phaseWeeks.length);
        const phaseP70Fatigue = Math.round(phaseWeeks.reduce((s, w) => s + w.fatigueP70, 0) / phaseWeeks.length);
        const phaseP30Readiness = Math.round(phaseWeeks.reduce((s, w) => s + w.readinessP30, 0) / phaseWeeks.length);
        const phaseP70Readiness = Math.round(phaseWeeks.reduce((s, w) => s + w.readinessP70, 0) / phaseWeeks.length);

        // High fatigue during this phase
        if (phaseP70Fatigue <= 95) {
            modifiers.push({
                condition: { fatigue: `>${phaseP70Fatigue}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    powerMultiplier: 0.90,
                    rpeAdjust: -1,
                    message: `High fatigue during ${phaseName} (>${phaseP70Fatigue}%). Power -10%, RPE -1.`
                },
                priority: priority++,
                phaseName: phaseName
            });
        }

        // Low fatigue during this phase
        if (phaseP30Fatigue >= 5) {
            modifiers.push({
                condition: { fatigue: `<${phaseP30Fatigue}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    powerMultiplier: 1.08,
                    message: `Low fatigue during ${phaseName} (<${phaseP30Fatigue}%). Power +8%.`
                },
                priority: priority++,
                phaseName: phaseName
            });
        }

        // Low readiness during this phase
        if (phaseP30Readiness >= 5) {
            modifiers.push({
                condition: { readiness: `<${phaseP30Readiness}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    powerMultiplier: 0.88,
                    rpeAdjust: -1,
                    restMultiplier: 1.25,
                    message: `Low readiness during ${phaseName} (<${phaseP30Readiness}%). Power -12%, RPE -1.`
                },
                priority: priority++,
                phaseName: phaseName
            });
        }

        // High readiness during this phase
        if (phaseP70Readiness <= 95) {
            modifiers.push({
                condition: { readiness: `>${phaseP70Readiness}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    powerMultiplier: 1.10,
                    volumeMultiplier: 1.12,
                    message: `High readiness during ${phaseName} (>${phaseP70Readiness}%). Power +10%, volume +12%.`
                },
                priority: priority++,
                phaseName: phaseName
            });
        }
    }

    // === GLOBAL TREND MODIFIERS ===

    const { globalTrend, adaptationScore } = analysis;

    if (globalTrend === 'declining' && adaptationScore < -0.4) {
        modifiers.push({
            condition: { fatigue: `>${avgP50Fatigue}`, readiness: `<${avgP50Readiness}`, logic: 'and' } as FlexibleCondition,
            adjustments: {
                powerMultiplier: 0.85,
                rpeAdjust: -2,
                restMultiplier: 1.5,
                message: `Program trend shows declining adaptation. Significant load reduction recommended.`
            },
            priority: priority++
        });
    }

    if (globalTrend === 'improving' && adaptationScore > 0.4) {
        modifiers.push({
            condition: { fatigue: `<${avgP50Fatigue}`, readiness: `>${avgP50Readiness}`, logic: 'and' } as FlexibleCondition,
            adjustments: {
                powerMultiplier: 1.12,
                volumeMultiplier: 1.15,
                message: `Program trend shows strong adaptation. Consider progressive overload.`
            },
            priority: priority++
        });
    }

    return modifiers;
}
