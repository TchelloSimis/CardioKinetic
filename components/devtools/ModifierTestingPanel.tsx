/**
 * Modifier Testing Panel
 * 
 * Monte Carlo simulation comparing baseline vs adaptive execution.
 * Uses the new auto-adaptive modifier engine + coach-created modifiers.
 * Features: zoom controls, power overlay, fatigue & readiness charts.
 */

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Play, BarChart3, Zap, ChevronDown, ChevronUp, RefreshCw, Activity, Download } from 'lucide-react';
import { WeekDefinition, FatigueModifier, FatigueContext } from '../../programTemplate';
import { ProgramPreset, PlanWeek, SessionStyle } from '../../types';
import { applyFatigueModifiers } from '../../utils/fatigueModifiers';
import { calculateAutoAdaptiveAdjustments } from '../../utils/autoAdaptiveModifiers';
import { WeekPercentiles, AutoAdaptiveAdjustment } from '../../utils/autoAdaptiveTypes';
import { runSingleSimulation } from '../../utils/suggestModifiers/simulation';
import { calculatePercentile } from '../../utils/suggestModifiers/algorithms';

interface ModifierTestingPanelProps {
    preset: ProgramPreset | null;
    onClose?: () => void;
}

interface WeeklySummary {
    week: number;
    phaseName: string;
    powerMult: number;
    baselineFatigue: number;
    adaptiveFatigue: number;
    baselineReadiness: number;
    adaptiveReadiness: number;
    // 30th and 70th percentiles for error bars
    baselineFatigueP30: number;
    baselineFatigueP70: number;
    adaptiveFatigueP30: number;
    adaptiveFatigueP70: number;
    baselineReadinessP30: number;
    baselineReadinessP70: number;
    adaptiveReadinessP30: number;
    adaptiveReadinessP70: number;
    triggers: number;
    coachTriggers: number;
    autoAdaptiveTriggers: number;
    triggerBreakdown: Map<string, number>; // modifier message -> count
}

// Constants
const ATL_ALPHA = 2.0 / 8;
const CTL_ALPHA = 2.0 / 43;
const FATIGUE_MIDPOINT = 1.15;
const FATIGUE_STEEPNESS = 4.5;
const READINESS_OPTIMAL_TSB = 20.0;
const READINESS_WIDTH = 1250.0;

const calculateFatigue = (atl: number, ctl: number): number => {
    if (ctl <= 0.001) return atl > 0 ? Math.min(100, Math.round(atl * 2)) : 0;
    const acwr = atl / ctl;
    return Math.round(Math.max(0, Math.min(100, 100 / (1 + Math.exp(-FATIGUE_STEEPNESS * (acwr - FATIGUE_MIDPOINT))))));
};

const calculateReadiness = (tsb: number): number => {
    const exponent = -Math.pow(tsb - READINESS_OPTIMAL_TSB, 2) / READINESS_WIDTH;
    return Math.round(Math.max(0, Math.min(100, 100 * Math.exp(exponent))));
};

const calculateLoad = (power: number, basePower: number, duration: number, rpe: number): number => {
    const powerRatio = Math.max(0.25, Math.min(4.0, power / basePower));
    return Math.pow(rpe, 1.5) * Math.pow(duration, 0.75) * Math.pow(powerRatio, 0.5) * 0.3;
};

const seededRandom = (seed: number): number => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
};

const planWeekToWeekDef = (pw: PlanWeek, basePower: number): WeekDefinition => ({
    position: pw.week,
    phaseName: pw.phaseName,
    focus: pw.focus,
    description: pw.description,
    powerMultiplier: pw.plannedPower / basePower,
    workRestRatio: pw.workRestRatio,
    targetRPE: pw.targetRPE,
    sessionStyle: pw.sessionStyle,
});

