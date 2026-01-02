import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ProgramPreset } from '../types';
import { ProgramTemplate, WeekDefinition } from '../programTemplate';
import { calculateBlockMetricsFromTemplate } from '../utils/blockCalculations';
import { expandBlocksToWeeks } from '../utils/blockExpansion';

// ============================================================================
// CUSTOM TOOLTIP
// ============================================================================

const ChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-xl z-50 pointer-events-none">
                <p className="text-neutral-900 dark:text-white font-bold mb-2 text-[10px] tracking-widest uppercase">
                    W{label}
                </p>
                {payload.map((entry: any, index: number) => {
                    if (entry.value === null || entry.value === undefined) return null;
                    const unit = entry.name === 'Power' ? 'W' : 'Wh';
                    return (
                        <div key={index} className="flex items-center justify-between gap-4 mb-1 last:mb-0">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.stroke || entry.fill }}></div>
                                <span className="text-[10px] uppercase text-neutral-500 dark:text-neutral-400">{entry.name}</span>
                            </div>
                            <span className="font-mono font-bold text-xs text-neutral-900 dark:text-white">
                                {Math.round(entry.value)} {unit}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    }
    return null;
};

// ============================================================================
// TYPES
// ============================================================================

interface OnboardingChartsProps {
    preset: ProgramPreset;
    weekCount: number;
    basePower: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

const OnboardingCharts: React.FC<OnboardingChartsProps> = ({
    preset,
    weekCount,
    basePower
}) => {
    // Generate chart data from the preset
    const chartData = useMemo(() => {
        const data: { week: number; power: number; work: number }[] = [];

        // Extended preset type with block-based fields
        const extendedPreset = preset as ProgramPreset & {
            structureType?: 'week-based' | 'block-based';
            programBlocks?: import('../programTemplate').ProgramBlock[];
            fixedFirstWeek?: WeekDefinition;
            fixedLastWeek?: WeekDefinition;
            defaultSessionDurationMinutes?: number;
            weeks?: WeekDefinition[];
        };

        const defaultDuration = extendedPreset.defaultSessionDurationMinutes || 15;

        // Helper to resolve duration
        const resolveDuration = (duration: number | string | undefined, defaultMins: number): number => {
            if (duration === undefined) return defaultMins;
            if (typeof duration === 'number') return duration;
            const percentMatch = String(duration).match(/^(\d+)%$/);
            if (percentMatch) {
                return Math.round(defaultMins * parseInt(percentMatch[1], 10) / 100);
            }
            return defaultMins;
        };

        // Try to generate week definitions
        let weekDefs: WeekDefinition[] = [];

        if (extendedPreset.structureType === 'block-based' && extendedPreset.programBlocks?.length) {
            // Block-based program - use block expansion
            const tempTemplate: ProgramTemplate = {
                templateVersion: '1.0',
                id: 'preview',
                name: preset.name,
                description: preset.description,
                weekConfig: { type: 'fixed', fixed: weekCount },
                defaultSessionStyle: preset.defaultSessionStyle || 'interval',
                progressionMode: preset.progressionMode || 'power',
                defaultSessionDurationMinutes: defaultDuration,
                weeks: [],
                structureType: 'block-based',
                programBlocks: extendedPreset.programBlocks,
                fixedFirstWeek: extendedPreset.fixedFirstWeek,
                fixedLastWeek: extendedPreset.fixedLastWeek,
            };
            weekDefs = expandBlocksToWeeks(tempTemplate, weekCount, basePower);
        } else if (extendedPreset.weeks && extendedPreset.weeks.length > 0) {
            // Week-based with weeks array - interpolate to target week count
            const sourceWeeks = extendedPreset.weeks;

            // Sort by position for interpolation
            const defsWithProgress = sourceWeeks.map(def => {
                let defProgress = 0;
                if (def.position === 'first') defProgress = 0;
                else if (def.position === 'last') defProgress = 1;
                else if (typeof def.position === 'string' && def.position.endsWith('%')) {
                    defProgress = parseFloat(def.position) / 100;
                } else if (typeof def.position === 'number') {
                    defProgress = (def.position - 1) / Math.max(1, weekCount - 1);
                }
                return { def, defProgress };
            }).sort((a, b) => a.defProgress - b.defProgress);

            // For each week, find the definition that "owns" it
            for (let w = 1; w <= weekCount; w++) {
                const progress = weekCount > 1 ? (w - 1) / (weekCount - 1) : 0;
                let weekDef = defsWithProgress[0].def;
                for (const { def, defProgress } of defsWithProgress) {
                    if (defProgress <= progress) {
                        weekDef = def;
                    } else {
                        break;
                    }
                }
                weekDefs.push({ ...weekDef, position: w });
            }
        } else if (typeof preset.generator === 'function') {
            // Use generator function
            const generatedPlan = preset.generator(basePower, weekCount);
            for (let i = 0; i < generatedPlan.length; i++) {
                const week = generatedPlan[i];
                data.push({
                    week: i + 1,
                    power: week.plannedPower,
                    work: Math.round(week.plannedPower * (week.targetDurationMinutes || defaultDuration) / 60)
                });
            }
            return data;
        }

        // Convert week definitions to chart data
        if (weekDefs.length > 0) {
            for (const weekDef of weekDefs) {
                const weekNum = typeof weekDef.position === 'number' ? weekDef.position : 1;
                let power: number;
                let work: number;

                // Check if this is a custom session with blocks
                if (weekDef.sessionStyle === 'custom' && weekDef.blocks && weekDef.blocks.length > 0) {
                    const metrics = calculateBlockMetricsFromTemplate(weekDef.blocks, basePower, weekDef.powerMultiplier);
                    power = metrics.averagePower;
                    work = metrics.totalWork;
                } else {
                    power = Math.round(basePower * weekDef.powerMultiplier);
                    const resolvedDuration = resolveDuration(weekDef.durationMinutes, defaultDuration);
                    work = Math.round(power * resolvedDuration / 60);
                }

                data.push({ week: weekNum, power, work });
            }
        }

        // If still no data, generate a simple linear progression
        if (data.length === 0) {
            for (let w = 1; w <= weekCount; w++) {
                const progress = (w - 1) / Math.max(1, weekCount - 1);
                const power = Math.round(basePower * (0.85 + 0.15 * progress));
                const work = Math.round(power * defaultDuration / 60);
                data.push({ week: w, power, work });
            }
        }

        return data;
    }, [preset, weekCount, basePower]);

    if (chartData.length === 0) {
        return null;
    }

    return (
        <div className="bg-neutral-50 dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-800 rounded-2xl p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-3 text-center">
                Program Progression
            </div>
            <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="currentColor"
                            className="text-neutral-200 dark:text-neutral-800"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="week"
                            tick={{ fontSize: 10 }}
                            stroke="transparent"
                            tickFormatter={(v) => `W${v}`}
                            axisLine={false}
                            tickLine={false}
                            style={{ fill: 'rgb(115, 115, 115)' }}
                        />
                        <YAxis
                            yAxisId="power"
                            tick={{ fontSize: 10 }}
                            stroke="transparent"
                            domain={['dataMin - 10', 'dataMax + 10']}
                            tickFormatter={(v) => `${v}`}
                            axisLine={false}
                            tickLine={false}
                            width={35}
                            style={{ fill: 'rgb(115, 115, 115)' }}
                        />
                        <YAxis
                            yAxisId="work"
                            orientation="right"
                            tick={{ fontSize: 10 }}
                            stroke="transparent"
                            tickFormatter={(v) => `${v}`}
                            axisLine={false}
                            tickLine={false}
                            width={35}
                            style={{ fill: 'rgb(115, 115, 115)' }}
                        />
                        <Tooltip
                            content={<ChartTooltip />}
                            cursor={{ stroke: 'currentColor', strokeWidth: 1, strokeDasharray: '4 4', className: 'text-neutral-400' }}
                        />
                        <Line
                            yAxisId="power"
                            type="monotone"
                            dataKey="power"
                            name="Power"
                            stroke="var(--accent)"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, fill: 'var(--accent)', strokeWidth: 2, stroke: 'white' }}
                        />
                        <Line
                            yAxisId="work"
                            type="monotone"
                            dataKey="work"
                            name="Work"
                            stroke="var(--accent-alt)"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, fill: 'var(--accent-alt)', strokeWidth: 2, stroke: 'white' }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-3 text-[10px] uppercase tracking-widest">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent)' }}></div>
                    <span className="text-neutral-500">Power (W)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent-alt)' }}></div>
                    <span className="text-neutral-500">Work (Wh)</span>
                </div>
            </div>
        </div>
    );
};

export default OnboardingCharts;
