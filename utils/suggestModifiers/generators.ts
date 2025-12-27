/**
 * Suggest Modifiers Module - Modifier Generators
 * 
 * Contains functions that generate FatigueModifier objects based on analysis.
 */

import { WeekDefinition, FatigueModifier, FlexibleCondition, CyclePhase, PhasePosition } from '../../programTemplate';
import { TrendAnalysis, WeekAnalysis } from './types';
import { adjustThresholdsForPosition } from './algorithms';

// ============================================================================
// HELPERS
// ============================================================================

function getPhaseLabel(phase: CyclePhase): string {
    const labels: Record<CyclePhase, string> = {
        ascending: 'ascending/build phases',
        peak: 'peak intensity weeks',
        descending: 'descending/consolidation phases',
        trough: 'recovery periods'
    };
    return labels[phase];
}

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
// PHASE-SPECIFIC ADJUSTMENTS
// ============================================================================

function getFatigueHighAdjustments(phase: CyclePhase): Partial<FatigueModifier['adjustments']> {
    const adjustments: Record<CyclePhase, Partial<FatigueModifier['adjustments']>> = {
        ascending: { powerMultiplier: 0.92, rpeAdjust: -1 },
        peak: { powerMultiplier: 0.88, rpeAdjust: -1, restMultiplier: 1.3 },
        descending: { powerMultiplier: 0.90 },
        trough: { powerMultiplier: 0.85, restMultiplier: 1.5 }
    };
    return adjustments[phase];
}

function getFatigueLowAdjustments(phase: CyclePhase): Partial<FatigueModifier['adjustments']> {
    const adjustments: Record<CyclePhase, Partial<FatigueModifier['adjustments']>> = {
        ascending: { powerMultiplier: 1.08, volumeMultiplier: 1.1 },
        peak: { powerMultiplier: 1.05 },
        descending: { powerMultiplier: 1.0 },
        trough: { powerMultiplier: 1.0 }
    };
    return adjustments[phase];
}

function getReadinessLowAdjustments(phase: CyclePhase): Partial<FatigueModifier['adjustments']> {
    const adjustments: Record<CyclePhase, Partial<FatigueModifier['adjustments']>> = {
        ascending: { powerMultiplier: 0.88, rpeAdjust: -1, restMultiplier: 1.25 },
        peak: { powerMultiplier: 0.85, rpeAdjust: -2, restMultiplier: 1.5 },
        descending: { powerMultiplier: 0.90, rpeAdjust: -1, restMultiplier: 1.25 },
        trough: { powerMultiplier: 0.80, rpeAdjust: -2, restMultiplier: 1.75 }
    };
    return adjustments[phase];
}

function getReadinessHighAdjustments(phase: CyclePhase): Partial<FatigueModifier['adjustments']> {
    const adjustments: Record<CyclePhase, Partial<FatigueModifier['adjustments']>> = {
        ascending: { powerMultiplier: 1.10, volumeMultiplier: 1.15 },
        peak: { powerMultiplier: 1.08 },
        descending: { powerMultiplier: 1.0 },
        trough: { powerMultiplier: 1.0 }
    };
    return adjustments[phase];
}

// === EXTREME TIER ADJUSTMENTS (for P15/P85 thresholds) ===

function getFatigueExtremeHighAdjustments(phase: CyclePhase): Partial<FatigueModifier['adjustments']> {
    const adjustments: Record<CyclePhase, Partial<FatigueModifier['adjustments']>> = {
        ascending: { powerMultiplier: 0.85, rpeAdjust: -2, restMultiplier: 1.3 },
        peak: { powerMultiplier: 0.80, rpeAdjust: -2, restMultiplier: 1.5 },
        descending: { powerMultiplier: 0.82, rpeAdjust: -1, restMultiplier: 1.3 },
        trough: { powerMultiplier: 0.75, restMultiplier: 1.75 }
    };
    return adjustments[phase];
}

function getFatigueExtremeLowAdjustments(phase: CyclePhase): Partial<FatigueModifier['adjustments']> {
    const adjustments: Record<CyclePhase, Partial<FatigueModifier['adjustments']>> = {
        ascending: { powerMultiplier: 1.12, volumeMultiplier: 1.15 },
        peak: { powerMultiplier: 1.10, volumeMultiplier: 1.08 },
        descending: { powerMultiplier: 1.0 },
        trough: { powerMultiplier: 1.0 }
    };
    return adjustments[phase];
}

