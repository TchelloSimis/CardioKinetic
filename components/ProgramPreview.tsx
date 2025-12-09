import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { FatigueModifier } from '../programTemplate';
import { formatCondition, SelectInput } from './ProgramInputs';
import { EditorState } from './ProgramEditor';
import { calculateBlockMetricsFromTemplate } from '../utils/blockCalculations';

// ============================================================================
// CUSTOM TOOLTIP
// ============================================================================

const PreviewTooltip = ({ active, payload, label }: any) => {
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

interface ProgramPreviewProps {
    editorState: EditorState;
    previewWeekCount: number;
    setPreviewWeekCount: React.Dispatch<React.SetStateAction<number>>;
    setShowPreview: React.Dispatch<React.SetStateAction<boolean>>;
}

// ============================================================================
// COMPONENT
// ============================================================================

const ProgramPreview: React.FC<ProgramPreviewProps> = ({
    editorState,
    previewWeekCount,
    setPreviewWeekCount,
    setShowPreview
}) => {
    const weekOptions = editorState.weekConfigType === 'variable'
        ? Array.from({ length: Math.floor((editorState.rangeMax - editorState.rangeMin) / editorState.rangeStep) + 1 }, (_, i) => editorState.rangeMin + i * editorState.rangeStep)
        : [editorState.fixedWeeks];

    // Generate preview data based on selected week count
    const selectedWeekCount = weekOptions.includes(previewWeekCount) ? previewWeekCount : weekOptions[weekOptions.length - 1];
    const basePower = 150; // Use standard base power for preview

    // Helper to resolve duration (number or percentage string)
    const resolveDuration = (duration: number | string | undefined, defaultMins: number): number => {
        if (duration === undefined) return defaultMins;
        if (typeof duration === 'number') return duration;
        const percentMatch = String(duration).match(/^(\d+)%$/);
        if (percentMatch) {
            return Math.round(defaultMins * parseInt(percentMatch[1], 10) / 100);
        }
        return defaultMins;
    };

    // Helper to format duration for display
    const formatDuration = (duration: number | string | undefined, defaultMins: number): string => {
        if (duration === undefined) return `${defaultMins} min`;
        if (typeof duration === 'string' && duration.endsWith('%')) return duration;
        return `${duration} min`;
    };

    // Generate chart data from weeks - estimate interpolated weeks
    const chartData = (() => {
        if (editorState.weeks.length === 0) return [];

        const data: { week: number; power: number; work: number; phase: string }[] = [];
        const durationMins = editorState.defaultDurationMinutes || 15;

        // Convert all week definitions to progress values and sort them
        const defsWithProgress = editorState.weeks.map(def => {
            let defProgress = 0;
            if (def.position === 'first') defProgress = 0;
            else if (def.position === 'last') defProgress = 1;
            else if (typeof def.position === 'string' && def.position.endsWith('%')) {
                defProgress = parseFloat(def.position) / 100;
            } else if (typeof def.position === 'number') {
                defProgress = (def.position - 1) / Math.max(1, selectedWeekCount - 1);
            }
            return { def, defProgress };
        }).sort((a, b) => a.defProgress - b.defProgress);

        // For each week, find the definition that "owns" it using floor semantics
        // Each definition owns weeks from its position until the next definition starts
        for (let w = 1; w <= selectedWeekCount; w++) {
            // Calculate progress as 0 to 1, where week 1 = 0 and week N = 1
            const progress = selectedWeekCount > 1 ? (w - 1) / (selectedWeekCount - 1) : 0;

            // Find the definition with highest position <= current week's progress (floor)
            let weekDef = defsWithProgress[0].def; // Default to first
            for (const { def, defProgress } of defsWithProgress) {
                if (defProgress <= progress) {
                    weekDef = def;
                } else {
                    break; // Since sorted, no need to check further
                }
            }

            let power: number;
            let work: number;

            // Check if this is a custom session with blocks
            if (weekDef.sessionStyle === 'custom' && weekDef.blocks && weekDef.blocks.length > 0) {
                // Use block-aware calculation for custom sessions
                const metrics = calculateBlockMetricsFromTemplate(weekDef.blocks, basePower, weekDef.powerMultiplier);
                power = metrics.averagePower;
                work = metrics.totalWork;
            } else {
                // Standard calculation for non-custom sessions
                power = Math.round(basePower * weekDef.powerMultiplier);
                const resolvedDuration = resolveDuration(weekDef.durationMinutes, durationMins);
                work = Math.round(power * resolvedDuration / 60); // Wh = Power (W) × Duration (min) / 60
            }

            data.push({
                week: w,
                power,
                work,
                phase: weekDef.phaseName
            });
        }

        return data;
    })();

    const formatSessionStyle = (style: string) => {
        if (style === 'interval') return 'Interval Training';
        if (style === 'steady-state') return 'Steady-State';
        return style.charAt(0).toUpperCase() + style.slice(1);
    };

    const formatProgressionMode = (mode: string) => {
        if (mode === 'power') return 'Power Progression';
        if (mode === 'duration') return 'Duration Progression';
        if (mode === 'double') return 'Double Progression';
        return mode.charAt(0).toUpperCase() + mode.slice(1);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-lg font-medium text-neutral-900 dark:text-white">Template Preview</h3>
                <div className="flex items-center gap-3">
                    {editorState.weekConfigType === 'variable' && (
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-neutral-500">Preview Weeks:</label>
                            <div className="min-w-[100px]">
                                <SelectInput
                                    value={previewWeekCount}
                                    options={weekOptions.map(w => ({ value: w, label: `${w} Weeks` }))}
                                    onChange={(val) => setPreviewWeekCount(Number(val))}
                                    className="bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1 text-xs outline-none"
                                />
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setShowPreview(false)}
                        className="px-3 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                    >
                        Back to Editor
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <div className="space-y-4">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Name</span>
                        <p className="text-lg font-medium text-neutral-900 dark:text-white">{editorState.name || 'Untitled'}</p>
                    </div>
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Description</span>
                        <p className="text-sm text-neutral-600 dark:text-neutral-300">{editorState.description || 'No description'}</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Week Options</span>
                            <p className="text-sm font-mono">{weekOptions.join(', ')} weeks</p>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Session Style</span>
                            <p className="text-sm">{formatSessionStyle(editorState.defaultSessionStyle)}</p>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Progression</span>
                            <p className="text-sm">{formatProgressionMode(editorState.progressionMode)}</p>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Duration</span>
                            <p className="text-sm">{editorState.defaultDurationMinutes} min</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Combined Progression Chart */}
            {chartData.length > 0 && (
                <div className="bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 sm:p-6 shadow-lg">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4">
                        Program Progression ({selectedWeekCount} Weeks)
                    </h4>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 10, right: 30, left: -10, bottom: 5 }}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="currentColor"
                                    className="text-neutral-200 dark:text-neutral-800"
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="week"
                                    tick={{ fontSize: 10, fill: 'currentColor' }}
                                    stroke="transparent"
                                    className="text-neutral-500"
                                    tickFormatter={(v) => `W${v}`}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    yAxisId="power"
                                    tick={{ fontSize: 10, fill: 'currentColor' }}
                                    stroke="transparent"
                                    className="text-neutral-500"
                                    domain={['dataMin - 10', 'dataMax + 10']}
                                    tickFormatter={(v) => `${v}`}
                                    axisLine={false}
                                    tickLine={false}
                                    width={35}
                                />
                                <YAxis
                                    yAxisId="work"
                                    orientation="right"
                                    tick={{ fontSize: 10, fill: 'currentColor' }}
                                    stroke="transparent"
                                    className="text-neutral-500"
                                    tickFormatter={(v) => `${v}`}
                                    axisLine={false}
                                    tickLine={false}
                                    width={35}
                                />
                                <Tooltip
                                    content={<PreviewTooltip />}
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
                                    activeDot={{ r: 5, fill: 'var(--accent)', strokeWidth: 2, stroke: 'white' }}
                                />
                                <Line
                                    yAxisId="work"
                                    type="monotone"
                                    dataKey="work"
                                    name="Work"
                                    stroke="var(--accent-alt)"
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 5, fill: 'var(--accent-alt)', strokeWidth: 2, stroke: 'white' }}
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
            )}

            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h4 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4">
                    Week Definitions ({editorState.weeks.length} keyframes)
                </h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-[10px] uppercase text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
                            <tr>
                                <th className="text-left py-2 px-2">Position</th>
                                <th className="text-left py-2 px-2">Phase</th>
                                <th className="text-left py-2 px-2">Focus</th>
                                {(editorState.progressionMode === 'power' || editorState.progressionMode === 'double') && (
                                    <th className="text-left py-2 px-2">Power</th>
                                )}
                                {(editorState.progressionMode === 'duration' || editorState.progressionMode === 'double') && (
                                    <th className="text-left py-2 px-2">Duration</th>
                                )}
                                <th className="text-left py-2 px-2">RPE</th>
                                <th className="text-left py-2 px-2">Work:Rest</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                            {editorState.weeks.map((week, i) => (
                                <tr key={i}>
                                    <td className="py-2 px-2 font-mono text-xs">{String(week.position)}</td>
                                    <td className="py-2 px-2">{week.phaseName}</td>
                                    <td className="py-2 px-2">{week.focus}</td>
                                    {(editorState.progressionMode === 'power' || editorState.progressionMode === 'double') && (
                                        <td className="py-2 px-2 font-mono">{(week.powerMultiplier * 100).toFixed(0)}%</td>
                                    )}
                                    {(editorState.progressionMode === 'duration' || editorState.progressionMode === 'double') && (
                                        <td className="py-2 px-2 font-mono">{formatDuration(week.durationMinutes, editorState.defaultDurationMinutes)}</td>
                                    )}
                                    <td className="py-2 px-2 font-mono">{week.targetRPE}</td>
                                    <td className="py-2 px-2 font-mono">{week.workRestRatio}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {editorState.fatigueModifiers.length > 0 && (
                <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4">
                        Fatigue Modifiers ({editorState.fatigueModifiers.length})
                    </h4>
                    <div className="space-y-2">
                        {editorState.fatigueModifiers.map((mod, i) => (
                            <div key={i} className="p-3 bg-neutral-50 dark:bg-neutral-950 rounded-lg text-xs">
                                <span className="font-medium">{formatCondition(mod.condition)}</span>
                                {mod.phase && <span className="text-neutral-400 ml-2">• {mod.phase}</span>}
                                {mod.weekPosition && <span className="text-neutral-400 ml-2">• {mod.weekPosition}</span>}
                                <div className="text-neutral-500 mt-1">
                                    {mod.adjustments.powerMultiplier && `Power: ${(mod.adjustments.powerMultiplier * 100).toFixed(0)}% `}
                                    {mod.adjustments.rpeAdjust && `RPE: ${mod.adjustments.rpeAdjust > 0 ? '+' : ''}${mod.adjustments.rpeAdjust} `}
                                    {mod.adjustments.volumeMultiplier && `Volume: ${(mod.adjustments.volumeMultiplier * 100).toFixed(0)}%`}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProgramPreview;
