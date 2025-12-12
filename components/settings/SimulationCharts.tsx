/**
 * Simulation Charts Component
 * 
 * Two charts showing Monte Carlo simulation results with percentile bands:
 * 1. Fatigue Chart: Planned power line + fatigue distribution bands
 * 2. Readiness Chart: Planned power line + readiness distribution bands
 */

import React from 'react';
import {
    ComposedChart,
    Line,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import { SimulationResult, flattenForChart } from '../../utils/simulationEngine';

// ============================================================================
// TYPES
// ============================================================================

interface SimulationChartsProps {
    result: SimulationResult;
    isDarkMode: boolean;
}

// ============================================================================
// CUSTOM TOOLTIP
// ============================================================================

const SimulationTooltip = ({ active, payload, label, metric }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0]?.payload;
        if (!data) return null;

        const metricData = metric === 'fatigue'
            ? { min: data.fatigueMin, p25: data.fatigueP25, median: data.fatigueMedian, p75: data.fatigueP75, max: data.fatigueMax }
            : { min: data.readinessMin, p25: data.readinessP25, median: data.readinessMedian, p75: data.readinessP75, max: data.readinessMax };

        return (
            <div className="bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-xl z-50 pointer-events-none">
                <p className="text-neutral-900 dark:text-white font-bold mb-2 text-[10px] tracking-widest uppercase">
                    {label} • {data.phase}
                </p>
                <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between gap-4">
                        <span className="text-neutral-500">Planned Power</span>
                        <span className="font-mono font-bold text-neutral-900 dark:text-white">{data.plannedPower} W</span>
                    </div>
                    <hr className="border-neutral-200 dark:border-neutral-700 my-1" />
                    <div className="flex justify-between gap-4">
                        <span className="text-neutral-500">{metric === 'fatigue' ? 'Fatigue' : 'Readiness'} Median</span>
                        <span className="font-mono font-bold" style={{ color: metric === 'fatigue' ? 'var(--accent-alt)' : 'var(--accent)' }}>
                            {Math.round(metricData.median)}
                        </span>
                    </div>
                    <div className="flex justify-between gap-4 text-neutral-400">
                        <span>25th-75th %ile</span>
                        <span className="font-mono">{Math.round(metricData.p25)}–{Math.round(metricData.p75)}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-neutral-400">
                        <span>Range</span>
                        <span className="font-mono">{Math.round(metricData.min)}–{Math.round(metricData.max)}</span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

// ============================================================================
// COMPONENT
// ============================================================================

const SimulationCharts: React.FC<SimulationChartsProps> = ({ result, isDarkMode }) => {
    const chartData = flattenForChart(result);

    const colors = {
        grid: isDarkMode ? '#262626' : '#e5e5e5',
        text: isDarkMode ? '#737373' : '#a3a3a3',
        powerLine: isDarkMode ? '#ffffff' : '#171717',
    };

    return (
        <div className="space-y-6">
            {/* Fatigue Chart */}
            <div className="bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
                <h4 className="text-sm font-bold uppercase tracking-widest text-neutral-400 p-4 pb-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent-alt)' }}></div>
                    Fatigue Projection
                </h4>
                <div className="h-64 px-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="fatigueMinMax" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--accent-alt)" stopOpacity={0.1} />
                                    <stop offset="100%" stopColor="var(--accent-alt)" stopOpacity={0.05} />
                                </linearGradient>
                                <linearGradient id="fatigueQuartile" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--accent-alt)" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="var(--accent-alt)" stopOpacity={0.15} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="0" stroke={colors.grid} vertical={false} />
                            <XAxis
                                dataKey="name"
                                stroke={colors.text}
                                tick={{ fill: colors.text, fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                yAxisId="power"
                                stroke={colors.text}
                                tick={{ fill: colors.text, fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                domain={['auto', 'auto']}
                            />
                            <YAxis
                                yAxisId="score"
                                orientation="right"
                                stroke={colors.text}
                                tick={{ fill: colors.text, fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                domain={[0, 100]}
                            />
                            <Tooltip content={<SimulationTooltip metric="fatigue" />} />

                            {/* Min-Max band (outer, lighter) */}
                            <Area
                                yAxisId="score"
                                type="monotone"
                                dataKey="fatigueMax"
                                stroke="none"
                                fill="url(#fatigueMinMax)"
                                fillOpacity={1}
                                isAnimationActive={false}
                            />
                            <Area
                                yAxisId="score"
                                type="monotone"
                                dataKey="fatigueMin"
                                stroke="none"
                                fill={isDarkMode ? '#0a0a0a' : '#f5f5f5'}
                                fillOpacity={1}
                                isAnimationActive={false}
                            />

                            {/* 25-75 percentile band (inner, darker) */}
                            <Area
                                yAxisId="score"
                                type="monotone"
                                dataKey="fatigueP75"
                                stroke="none"
                                fill="url(#fatigueQuartile)"
                                fillOpacity={1}
                                isAnimationActive={false}
                            />
                            <Area
                                yAxisId="score"
                                type="monotone"
                                dataKey="fatigueP25"
                                stroke="none"
                                fill={isDarkMode ? '#0a0a0a' : '#f5f5f5'}
                                fillOpacity={1}
                                isAnimationActive={false}
                            />

                            {/* Median line */}
                            <Line
                                yAxisId="score"
                                type="monotone"
                                dataKey="fatigueMedian"
                                name="Fatigue"
                                stroke="var(--accent-alt)"
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                            />

                            {/* Planned Power line */}
                            <Line
                                yAxisId="power"
                                type="monotone"
                                dataKey="plannedPower"
                                name="Power"
                                stroke={colors.powerLine}
                                strokeWidth={2}
                                strokeDasharray="4 4"
                                dot={false}
                                isAnimationActive={false}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-6 mt-3 text-[10px] uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-0.5" style={{ backgroundColor: 'var(--accent-alt)' }}></div>
                        <span className="text-neutral-500">Fatigue (median)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-0.5 border-t-2 border-dashed" style={{ borderColor: colors.powerLine }}></div>
                        <span className="text-neutral-500">Power (W)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm opacity-30" style={{ backgroundColor: 'var(--accent-alt)' }}></div>
                        <span className="text-neutral-500">25-75%</span>
                    </div>
                </div>
            </div>

            {/* Readiness Chart */}
            <div className="bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
                <h4 className="text-sm font-bold uppercase tracking-widest text-neutral-400 p-4 pb-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent)' }}></div>
                    Readiness Projection
                </h4>
                <div className="h-64 px-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="readinessMinMax" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.1} />
                                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.05} />
                                </linearGradient>
                                <linearGradient id="readinessQuartile" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.15} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="0" stroke={colors.grid} vertical={false} />
                            <XAxis
                                dataKey="name"
                                stroke={colors.text}
                                tick={{ fill: colors.text, fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                yAxisId="power"
                                stroke={colors.text}
                                tick={{ fill: colors.text, fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                domain={['auto', 'auto']}
                            />
                            <YAxis
                                yAxisId="score"
                                orientation="right"
                                stroke={colors.text}
                                tick={{ fill: colors.text, fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                domain={[0, 100]}
                            />
                            <Tooltip content={<SimulationTooltip metric="readiness" />} />

                            {/* Min-Max band (outer, lighter) */}
                            <Area
                                yAxisId="score"
                                type="monotone"
                                dataKey="readinessMax"
                                stroke="none"
                                fill="url(#readinessMinMax)"
                                fillOpacity={1}
                                isAnimationActive={false}
                            />
                            <Area
                                yAxisId="score"
                                type="monotone"
                                dataKey="readinessMin"
                                stroke="none"
                                fill={isDarkMode ? '#0a0a0a' : '#f5f5f5'}
                                fillOpacity={1}
                                isAnimationActive={false}
                            />

                            {/* 25-75 percentile band (inner, darker) */}
                            <Area
                                yAxisId="score"
                                type="monotone"
                                dataKey="readinessP75"
                                stroke="none"
                                fill="url(#readinessQuartile)"
                                fillOpacity={1}
                                isAnimationActive={false}
                            />
                            <Area
                                yAxisId="score"
                                type="monotone"
                                dataKey="readinessP25"
                                stroke="none"
                                fill={isDarkMode ? '#0a0a0a' : '#f5f5f5'}
                                fillOpacity={1}
                                isAnimationActive={false}
                            />

                            {/* Median line */}
                            <Line
                                yAxisId="score"
                                type="monotone"
                                dataKey="readinessMedian"
                                name="Readiness"
                                stroke="var(--accent)"
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                            />

                            {/* Planned Power line */}
                            <Line
                                yAxisId="power"
                                type="monotone"
                                dataKey="plannedPower"
                                name="Power"
                                stroke={colors.powerLine}
                                strokeWidth={2}
                                strokeDasharray="4 4"
                                dot={false}
                                isAnimationActive={false}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-6 mt-3 text-[10px] uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-0.5" style={{ backgroundColor: 'var(--accent)' }}></div>
                        <span className="text-neutral-500">Readiness (median)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-0.5 border-t-2 border-dashed" style={{ borderColor: colors.powerLine }}></div>
                        <span className="text-neutral-500">Power (W)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm opacity-30" style={{ backgroundColor: 'var(--accent)' }}></div>
                        <span className="text-neutral-500">25-75%</span>
                    </div>
                </div>
            </div>

            {/* Simulation Info */}
            <div className="text-center text-[10px] text-neutral-400">
                {result.iterations} Monte Carlo iterations • Base Power: {result.basePower}W • {result.weekCount} weeks
            </div>
        </div>
    );
};

export default SimulationCharts;