function getReadinessExtremeLowAdjustments(phase: CyclePhase): Partial<FatigueModifier['adjustments']> {
    const adjustments: Record<CyclePhase, Partial<FatigueModifier['adjustments']>> = {
        ascending: { powerMultiplier: 0.80, rpeAdjust: -2, restMultiplier: 1.5 },
        peak: { powerMultiplier: 0.75, rpeAdjust: -2, restMultiplier: 1.75 },
        descending: { powerMultiplier: 0.82, rpeAdjust: -2, restMultiplier: 1.5 },
        trough: { powerMultiplier: 0.70, rpeAdjust: -2, restMultiplier: 2.0 }
    };
    return adjustments[phase];
}

function getReadinessExtremeHighAdjustments(phase: CyclePhase): Partial<FatigueModifier['adjustments']> {
    const adjustments: Record<CyclePhase, Partial<FatigueModifier['adjustments']>> = {
        ascending: { powerMultiplier: 1.15, volumeMultiplier: 1.20 },
        peak: { powerMultiplier: 1.12, volumeMultiplier: 1.10 },
        descending: { powerMultiplier: 1.0 },
        trough: { powerMultiplier: 1.0 }
    };
    return adjustments[phase];
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateSmartModifiers(analysis: TrendAnalysis, weeks: WeekDefinition[]): FatigueModifier[] {
    const modifiers: FatigueModifier[] = [];
    let priority = 10;

    const { weekAnalyses, globalTrend, adaptationScore } = analysis;
    if (weekAnalyses.length === 0) return modifiers;

    // Detect session types in program
    const sessionTypes = new Set<string>();
    for (const week of weeks) {
        if (week.sessionStyle) sessionTypes.add(week.sessionStyle);
        if (week.blocks) {
            for (const block of week.blocks) {
                if (block.type === 'interval') sessionTypes.add('interval');
                if (block.type === 'steady-state') sessionTypes.add('steady-state');
            }
        }
    }
    const hasIntervals = sessionTypes.has('interval');
    const hasSteadyState = sessionTypes.has('steady-state');
    const hasCustom = sessionTypes.has('custom');

    // Group by cycle phase
    const phaseGroups = new Map<CyclePhase, WeekAnalysis[]>();
    for (const week of weekAnalyses) {
        if (!phaseGroups.has(week.cyclePhase)) {
            phaseGroups.set(week.cyclePhase, []);
        }
        phaseGroups.get(week.cyclePhase)!.push(week);
    }

    // Also group by phaseName for block-based programs
    const nameGroups = new Map<string, WeekAnalysis[]>();
    for (const week of weekAnalyses) {
        if (week.phaseName) {
            if (!nameGroups.has(week.phaseName)) {
                nameGroups.set(week.phaseName, []);
            }
            nameGroups.get(week.phaseName)!.push(week);
        }
    }

    // Generate modifiers per cycle phase - TWO TIERS
    for (const [phase, phaseWeeks] of phaseGroups) {
        // Standard tier thresholds (P30/P70)
        const avgP30Fatigue = Math.round(phaseWeeks.reduce((s, w) => s + w.fatigueP30, 0) / phaseWeeks.length);
        const avgP70Fatigue = Math.round(phaseWeeks.reduce((s, w) => s + w.fatigueP70, 0) / phaseWeeks.length);
        const avgP30Readiness = Math.round(phaseWeeks.reduce((s, w) => s + w.readinessP30, 0) / phaseWeeks.length);
        const avgP70Readiness = Math.round(phaseWeeks.reduce((s, w) => s + w.readinessP70, 0) / phaseWeeks.length);

        // Extreme tier thresholds (P15/P85)
        const avgP15Fatigue = Math.round(phaseWeeks.reduce((s, w) => s + w.fatigueP15, 0) / phaseWeeks.length);
        const avgP85Fatigue = Math.round(phaseWeeks.reduce((s, w) => s + w.fatigueP85, 0) / phaseWeeks.length);
        const avgP15Readiness = Math.round(phaseWeeks.reduce((s, w) => s + w.readinessP15, 0) / phaseWeeks.length);
        const avgP85Readiness = Math.round(phaseWeeks.reduce((s, w) => s + w.readinessP85, 0) / phaseWeeks.length);

        const phaseLabel = getPhaseLabel(phase);

        // === EXTREME TIER (P85/P15) ===
        if (avgP85Fatigue <= 95 && avgP85Fatigue > avgP70Fatigue) {
            const adj = getFatigueExtremeHighAdjustments(phase);
            modifiers.push({
                condition: { fatigue: `>${avgP85Fatigue}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    ...adj,
                    message: `Very high fatigue for ${phaseLabel} (>${avgP85Fatigue}%). ${formatAdjustments(adj)}`
                },
                priority: priority++,
                cyclePhase: phase
            });
        }

        if (avgP15Readiness >= 5 && avgP15Readiness < avgP30Readiness) {
            const adj = getReadinessExtremeLowAdjustments(phase);
            modifiers.push({
                condition: { readiness: `<${avgP15Readiness}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    ...adj,
                    message: `Very low readiness for ${phaseLabel} (<${avgP15Readiness}%). ${formatAdjustments(adj)}`
                },
                priority: priority++,
                cyclePhase: phase
            });
        }

        if (avgP15Fatigue >= 5 && avgP15Fatigue < avgP30Fatigue && phase !== 'trough' && phase !== 'descending') {
            const adj = getFatigueExtremeLowAdjustments(phase);
            const adjStr = formatAdjustments(adj);
            if (adjStr) {
                modifiers.push({
                    condition: { fatigue: `<${avgP15Fatigue}`, logic: 'and' } as FlexibleCondition,
                    adjustments: {
                        ...adj,
                        message: `Very low fatigue for ${phaseLabel} (<${avgP15Fatigue}%). ${adjStr}`
                    },
                    priority: priority++,
                    cyclePhase: phase
                });
            }
        }

        if (avgP85Readiness <= 95 && avgP85Readiness > avgP70Readiness && phase !== 'trough' && phase !== 'descending') {
            const adj = getReadinessExtremeHighAdjustments(phase);
            const adjStr = formatAdjustments(adj);
            if (adjStr) {
                modifiers.push({
                    condition: { readiness: `>${avgP85Readiness}`, logic: 'and' } as FlexibleCondition,
                    adjustments: {
                        ...adj,
                        message: `Very high readiness for ${phaseLabel} (>${avgP85Readiness}%). ${adjStr}`
                    },
                    priority: priority++,
                    cyclePhase: phase
                });
            }
        }

        // === STANDARD TIER (P70/P30) ===
        if (avgP70Fatigue <= 95) {
            const adj = getFatigueHighAdjustments(phase);
            modifiers.push({
                condition: { fatigue: `>${avgP70Fatigue}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    ...adj,
                    message: `High fatigue for ${phaseLabel} (>${avgP70Fatigue}%). ${formatAdjustments(adj)}`
                },
                priority: priority++,
                cyclePhase: phase
            });
        }

        if (avgP30Fatigue >= 5 && phase !== 'trough' && phase !== 'descending') {
            const adj = getFatigueLowAdjustments(phase);
            const adjStr = formatAdjustments(adj);
            if (adjStr) {
                modifiers.push({
                    condition: { fatigue: `<${avgP30Fatigue}`, logic: 'and' } as FlexibleCondition,
                    adjustments: {
                        ...adj,
                        message: `Low fatigue for ${phaseLabel} (<${avgP30Fatigue}%). ${adjStr}`
                    },
                    priority: priority++,
                    cyclePhase: phase
                });
            }
        }

        if (avgP30Readiness >= 10) {
            const adj = getReadinessLowAdjustments(phase);
            modifiers.push({
                condition: { readiness: `<${avgP30Readiness}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    ...adj,
                    message: `Low readiness for ${phaseLabel} (<${avgP30Readiness}%). ${formatAdjustments(adj)}`
                },
                priority: priority++,
                cyclePhase: phase
            });
        }

        if (avgP70Readiness <= 95 && phase !== 'trough' && phase !== 'descending') {
            const adj = getReadinessHighAdjustments(phase);
            const adjStr = formatAdjustments(adj);
            if (adjStr) {
                modifiers.push({
                    condition: { readiness: `>${avgP70Readiness}`, logic: 'and' } as FlexibleCondition,
                    adjustments: {
                        ...adj,
                        message: `High readiness for ${phaseLabel} (>${avgP70Readiness}%). ${adjStr}`
                    },
                    priority: priority++,
                    cyclePhase: phase
                });
            }
        }
    }

    // Generate modifiers per named phase for block-based programs
    for (const [phaseName, phaseWeeks] of nameGroups) {
        if (phaseWeeks.length < 2) continue;

        const avgP30Fatigue = Math.round(phaseWeeks.reduce((s, w) => s + w.fatigueP30, 0) / phaseWeeks.length);
        const avgP70Fatigue = Math.round(phaseWeeks.reduce((s, w) => s + w.fatigueP70, 0) / phaseWeeks.length);
        const avgP15Fatigue = Math.round(phaseWeeks.reduce((s, w) => s + w.fatigueP15, 0) / phaseWeeks.length);
        const avgP85Fatigue = Math.round(phaseWeeks.reduce((s, w) => s + w.fatigueP85, 0) / phaseWeeks.length);

        // === EXTREME TIER for named phases ===
        if (avgP85Fatigue <= 95 && avgP85Fatigue > avgP70Fatigue) {
            modifiers.push({
                condition: { fatigue: `>${avgP85Fatigue}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    powerMultiplier: 0.85,
                    rpeAdjust: -2,
                    restMultiplier: 1.3,
                    message: `Very high fatigue during ${phaseName} (>${avgP85Fatigue}%). Power -15%, RPE -2, Rest +30%`
                },
                priority: priority++,
                phaseName: phaseName
            });
        }

        if (avgP15Fatigue >= 5 && avgP15Fatigue < avgP30Fatigue) {
            modifiers.push({
                condition: { fatigue: `<${avgP15Fatigue}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    powerMultiplier: 1.12,
                    volumeMultiplier: 1.15,
                    message: `Very low fatigue during ${phaseName} (<${avgP15Fatigue}%). Power +12%, Volume +15%`
                },
                priority: priority++,
                phaseName: phaseName
            });
        }

        // === STANDARD TIER for named phases ===
        if (avgP70Fatigue <= 95) {
            modifiers.push({
                condition: { fatigue: `>${avgP70Fatigue}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    powerMultiplier: 0.90,
                    rpeAdjust: -1,
                    message: `High fatigue during ${phaseName} (>${avgP70Fatigue}%). Power -10%, RPE -1`
                },
                priority: priority++,
                phaseName: phaseName
            });
        }

        if (avgP30Fatigue >= 5) {
            modifiers.push({
                condition: { fatigue: `<${avgP30Fatigue}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    powerMultiplier: 1.08,
                    message: `Low fatigue during ${phaseName} (<${avgP30Fatigue}%). Power +8%`
                },
                priority: priority++,
                phaseName: phaseName
            });
        }
    }

    // === POSITION-SPECIFIC MODIFIERS FOR ASCENDING PHASES ===
    // Generate modifiers with position-adjusted thresholds for long ascending phases
    const ascendingWeeks = weekAnalyses.filter(w => w.cyclePhase === 'ascending');
    if (ascendingWeeks.length >= 3) {
        // Group by consecutive runs
        const earlyWeeks = ascendingWeeks.filter(w => w.phasePosition === 'early');
        const lateWeeks = ascendingWeeks.filter(w => w.phasePosition === 'late');

        // Early ascending: lower thresholds (low fatigue is expected, don't boost prematurely)
        if (earlyWeeks.length > 0) {
            const avgP30 = Math.round(earlyWeeks.reduce((s, w) => s + w.fatigueP30, 0) / earlyWeeks.length);
            const avgP70 = Math.round(earlyWeeks.reduce((s, w) => s + w.fatigueP70, 0) / earlyWeeks.length);
            const avgRatio = 0.15; // early position
            const { adjustedP30, adjustedP70 } = adjustThresholdsForPosition(avgP30, avgP70, avgRatio, 'ascending');

            modifiers.push({
                condition: { fatigue: `<${Math.round(adjustedP30)}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    message: `Early ascending phase - low fatigue is expected at this point. Maintain current load.`
                },
                priority: priority++,
                cyclePhase: 'ascending',
                phasePosition: 'early'
            });

            if (Math.round(adjustedP70) <= 95) {
                modifiers.push({
                    condition: { fatigue: `>${Math.round(adjustedP70)}`, logic: 'and' } as FlexibleCondition,
                    adjustments: {
                        powerMultiplier: 0.90,
                        rpeAdjust: -1,
                        message: `High fatigue for early ascending phase (>${Math.round(adjustedP70)}%). Unusual this early - reducing load to prevent overreach.`
                    },
                    priority: priority++,
                    cyclePhase: 'ascending',
                    phasePosition: 'early'
                });
            }
        }

        // Late ascending: higher thresholds (accumulated fatigue is expected, don't back off too easily)
        if (lateWeeks.length > 0) {
            const avgP30 = Math.round(lateWeeks.reduce((s, w) => s + w.fatigueP30, 0) / lateWeeks.length);
            const avgP70 = Math.round(lateWeeks.reduce((s, w) => s + w.fatigueP70, 0) / lateWeeks.length);
            const avgRatio = 0.85; // late position
            const { adjustedP30, adjustedP70 } = adjustThresholdsForPosition(avgP30, avgP70, avgRatio, 'ascending');

            modifiers.push({
                condition: { fatigue: `<${Math.round(adjustedP30)}`, logic: 'and' } as FlexibleCondition,
                adjustments: {
                    powerMultiplier: 1.10,
                    volumeMultiplier: 1.12,
                    message: `Unusually low fatigue for late ascending phase (<${Math.round(adjustedP30)}%). Push harder - you're handling the load well!`
                },
                priority: priority++,
                cyclePhase: 'ascending',
                phasePosition: 'late'
            });

            if (Math.round(adjustedP70) <= 95) {
                modifiers.push({
                    condition: { fatigue: `>${Math.round(adjustedP70)}`, logic: 'and' } as FlexibleCondition,
                    adjustments: {
                        powerMultiplier: 0.92,
                        restMultiplier: 1.2,
                        message: `Elevated fatigue for late ascending phase (>${Math.round(adjustedP70)}%). Some accumulation expected - minor adjustment.`
                    },
                    priority: priority++,
                    cyclePhase: 'ascending',
                    phasePosition: 'late'
                });
            }
        }
    }

    // Combined condition modifiers
    const avgFatigue = Math.round(weekAnalyses.reduce((s, w) => s + w.fatigueP50, 0) / weekAnalyses.length);
    const avgReadiness = Math.round(weekAnalyses.reduce((s, w) => s + w.readinessP50, 0) / weekAnalyses.length);

    modifiers.push({
        condition: { fatigue: `>${Math.max(60, avgFatigue + 15)}`, readiness: `<${Math.min(40, avgReadiness - 10)}`, logic: 'and' } as FlexibleCondition,
        adjustments: {
            powerMultiplier: 0.75,
            rpeAdjust: -2,
            volumeMultiplier: 0.70,
            restMultiplier: 1.5,
            message: `High fatigue with low readiness. Reduce power to 75%, lower RPE by 2, cut volume by 30%. Focus on completing the session, not intensity.`
        },
        priority: 2
    });

    modifiers.push({
        condition: { fatigue: `>${Math.max(55, avgFatigue + 10)}`, readiness: `<${Math.min(55, avgReadiness)}`, logic: 'and' } as FlexibleCondition,
        adjustments: {
            powerMultiplier: 0.88,
            rpeAdjust: -1,
            restMultiplier: 1.25,
            message: `Elevated fatigue with below-average readiness. Reduce power to 88%, target 1 RPE lower. Allow extra rest between intervals.`
        },
        priority: 8
    });

    modifiers.push({
        condition: { fatigue: `<${Math.min(35, avgFatigue - 10)}`, readiness: `>${Math.max(65, avgReadiness + 10)}`, logic: 'and' } as FlexibleCondition,
        adjustments: {
            powerMultiplier: 1.12,
            volumeMultiplier: 1.15,
            message: `Low fatigue with high readiness - excellent state for pushing harder. Increase power by 12%, extend session by 15%.`
        },
        priority: 15,
        cyclePhase: ['ascending', 'peak']
    });

    modifiers.push({
        condition: { fatigue: `<${avgFatigue + 5}`, readiness: `>${Math.max(60, avgReadiness + 5)}`, logic: 'and' } as FlexibleCondition,
        adjustments: {
            powerMultiplier: 1.05,
            message: `Good recovery despite moderate training load. Consider increasing power by 5% if form feels good.`
        },
        priority: 20,
        cyclePhase: ['ascending', 'peak']
    });

    // Overload protection modifiers
    modifiers.push({
        condition: { fatigue: '>85', logic: 'and' } as FlexibleCondition,
        adjustments: {
            powerMultiplier: 0.70,
            rpeAdjust: -3,
            volumeMultiplier: 0.50,
            restMultiplier: 2.0,
            message: `Critical fatigue level detected (>85%). Mandatory deload: power at 70%, volume halved, double rest. Consider taking a complete rest day.`
        },
        priority: 1
    });

    modifiers.push({
        condition: { readiness: '<25', logic: 'and' } as FlexibleCondition,
        adjustments: {
            powerMultiplier: 0.60,
            rpeAdjust: -3,
            volumeMultiplier: 0.40,
            message: `Very low readiness (<25%). Active recovery only: power at 60%, RPE should feel easy. Skip any high-intensity work today.`
        },
        priority: 1
    });

    modifiers.push({
        condition: { fatigue: '>75', logic: 'and' } as FlexibleCondition,
        adjustments: {
            powerMultiplier: 0.82,
            rpeAdjust: -2,
            volumeMultiplier: 0.75,
            restMultiplier: 1.5,
            message: `Sustained high fatigue (>75%). Pre-emptive load reduction: power at 82%, volume at 75%. Monitor recovery closely.`
        },
        priority: 4
    });

    // Global trend modifiers
    if (globalTrend === 'declining' || adaptationScore < -0.3) {
        modifiers.push({
            condition: { readiness: '<40', logic: 'and' } as FlexibleCondition,
            adjustments: {
                powerMultiplier: 0.75,
                rpeAdjust: -2,
                volumeMultiplier: 0.7,
                restMultiplier: 1.5,
                message: 'Declining adaptation trend detected. Significant load reduction needed: power at 75%, volume at 70%, extra rest.'
            },
            priority: 3
        });
    }

    if (globalTrend === 'improving' && adaptationScore > 0.5) {
        modifiers.push({
            condition: { readiness: '>75', fatigue: '<50', logic: 'and' } as FlexibleCondition,
            adjustments: {
                powerMultiplier: 1.12,
                volumeMultiplier: 1.15,
                message: 'Excellent adaptation trend. Push harder today: power +12%, volume +15%.'
            },
            priority: priority++
        });
    }

    // Session-type-specific modifiers
    if (hasIntervals || hasCustom) {
        modifiers.push({
            condition: { fatigue: `>${Math.max(60, avgFatigue + 10)}`, logic: 'and' } as FlexibleCondition,
            adjustments: {
                powerMultiplier: 0.92,
                restMultiplier: 1.3,
                message: `High fatigue for intervals. Target 92% power, take 30% longer rest between sets.`
            },
            sessionType: hasCustom ? 'custom' : 'interval',
            priority: priority++
        });

        modifiers.push({
            condition: { fatigue: '>75', logic: 'and' } as FlexibleCondition,
            adjustments: {
                powerMultiplier: 0.85,
                restMultiplier: 1.5,
                message: `Very high fatigue for intervals. Target 85% power, 50% longer rest between sets.`
            },
            sessionType: hasCustom ? 'custom' : 'interval',
            priority: 6
        });
    }

    if (hasSteadyState || hasCustom) {
        modifiers.push({
            condition: { fatigue: `>${Math.max(60, avgFatigue + 10)}`, logic: 'and' } as FlexibleCondition,
            adjustments: {
                powerMultiplier: 0.92,
                durationMultiplier: 0.85,
                message: `High fatigue for steady-state. Target 92% power, reduce duration by 15%.`
            },
            sessionType: hasCustom ? 'custom' : 'steady-state',
            priority: priority++
        });

        modifiers.push({
            condition: { fatigue: '>75', logic: 'and' } as FlexibleCondition,
            adjustments: {
                powerMultiplier: 0.85,
                durationMultiplier: 0.70,
                message: `Very high fatigue for steady-state. Target 85% power, reduce session to 70% duration.`
            },
            sessionType: hasCustom ? 'custom' : 'steady-state',
            priority: 6
        });
    }

    return modifiers;
}