export const ModifierTestingPanel: React.FC<ModifierTestingPanelProps> = ({ preset }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([]);
    const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
    const [showModifiers, setShowModifiers] = useState(false);
    const [basePower] = useState(150);
    const [weekCount, setWeekCount] = useState(8);
    const [iterations, setIterations] = useState(100);
    const [totalTriggers, setTotalTriggers] = useState(0);
    const [coachModifierCount, setCoachModifierCount] = useState(0);
    const [autoAdaptiveCount, setAutoAdaptiveCount] = useState(0);

    // Scroll refs for synced scrolling
    const fatigueScrollRef = useRef<HTMLDivElement>(null);
    const readinessScrollRef = useRef<HTMLDivElement>(null);
    const isScrollingSynced = useRef(false);

    // Synced scroll handler
    const handleSyncScroll = useCallback((source: 'fatigue' | 'readiness') => (e: React.UIEvent<HTMLDivElement>) => {
        if (isScrollingSynced.current) return;
        isScrollingSynced.current = true;
        const scrollLeft = e.currentTarget.scrollLeft;
        if (source === 'fatigue' && readinessScrollRef.current) {
            readinessScrollRef.current.scrollLeft = scrollLeft;
        } else if (source === 'readiness' && fatigueScrollRef.current) {
            fatigueScrollRef.current.scrollLeft = scrollLeft;
        }
        requestAnimationFrame(() => { isScrollingSynced.current = false; });
    }, []);

    // Get week options from preset
    const weekOptions = useMemo(() => {
        if (!preset) return { min: 4, max: 24, options: null, isFixed: false };
        if (preset.weekOptions?.length) {
            return {
                min: Math.min(...preset.weekOptions),
                max: Math.max(...preset.weekOptions),
                options: preset.weekOptions,
                isFixed: preset.weekOptions.length === 1
            };
        }
        if (preset.weekCount && !preset.minWeeks && !preset.maxWeeks) {
            return { min: preset.weekCount, max: preset.weekCount, options: [preset.weekCount], isFixed: true };
        }
        return { min: preset.minWeeks || 4, max: preset.maxWeeks || 24, options: null, isFixed: false };
    }, [preset]);

    useMemo(() => {
        if (weekOptions.isFixed && weekOptions.options) {
            setWeekCount(weekOptions.options[0]);
        } else if (weekCount < weekOptions.min || weekCount > weekOptions.max) {
            setWeekCount(Math.max(weekOptions.min, Math.min(weekOptions.max, weekCount)));
        }
    }, [preset?.id, weekOptions]);

    const expandedWeeks = useMemo(() => {
        if (!preset) return [];
        try {
            return preset.generator(basePower, weekCount).map(pw => planWeekToWeekDef(pw, basePower));
        } catch { return []; }
    }, [preset, weekCount, basePower]);

    // Get coach-created modifiers from preset
    const coachModifiers = useMemo(() => {
        return preset?.fatigueModifiers || [];
    }, [preset]);

    /**
     * Simulation - uses new auto-adaptive engine
     */
    const runSingleIteration = (
        weeks: WeekDefinition[],
        weekPercentiles: WeekPercentiles[],
        coachMods: FatigueModifier[],
        useAdaptive: boolean,
        seed: number
    ) => {
        let atl = 9, ctl = 10;
        const fatigueHistory: number[] = [];
        let randomIdx = 0;
        const getRandom = () => seededRandom(seed + randomIdx++);

        const weeklyFatigue: number[] = [];
        const weeklyReadiness: number[] = [];
        const triggers: number[] = [];
        const coachTriggers: number[] = [];
        const autoAdaptiveTriggers: number[] = [];
        const triggerMessages: string[][] = [];

        for (let weekIdx = 0; weekIdx < weeks.length; weekIdx++) {
            const week = weeks[weekIdx];
            const numSessions = Math.floor(getRandom() * 3) + 2;
            const sessionDays = new Set<number>();
            while (sessionDays.size < numSessions) sessionDays.add(Math.floor(getRandom() * 7));
            let weekTriggerCount = 0;
            let weekCoachTriggers = 0;
            let weekAutoAdaptiveTriggers = 0;
            const weekModMessages: string[] = [];

            for (let dayInWeek = 0; dayInWeek < 7; dayInWeek++) {
                const isSession = sessionDays.has(dayInWeek);
                let load = 0;

                if (isSession) {
                    const powerVariance = (getRandom() * 0.1) - 0.05;
                    const rpeVariance = Math.round(getRandom() * 2 - 1);
                    let power = Math.round(basePower * (week.powerMultiplier || 1.0) * (1 + powerVariance));
                    let duration = 15;
                    let rpe = Math.max(1, Math.min(10, (week.targetRPE || 6) + rpeVariance));

                    if (useAdaptive) {
                        const fatigue = calculateFatigue(atl, ctl);
                        const readiness = calculateReadiness(ctl - atl);

                        const context: FatigueContext = {
                            fatigueScore: fatigue,
                            readinessScore: readiness,
                            tsbValue: ctl - atl,
                            weekNumber: weekIdx + 1,
                            totalWeeks: weeks.length,
                            phaseName: week.phaseName,
                        };

                        let coachModifierTriggered = false;

                        // 1. First try coach-created modifiers (highest priority)
                        if (coachMods.length > 0) {
                            for (const mod of coachMods.sort((a, b) => (a.priority || 0) - (b.priority || 0))) {
                                const { messages } = applyFatigueModifiers(
                                    { sessions: [{ targetPower: power, duration, rpe }] } as any,
                                    context,
                                    [mod]
                                );
                                if (messages.length > 0) {
                                    const adj = mod.adjustments;
                                    if (adj.powerMultiplier) power = Math.round(power * adj.powerMultiplier);
                                    if (adj.rpeAdjust) rpe = Math.max(1, Math.min(10, rpe + adj.rpeAdjust));
                                    if (adj.volumeMultiplier) duration *= adj.volumeMultiplier;
                                    weekTriggerCount++;
                                    weekCoachTriggers++;
                                    weekModMessages.push(`[Coach] ${adj.message || `Modifier P${mod.priority}`}`);
                                    coachModifierTriggered = true;
                                    break;
                                }
                            }
                        }

                        // 2. If no coach modifier triggered, try auto-adaptive
                        if (!coachModifierTriggered && weekPercentiles[weekIdx]) {
                            const sessionStyle: SessionStyle = week.sessionStyle || 'interval';
                            const autoAdj = calculateAutoAdaptiveAdjustments(
                                context,
                                weekPercentiles[weekIdx],
                                sessionStyle
                            );

                            if (autoAdj.isActive) {
                                power = Math.round(power * autoAdj.powerMultiplier);
                                rpe = Math.max(1, Math.min(10, rpe + autoAdj.rpeAdjust));
                                if (autoAdj.durationMultiplier) {
                                    duration *= autoAdj.durationMultiplier;
                                }
                                weekTriggerCount++;
                                weekAutoAdaptiveTriggers++;
                                weekModMessages.push(`[Auto] ${autoAdj.state} - ${autoAdj.message.slice(0, 60)}...`);
                            }
                        }
                    }

                    load = calculateLoad(power, basePower, duration, rpe);
                    fatigueHistory.push(calculateFatigue(atl, ctl));
                }
                atl = atl * (1 - ATL_ALPHA) + load * ATL_ALPHA;
                ctl = ctl * (1 - CTL_ALPHA) + load * CTL_ALPHA;
            }
            weeklyFatigue.push(calculateFatigue(atl, ctl));
            weeklyReadiness.push(calculateReadiness(ctl - atl));
            triggers.push(weekTriggerCount);
            coachTriggers.push(weekCoachTriggers);
            autoAdaptiveTriggers.push(weekAutoAdaptiveTriggers);
            triggerMessages.push(weekModMessages);
        }
        return { weeklyFatigue, weeklyReadiness, triggers, coachTriggers, autoAdaptiveTriggers, triggerMessages };
    };

    const runFullTest = async () => {
        if (!preset || expandedWeeks.length === 0) return;
        setIsRunning(true);
        setProgress(0);
        setWeeklySummaries([]);
        setTotalTriggers(0);
        setCoachModifierCount(coachModifiers.length);
        setAutoAdaptiveCount(0);

        try {
            setProgress(5);

            // Generate percentile data for auto-adaptive engine
            const numWeeks = expandedWeeks.length;
            const fatigueData: number[][] = Array.from({ length: numWeeks }, () => []);
            const readinessData: number[][] = Array.from({ length: numWeeks }, () => []);

            // Run preliminary simulations to generate percentiles (10k iterations)
            const percentileIterations = 10000;
            for (let sim = 0; sim < percentileIterations; sim++) {
                const { dailyFatigue, dailyReadiness } = runSingleSimulation(expandedWeeks, basePower);
                for (let w = 0; w < numWeeks; w++) {
                    const endOfWeekIndex = (w + 1) * 7 - 1;
                    fatigueData[w].push(dailyFatigue[endOfWeekIndex]);
                    readinessData[w].push(dailyReadiness[endOfWeekIndex]);
                }
                if (sim % 2000 === 0) {
                    setProgress(5 + (sim / percentileIterations) * 15);
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            // Calculate percentiles for each week
            const weekPercentiles: WeekPercentiles[] = [];
            for (let w = 0; w < numWeeks; w++) {
                weekPercentiles.push({
                    // Fatigue percentiles
                    fatigueP15: Math.round(calculatePercentile(fatigueData[w], 15)),
                    fatigueP25: Math.round(calculatePercentile(fatigueData[w], 25)),
                    fatigueP35: Math.round(calculatePercentile(fatigueData[w], 35)),
                    fatigueP65: Math.round(calculatePercentile(fatigueData[w], 65)),
                    fatigueP75: Math.round(calculatePercentile(fatigueData[w], 75)),
                    fatigueP85: Math.round(calculatePercentile(fatigueData[w], 85)),
                    // Readiness percentiles
                    readinessP15: Math.round(calculatePercentile(readinessData[w], 15)),
                    readinessP25: Math.round(calculatePercentile(readinessData[w], 25)),
                    readinessP35: Math.round(calculatePercentile(readinessData[w], 35)),
                    readinessP65: Math.round(calculatePercentile(readinessData[w], 65)),
                    readinessP75: Math.round(calculatePercentile(readinessData[w], 75)),
                    readinessP85: Math.round(calculatePercentile(readinessData[w], 85)),
                });
            }

            setProgress(20);

            // Run comparison simulations
            const baselineFatigues: number[][] = Array(numWeeks).fill(null).map(() => []);
            const baselineReadinesses: number[][] = Array(numWeeks).fill(null).map(() => []);
            const adaptiveFatigues: number[][] = Array(numWeeks).fill(null).map(() => []);
            const adaptiveReadinesses: number[][] = Array(numWeeks).fill(null).map(() => []);
            const triggerCounts: number[][] = Array(numWeeks).fill(null).map(() => []);
            const coachTriggerCounts: number[][] = Array(numWeeks).fill(null).map(() => []);
            const autoAdaptiveTriggerCounts: number[][] = Array(numWeeks).fill(null).map(() => []);
            const allTriggerMessages: Map<string, number>[] = Array(numWeeks).fill(null).map(() => new Map());

            for (let i = 0; i < iterations; i++) {
                const seed = 42 + i * 1000;
                const baseline = runSingleIteration(expandedWeeks, weekPercentiles, [], false, seed);
                const adaptive = runSingleIteration(expandedWeeks, weekPercentiles, coachModifiers, true, seed);

                for (let w = 0; w < numWeeks; w++) {
                    baselineFatigues[w].push(baseline.weeklyFatigue[w]);
                    baselineReadinesses[w].push(baseline.weeklyReadiness[w]);
                    adaptiveFatigues[w].push(adaptive.weeklyFatigue[w]);
                    adaptiveReadinesses[w].push(adaptive.weeklyReadiness[w]);
                    triggerCounts[w].push(adaptive.triggers[w]);
                    coachTriggerCounts[w].push(adaptive.coachTriggers[w]);
                    autoAdaptiveTriggerCounts[w].push(adaptive.autoAdaptiveTriggers[w]);

                    for (const msg of adaptive.triggerMessages[w]) {
                        allTriggerMessages[w].set(msg, (allTriggerMessages[w].get(msg) || 0) + 1);
                    }
                }

                if (i % Math.max(1, Math.floor(iterations / 20)) === 0) {
                    setProgress(20 + (i / iterations) * 75);
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
            const percentile = (arr: number[], p: number) => {
                const sorted = [...arr].sort((a, b) => a - b);
                const idx = Math.floor(sorted.length * p);
                return sorted[Math.min(idx, sorted.length - 1)];
            };

            const summaries: WeeklySummary[] = expandedWeeks.map((week, w) => ({
                week: w + 1,
                phaseName: week.phaseName,
                powerMult: week.powerMultiplier || 1.0,
                baselineFatigue: Math.round(avg(baselineFatigues[w])),
                adaptiveFatigue: Math.round(avg(adaptiveFatigues[w])),
                baselineReadiness: Math.round(avg(baselineReadinesses[w])),
                adaptiveReadiness: Math.round(avg(adaptiveReadinesses[w])),
                baselineFatigueP30: Math.round(percentile(baselineFatigues[w], 0.30)),
                baselineFatigueP70: Math.round(percentile(baselineFatigues[w], 0.70)),
                adaptiveFatigueP30: Math.round(percentile(adaptiveFatigues[w], 0.30)),
                adaptiveFatigueP70: Math.round(percentile(adaptiveFatigues[w], 0.70)),
                baselineReadinessP30: Math.round(percentile(baselineReadinesses[w], 0.30)),
                baselineReadinessP70: Math.round(percentile(baselineReadinesses[w], 0.70)),
                adaptiveReadinessP30: Math.round(percentile(adaptiveReadinesses[w], 0.30)),
                adaptiveReadinessP70: Math.round(percentile(adaptiveReadinesses[w], 0.70)),
                triggers: Math.round(avg(triggerCounts[w]) * 10) / 10,
                coachTriggers: Math.round(avg(coachTriggerCounts[w]) * 10) / 10,
                autoAdaptiveTriggers: Math.round(avg(autoAdaptiveTriggerCounts[w]) * 10) / 10,
                triggerBreakdown: allTriggerMessages[w]
            }));

            setWeeklySummaries(summaries);
            setTotalTriggers(summaries.reduce((s, w) => s + w.triggers, 0));
            setAutoAdaptiveCount(summaries.reduce((s, w) => s + w.autoAdaptiveTriggers, 0));
            setProgress(100);
        } finally {
            setIsRunning(false);
        }
    };

    const overallStats = useMemo(() => {
        if (weeklySummaries.length === 0) return null;
        const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        const totalCoachTriggers = weeklySummaries.reduce((s, w) => s + w.coachTriggers, 0);
        const totalAutoTriggers = weeklySummaries.reduce((s, w) => s + w.autoAdaptiveTriggers, 0);
        return {
            avgBaseFatigue: Math.round(avg(weeklySummaries.map(w => w.baselineFatigue))),
            avgAdaptFatigue: Math.round(avg(weeklySummaries.map(w => w.adaptiveFatigue))),
            avgBaseReadiness: Math.round(avg(weeklySummaries.map(w => w.baselineReadiness))),
            avgAdaptReadiness: Math.round(avg(weeklySummaries.map(w => w.adaptiveReadiness))),
            peakBaseFatigue: Math.max(...weeklySummaries.map(w => w.baselineFatigue)),
            peakAdaptFatigue: Math.max(...weeklySummaries.map(w => w.adaptiveFatigue)),
            coachModifierCount,
            totalCoachTriggers: Math.round(totalCoachTriggers * 10) / 10,
            totalAutoTriggers: Math.round(totalAutoTriggers * 10) / 10
        };
    }, [weeklySummaries, coachModifierCount]);

    // Export results as JSON
    const exportResults = useCallback(() => {
        if (weeklySummaries.length === 0) return;

        const exportData = {
            exportedAt: new Date().toISOString(),
            preset: {
                id: preset?.id,
                name: preset?.name
            },
            testParameters: {
                weekCount,
                iterations,
                basePower
            },
            engine: 'auto-adaptive + coach modifiers',
            overallStats: overallStats,
            totalTriggers,
            weeklySummaries: weeklySummaries.map(w => ({
                week: w.week,
                phaseName: w.phaseName,
                powerMultiplier: w.powerMult,
                fatigue: {
                    baseline: { mean: w.baselineFatigue, p30: w.baselineFatigueP30, p70: w.baselineFatigueP70 },
                    adaptive: { mean: w.adaptiveFatigue, p30: w.adaptiveFatigueP30, p70: w.adaptiveFatigueP70 }
                },
                readiness: {
                    baseline: { mean: w.baselineReadiness, p30: w.baselineReadinessP30, p70: w.baselineReadinessP70 },
                    adaptive: { mean: w.adaptiveReadiness, p30: w.adaptiveReadinessP30, p70: w.adaptiveReadinessP70 }
                },
                triggers: w.triggers,
                coachTriggers: w.coachTriggers,
                autoAdaptiveTriggers: w.autoAdaptiveTriggers,
                triggerBreakdown: Object.fromEntries(w.triggerBreakdown)
            })),
            coachModifiers: coachModifiers.map(mod => ({
                priority: mod.priority,
                cyclePhase: mod.cyclePhase,
                condition: mod.condition,
                adjustments: mod.adjustments
            }))
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `modifier-test-${preset?.id || 'unknown'}-${weekCount}w-${iterations}iter-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [preset, weekCount, iterations, basePower, overallStats, totalTriggers, weeklySummaries, coachModifiers]);

    const weekDropdownOptions = useMemo(() => {
        if (weekOptions.options) return weekOptions.options;
        const opts = [];
        for (let w = weekOptions.min; w <= weekOptions.max; w++) opts.push(w);
        return opts;
    }, [weekOptions]);

    // Just use all data (no zoom filtering)
    const visibleData = weeklySummaries;

    if (!preset) {
        return (
            <div className="p-8 text-center text-neutral-500">
                <p>Select a program template above to test modifiers.</p>
            </div>
        );
    }

    // Chart rendering helper
    const renderBarChart = (
        data: WeeklySummary[],
        getBaseline: (w: WeeklySummary) => number,
        getAdaptive: (w: WeeklySummary) => number,
        getBaselineP30: (w: WeeklySummary) => number,
        getBaselineP70: (w: WeeklySummary) => number,
        getAdaptiveP30: (w: WeeklySummary) => number,
        getAdaptiveP70: (w: WeeklySummary) => number,
        label: string,
        accentColor: string,
        higherIsBetter: boolean,
        scrollRef?: React.RefObject<HTMLDivElement>,
        onScroll?: (e: React.UIEvent<HTMLDivElement>) => void
    ) => {
        if (data.length === 0) return null;

        // Include P70 values for maxV to accommodate upper error bars
        const allValues = data.flatMap(w => [getBaseline(w), getAdaptive(w), getBaselineP70(w), getAdaptiveP70(w)]);
        const minV = 0; // Start Y-axis at 0 for proper error bar alignment
        const maxV = Math.max(...allValues) + 3;
        const range = maxV - minV || 1;
        const CHART_HEIGHT = 180;
        const BAR_AREA_HEIGHT = CHART_HEIGHT - 40;

        // Power multiplier range
        const powerMults = data.map(w => w.powerMult);
        const minPower = Math.min(...powerMults);
        const maxPower = Math.max(...powerMults);
        const powerRange = maxPower - minPower || 0.1;

        // Bar width and spacing for SVG coordinates
        const BAR_WIDTH = 32; // w-8 = 32px
        const BAR_GAP = 4; // gap-1 = 4px

        return (
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5">
                {/* Title Only */}
                <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-2 mb-4">
                    <Activity size={16} style={{ color: accentColor }} />
                    {label}
                </h4>

                {/* Chart with Horizontal Scroll */}
                <div ref={scrollRef} onScroll={onScroll} className="overflow-x-auto -mx-5 px-5 pb-2">
                    <div className="flex gap-3" style={{ minWidth: Math.max(280, data.length * 36 + 50) }}>
                        {/* Y-axis */}
                        <div className="flex flex-col justify-between text-[10px] text-neutral-400 font-mono w-10 shrink-0" style={{ height: CHART_HEIGHT }}>
                            <span>{maxV}%</span>
                            <span>{Math.round((maxV + minV) / 2)}%</span>
                            <span>{minV}%</span>
                        </div>

                        {/* Bars Container - Relative for SVG overlay */}
                        <div className="relative">
                            <div
                                className="flex items-end gap-1 border-l border-b border-neutral-200 dark:border-neutral-700 pl-2 pb-2"
                                style={{ height: CHART_HEIGHT }}
                            >
                                {data.map((w) => {
                                    const baseV = getBaseline(w);
                                    const adaptV = getAdaptive(w);
                                    const baseP30 = getBaselineP30(w);
                                    const baseP70 = getBaselineP70(w);
                                    const adaptP30 = getAdaptiveP30(w);
                                    const adaptP70 = getAdaptiveP70(w);
                                    const baseH = Math.max(4, ((baseV - minV) / range) * BAR_AREA_HEIGHT);
                                    const adaptH = Math.max(4, ((adaptV - minV) / range) * BAR_AREA_HEIGHT);
                                    // Error bar positions (P30-P70 range in pixels)
                                    const baseP30H = ((baseP30 - minV) / range) * BAR_AREA_HEIGHT;
                                    const baseP70H = ((baseP70 - minV) / range) * BAR_AREA_HEIGHT;
                                    const adaptP30H = ((adaptP30 - minV) / range) * BAR_AREA_HEIGHT;
                                    const adaptP70H = ((adaptP70 - minV) / range) * BAR_AREA_HEIGHT;
                                    const isSelected = selectedWeek === (w.week - 1);
                                    const isBetter = higherIsBetter ? (adaptV > baseV) : (adaptV < baseV);
                                    const adaptColor = isBetter ? 'var(--accent-alt)' : 'var(--accent)';

                                    return (
                                        <div
                                            key={w.week}
                                            className={`w-8 shrink-0 flex flex-col items-center cursor-pointer transition-all rounded py-0.5 ${isSelected ? 'bg-accent/10 ring-2 ring-accent/30' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                                                }`}
                                            onClick={() => setSelectedWeek(isSelected ? null : w.week - 1)}
                                        >
                                            <div className="flex-1 flex items-end justify-center gap-2 w-full">
                                                {/* Baseline: Lollipop - whisker line + dot */}
                                                <div className="relative w-3 flex justify-center">
                                                    {/* Whisker line (P30-P70) */}
                                                    <div
                                                        className="absolute w-0.5 rounded-full bg-neutral-300 dark:bg-neutral-600"
                                                        style={{
                                                            bottom: baseP30H,
                                                            height: Math.max(2, baseP70H - baseP30H)
                                                        }}
                                                    />
                                                    {/* Mean squircle */}
                                                    <div
                                                        className={`absolute rounded-sm bg-neutral-500 dark:bg-neutral-400 ${isSelected ? 'w-3 h-3 ring-2 ring-neutral-400/50' : 'w-2 h-2'}`}
                                                        style={{
                                                            bottom: baseH - (isSelected ? 6 : 4),
                                                            left: '50%',
                                                            transform: 'translateX(-50%)'
                                                        }}
                                                    />
                                                </div>
                                                {/* Adaptive: Lollipop - whisker line + dot */}
                                                <div className="relative w-3 flex justify-center">
                                                    {/* Whisker line (P30-P70) */}
                                                    <div
                                                        className="absolute w-0.5 rounded-full"
                                                        style={{
                                                            bottom: adaptP30H,
                                                            height: Math.max(2, adaptP70H - adaptP30H),
                                                            backgroundColor: `color-mix(in srgb, ${adaptColor} 50%, transparent)`
                                                        }}
                                                    />
                                                    {/* Mean squircle */}
                                                    <div
                                                        className={`absolute rounded-sm ${isSelected ? 'w-3.5 h-3.5 ring-2' : 'w-2.5 h-2.5'}`}
                                                        style={{
                                                            bottom: adaptH - (isSelected ? 7 : 5),
                                                            left: '50%',
                                                            transform: 'translateX(-50%)',
                                                            backgroundColor: adaptColor,
                                                            boxShadow: isSelected ? `0 0 0 3px color-mix(in srgb, ${adaptColor} 30%, transparent)` : 'none'
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            <div className={`text-[10px] mt-1 ${isSelected ? 'font-bold text-accent' : 'text-neutral-400'}`}>
                                                W{w.week}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Power Line SVG Overlay - Dashed, no dots */}
                            <svg
                                className="absolute top-0 left-0 pointer-events-none"
                                style={{
                                    width: data.length * (BAR_WIDTH + BAR_GAP) + 8,
                                    height: CHART_HEIGHT - 20
                                }}
                            >
                                <polyline
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeDasharray="8 8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-neutral-900 dark:text-white"
                                    points={data.map((w, i) => {
                                        const x = 8 + i * (BAR_WIDTH + BAR_GAP) + BAR_WIDTH / 2;
                                        const y = (CHART_HEIGHT - 20) - ((w.powerMult - minPower) / powerRange) * (BAR_AREA_HEIGHT - 10) - 10;
                                        return `${x},${y}`;
                                    }).join(' ')}
                                />
                            </svg>
                        </div>

                        {/* Secondary Y-axis for Power */}
                        <div className="flex flex-col justify-between text-[10px] text-neutral-400 font-mono w-12 shrink-0" style={{ height: CHART_HEIGHT - 20 }}>
                            <span>×{maxPower.toFixed(2)}</span>
                            <span>×{((maxPower + minPower) / 2).toFixed(2)}</span>
                            <span>×{minPower.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                {/* Legend below chart */}
                <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-xs text-neutral-500">
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-neutral-300 dark:bg-neutral-600" />
                        Baseline
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--accent-alt)' }} />
                        Improved
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'var(--accent)' }} />
                        Same/Worse
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-4 border-t-2 border-dashed border-neutral-900 dark:border-white" />
                        Power
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="p-5 space-y-6">
            {/* Header - Stacked Layout */}
            <div className="space-y-4">
                {/* Program Name */}
                <div className="text-base font-medium text-neutral-900 dark:text-white">{preset.name}</div>

                {/* Controls: Single row with Run button, params, and export */}
                <div className="flex items-center gap-2">
                    {/* Run Test Button */}
                    <button
                        onClick={runFullTest}
                        disabled={isRunning}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-sm uppercase text-white disabled:opacity-50 flex-1"
                        style={{ backgroundColor: 'var(--accent)' }}
                    >
                        {isRunning ? (
                            <><RefreshCw size={16} className="animate-spin" /> {Math.round(progress)}%</>
                        ) : (
                            <><Play size={16} /> Run Test</>
                        )}
                    </button>

                    {/* Parameter Controls - Compact */}
                    <select
                        value={weekCount}
                        onChange={(e) => setWeekCount(Number(e.target.value))}
                        disabled={weekOptions.isFixed}
                        title="Weeks"
                        className="bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-3 py-2 text-sm font-mono disabled:opacity-50"
                    >
                        {weekDropdownOptions.map(n => <option key={n} value={n}>{n}w</option>)}
                    </select>

                    <select
                        value={iterations}
                        onChange={(e) => setIterations(Number(e.target.value))}
                        title="Iterations"
                        className="bg-neutral-100 dark:bg-neutral-800 border-none rounded-xl px-3 py-2 text-sm font-mono"
                    >
                        {[1, 10, 100, 1000, 10000].map(n => <option key={n} value={n}>{n >= 1000 ? `${n / 1000}k` : n}</option>)}
                    </select>

                    {/* Export Button - Icon only when results exist */}
                    {weeklySummaries.length > 0 && (
                        <button
                            onClick={exportResults}
                            title="Export Results"
                            className="flex items-center justify-center p-2 rounded-xl bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
                        >
                            <Download size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            {isRunning && (
                <div className="h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: 'var(--accent)' }} />
                </div>
            )}

            {/* Stats Cards */}
            {overallStats && (
                <div className="grid grid-cols-2 gap-4">
                    {/* Fatigue */}
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5">
                        <div className="text-[10px] font-bold uppercase text-neutral-400 mb-1">Avg Fatigue</div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold">{overallStats.avgAdaptFatigue}%</span>
                            {overallStats.avgAdaptFatigue !== overallStats.avgBaseFatigue && (
                                <span className={`text-sm font-medium ${overallStats.avgAdaptFatigue < overallStats.avgBaseFatigue ? 'text-green-500' : 'text-red-500'}`}>
                                    {overallStats.avgAdaptFatigue < overallStats.avgBaseFatigue ? '↓' : '↑'}
                                    {Math.abs(overallStats.avgAdaptFatigue - overallStats.avgBaseFatigue)}
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-neutral-500 mt-2">
                            Peak: <strong>{overallStats.peakAdaptFatigue}%</strong> (baseline: {overallStats.peakBaseFatigue}%)
                        </div>
                    </div>

                    {/* Readiness */}
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5">
                        <div className="text-[10px] font-bold uppercase text-neutral-400 mb-1">Avg Readiness</div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-bold">{overallStats.avgAdaptReadiness}%</span>
                            {overallStats.avgAdaptReadiness !== overallStats.avgBaseReadiness && (
                                <span className={`text-sm font-medium ${overallStats.avgAdaptReadiness > overallStats.avgBaseReadiness ? 'text-green-500' : 'text-red-500'}`}>
                                    {overallStats.avgAdaptReadiness > overallStats.avgBaseReadiness ? '↑' : '↓'}
                                    {Math.abs(overallStats.avgAdaptReadiness - overallStats.avgBaseReadiness)}
                                </span>
                            )}
                        </div>
                        <div className="text-xs text-neutral-500 mt-2">
                            Baseline: {overallStats.avgBaseReadiness}%
                        </div>
                    </div>

                    {/* Modifiers - Full Width */}
                    <div className="col-span-2 rounded-2xl border p-5" style={{
                        backgroundColor: 'color-mix(in srgb, var(--accent) 5%, transparent)',
                        borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)'
                    }}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: 'var(--accent)' }}>
                                    <Zap size={24} className="text-white" />
                                </div>
                                <div>
                                    <div className="text-xs font-bold uppercase" style={{ color: 'var(--accent)' }}>Adaptive Engine</div>
                                    <div className="text-sm text-neutral-500">
                                        {overallStats.coachModifierCount} coach modifiers + auto-adaptive
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-3xl font-bold">{Math.round(totalTriggers)}</div>
                                <div className="text-xs text-neutral-500">
                                    <span style={{ color: 'var(--accent)' }}>{overallStats.totalCoachTriggers}</span> coach /
                                    <span className="text-blue-500"> {overallStats.totalAutoTriggers}</span> auto
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Fatigue Chart */}
            {visibleData.length > 0 && renderBarChart(
                visibleData,
                w => w.baselineFatigue,
                w => w.adaptiveFatigue,
                w => w.baselineFatigueP30,
                w => w.baselineFatigueP70,
                w => w.adaptiveFatigueP30,
                w => w.adaptiveFatigueP70,
                'Week-by-Week Fatigue',
                'var(--accent-alt)',
                false,
                fatigueScrollRef,
                handleSyncScroll('fatigue')
            )}

            {/* Readiness Chart */}
            {visibleData.length > 0 && renderBarChart(
                visibleData,
                w => w.baselineReadiness,
                w => w.adaptiveReadiness,
                w => w.baselineReadinessP30,
                w => w.baselineReadinessP70,
                w => w.adaptiveReadinessP30,
                w => w.adaptiveReadinessP70,
                'Week-by-Week Readiness',
                'var(--accent)',
                true,
                readinessScrollRef,
                handleSyncScroll('readiness')
            )}

            {/* Selected Week Details */}
            {selectedWeek !== null && weeklySummaries[selectedWeek] && (
                <div className="rounded-2xl border p-5" style={{
                    backgroundColor: 'color-mix(in srgb, var(--accent) 5%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)'
                }}>
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-bold">Week {weeklySummaries[selectedWeek].week}: {weeklySummaries[selectedWeek].phaseName}</h4>
                        <span className="text-sm px-3 py-1 rounded-lg font-mono" style={{
                            backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)'
                        }}>
                            Power ×{weeklySummaries[selectedWeek].powerMult.toFixed(2)}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <div className="text-xs font-bold uppercase text-neutral-500 mb-2">Fatigue</div>
                            <div className="flex items-center gap-2 text-lg">
                                <span className="text-neutral-400">{weeklySummaries[selectedWeek].baselineFatigue}%</span>
                                <span className="text-neutral-300">→</span>
                                <span className="font-bold" style={{ color: 'var(--accent-alt)' }}>{weeklySummaries[selectedWeek].adaptiveFatigue}%</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-xs font-bold uppercase text-neutral-500 mb-2">Readiness</div>
                            <div className="flex items-center gap-2 text-lg">
                                <span className="text-neutral-400">{weeklySummaries[selectedWeek].baselineReadiness}%</span>
                                <span className="text-neutral-300">→</span>
                                <span className="font-bold" style={{ color: 'var(--accent)' }}>{weeklySummaries[selectedWeek].adaptiveReadiness}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Triggered Modifiers Breakdown */}
                    {weeklySummaries[selectedWeek].triggerBreakdown.size > 0 && (
                        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                            <div className="text-xs font-bold uppercase text-neutral-500 mb-3">Triggered Modifiers (sorted by frequency)</div>
                            <div className="space-y-2">
                                {[...weeklySummaries[selectedWeek].triggerBreakdown.entries()]
                                    .sort((a, b) => b[1] - a[1])
                                    .slice(0, 5)
                                    .map(([msg, count]) => (
                                        <div key={msg} className="flex items-start justify-between gap-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg px-3 py-2">
                                            <span className={`text-sm flex-1 leading-tight ${msg.startsWith('[Coach]') ? 'text-purple-600 dark:text-purple-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                                {msg}
                                            </span>
                                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{
                                                backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                                                color: 'var(--accent)'
                                            }}>
                                                {count}×
                                            </span>
                                        </div>
                                    ))
                                }
                            </div>
                        </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 text-sm text-neutral-500">
                        Total triggers: <strong>{weeklySummaries[selectedWeek].triggers.toFixed(1)}</strong>
                        (<span className="text-purple-500">{weeklySummaries[selectedWeek].coachTriggers.toFixed(1)} coach</span> /
                        <span className="text-blue-500"> {weeklySummaries[selectedWeek].autoAdaptiveTriggers.toFixed(1)} auto</span>)
                    </div>
                </div>
            )}

            {/* Coach Modifiers List */}
            {coachModifiers.length > 0 && (
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                    <button onClick={() => setShowModifiers(!showModifiers)} className="flex items-center justify-between w-full p-5">
                        <h4 className="text-sm font-bold flex items-center gap-2">
                            <Zap size={16} className="text-purple-500" />
                            Coach Modifiers ({coachModifiers.length})
                        </h4>
                        {showModifiers ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {showModifiers && (
                        <div className="px-5 pb-5 space-y-2">
                            {coachModifiers.map((mod, i) => (
                                <div key={i} className="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-3 text-sm">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-mono bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded text-xs">P{mod.priority}</span>
                                        {mod.cyclePhase && (
                                            <span className="px-1.5 py-0.5 rounded text-xs" style={{
                                                backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)'
                                            }}>{mod.cyclePhase}</span>
                                        )}
                                    </div>
                                    <div className="text-neutral-600 dark:text-neutral-400">{mod.adjustments.message || 'No message'}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};

export default ModifierTestingPanel;
