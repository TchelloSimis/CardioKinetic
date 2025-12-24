import React, { useState, useCallback } from 'react';
import { Activity, Plus, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { FatigueModifier, FatigueAdjustments, FlexibleCondition, ThresholdCondition, ProgramTemplate } from '../../programTemplate';
import { suggestModifiersAsync } from '../../utils/suggestModifiers';
import { expandBlocksToWeeks } from '../../utils/blockExpansion';
import { EditorState } from '../ProgramEditor';
import { SelectInput } from '../ProgramInputs';

interface FatigueModifiersStepProps {
    editorState: EditorState;
    setEditorState: React.Dispatch<React.SetStateAction<EditorState>>;
}

// Operators for threshold conditions
const OPERATORS = [
    { value: '>', label: '>' },
    { value: '<', label: '<' },
    { value: '>=', label: '>=' },
    { value: '<=', label: '<=' },
];

const LOGIC_OPTIONS = [
    { value: 'and', label: 'AND' },
    { value: 'or', label: 'OR' },
];

// Helper to parse a threshold condition like ">70" into operator and value
const parseThreshold = (threshold: string | undefined): { operator: string; value: number } => {
    if (!threshold) return { operator: '>', value: 50 };
    const match = threshold.match(/^(>=|<=|>|<)?(\d+)$/);
    if (match) {
        return { operator: match[1] || '>', value: parseInt(match[2]) };
    }
    return { operator: '>', value: 50 };
};

// Helper to build a threshold string from operator and value
const buildThreshold = (operator: string, value: number): ThresholdCondition => {
    return `${operator}${value}` as ThresholdCondition;
};

// Helper to normalize legacy string conditions to FlexibleCondition
const normalizeCondition = (condition: any): FlexibleCondition => {
    if (typeof condition === 'object' && condition !== null && 'logic' in condition) {
        return condition as FlexibleCondition;
    }
    // Convert legacy string conditions to FlexibleCondition
    switch (condition) {
        case 'low_fatigue':
            return { fatigue: '<30', logic: 'and' };
        case 'moderate_fatigue':
            return { fatigue: '>30', logic: 'and' }; // Simplified
        case 'high_fatigue':
            return { fatigue: '>60', logic: 'and' };
        case 'very_high_fatigue':
            return { fatigue: '>80', logic: 'and' };
        case 'fresh':
            return { readiness: '>65', logic: 'and' };
        case 'recovered':
            return { readiness: '>50', logic: 'and' };
        case 'tired':
            return { readiness: '<50', logic: 'and' };
        case 'overreached':
            return { readiness: '<35', logic: 'and' };
        default:
            return { fatigue: '>60', logic: 'and' };
    }
};

const FatigueModifiersStep: React.FC<FatigueModifiersStepProps> = ({ editorState, setEditorState }) => {
    // State for loading indicator during simulation
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationProgress, setSimulationProgress] = useState(0);

    // Handle suggest modifiers button click
    const handleSuggestModifiers = useCallback(async () => {
        setIsSimulating(true);
        setSimulationProgress(0);

        try {
            // Determine expanded weeks based on structure type
            let expandedWeeks = editorState.weeks;
            const basePower = 200; // Default base power for simulation

            if (editorState.structureType === 'block-based') {
                // Build a temporary template for block expansion
                const tempTemplate: ProgramTemplate = {
                    templateVersion: '1.0',
                    id: 'temp',
                    name: 'temp',
                    description: '',
                    weekConfig: { type: 'fixed', fixed: editorState.fixedWeeks },
                    defaultSessionStyle: editorState.defaultSessionStyle,
                    progressionMode: editorState.progressionMode,
                    defaultSessionDurationMinutes: editorState.defaultDurationMinutes,
                    weeks: [],
                    structureType: 'block-based',
                    programBlocks: editorState.programBlocks,
                    fixedFirstWeek: editorState.fixedFirstWeek || undefined,
                    fixedLastWeek: editorState.fixedLastWeek || undefined,
                };
                expandedWeeks = expandBlocksToWeeks(tempTemplate, editorState.fixedWeeks, basePower);
            }

            if (expandedWeeks.length === 0) {
                alert('Please add week definitions or blocks before suggesting modifiers.');
                setIsSimulating(false);
                return;
            }

            // Run async simulation with progress callback
            const suggestedModifiers = await suggestModifiersAsync(
                expandedWeeks,
                basePower,
                100000, // 100k simulations
                (progress) => setSimulationProgress(Math.round(progress * 100))
            );

            if (suggestedModifiers.length === 0) {
                alert('No anomalies detected - your program appears well balanced!');
            } else {
                // Append suggested modifiers to existing ones
                setEditorState(prev => ({
                    ...prev,
                    fatigueModifiers: [...prev.fatigueModifiers, ...suggestedModifiers]
                }));
            }
        } catch (error) {
            console.error('Error during simulation:', error);
            alert('An error occurred during simulation. Please try again.');
        } finally {
            setIsSimulating(false);
            setSimulationProgress(0);
        }
    }, [editorState, setEditorState]);

    const addModifier = () => {
        const newModifier: FatigueModifier = {
            condition: {
                fatigue: '>70',
                logic: 'and'
            },
            adjustments: {
                powerMultiplier: 0.9,
            },
        };
        setEditorState(prev => ({
            ...prev,
            fatigueModifiers: [...prev.fatigueModifiers, newModifier]
        }));
    };

    const updateCondition = (index: number, updates: Partial<FlexibleCondition>) => {
        setEditorState(prev => ({
            ...prev,
            fatigueModifiers: prev.fatigueModifiers.map((m, i) => {
                if (i !== index) return m;
                const currentCondition = normalizeCondition(m.condition);
                return {
                    ...m,
                    condition: { ...currentCondition, ...updates }
                };
            })
        }));
    };

    const updateAdjustments = (index: number, adjustments: Partial<FatigueAdjustments>) => {
        setEditorState(prev => ({
            ...prev,
            fatigueModifiers: prev.fatigueModifiers.map((m, i) =>
                i === index ? { ...m, adjustments: { ...m.adjustments, ...adjustments } } : m
            )
        }));
    };

    const removeModifier = (index: number) => {
        setEditorState(prev => ({
            ...prev,
            fatigueModifiers: prev.fatigueModifiers.filter((_, i) => i !== index)
        }));
    };

    const updatePriority = (index: number, priority: number) => {
        setEditorState(prev => ({
            ...prev,
            fatigueModifiers: prev.fatigueModifiers.map((m, i) =>
                i === index ? { ...m, priority } : m
            )
        }));
    };

    const updatePhaseName = (index: number, phaseName: string | undefined) => {
        setEditorState(prev => ({
            ...prev,
            fatigueModifiers: prev.fatigueModifiers.map((m, i) =>
                i === index ? { ...m, phaseName: phaseName || undefined } : m
            )
        }));
    };

    // Get all available phase names from weeks and blocks
    const getAvailablePhaseNames = (): string[] => {
        const phaseNames = new Set<string>();

        // From week definitions
        editorState.weeks.forEach(week => {
            if (week.phaseName) phaseNames.add(week.phaseName);
        });

        // From program blocks
        editorState.programBlocks.forEach(block => {
            if (block.phaseName) phaseNames.add(block.phaseName);
        });

        // From fixed first/last weeks
        if (editorState.fixedFirstWeek?.phaseName) phaseNames.add(editorState.fixedFirstWeek.phaseName);
        if (editorState.fixedLastWeek?.phaseName) phaseNames.add(editorState.fixedLastWeek.phaseName);

        return Array.from(phaseNames).sort();
    };

    const availablePhaseNames = getAvailablePhaseNames();

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                    <Activity size={14} style={{ color: 'var(--accent)' }} />
                    Fatigue Modifiers ({editorState.fatigueModifiers.length})
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={handleSuggestModifiers}
                        disabled={isSimulating}
                        className="px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 border-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        style={{
                            borderColor: 'var(--accent)',
                            color: isSimulating ? 'var(--accent)' : 'var(--accent)',
                            backgroundColor: 'transparent'
                        }}
                        title="Run Monte Carlo simulation to suggest optimal modifiers"
                    >
                        {isSimulating ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                {simulationProgress}%
                            </>
                        ) : (
                            <>
                                <Sparkles size={14} />
                                Suggest
                            </>
                        )}
                    </button>
                    <button
                        onClick={addModifier}
                        className="px-3 py-2 rounded-xl text-white text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg shadow-accent/20 whitespace-nowrap"
                        style={{ backgroundColor: 'var(--accent)' }}
                    >
                        <Plus size={14} />
                        Add
                    </button>
                </div>
            </div>

            {editorState.fatigueModifiers.length === 0 ? (
                <div className="text-center py-12 text-neutral-400 bg-neutral-50 dark:bg-neutral-900/50 rounded-3xl border-2 border-dashed border-neutral-200 dark:border-neutral-800">
                    <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-4">
                        <Activity size={32} className="opacity-50" />
                    </div>
                    <p className="font-medium mb-1">No modifiers defined</p>
                    <p className="text-xs opacity-60 max-w-md mx-auto">
                        Fatigue modifiers allow the program to automatically adjust based on your daily fatigue and readiness scores.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {editorState.fatigueModifiers.map((modifier, index) => {
                        const condition = normalizeCondition(modifier.condition);
                        const fatigueThreshold = parseThreshold(condition.fatigue);
                        const readinessThreshold = parseThreshold(condition.readiness);

                        return (
                            <div
                                key={index}
                                className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700"
                            >
                                {/* Header with Priority */}
                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-neutral-200 dark:border-neutral-700">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-bold uppercase text-neutral-400">Modifier #{index + 1}</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-medium text-neutral-500">Priority:</span>
                                            <input
                                                type="number"
                                                min="0"
                                                max="99"
                                                value={modifier.priority ?? 0}
                                                onChange={(e) => updatePriority(index, parseInt(e.target.value) || 0)}
                                                className="w-14 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1 text-xs font-mono text-center outline-none focus:border-accent"
                                                title="Lower number = higher priority. Only one modifier triggers per session."
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => removeModifier(index)}
                                        className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Remove modifier"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="flex-1 space-y-4">
                                        {/* Condition Row */}
                                        <div className="space-y-3">
                                            <span className="text-xs font-bold uppercase text-neutral-400">When</span>

                                            {/* Fatigue Threshold */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-xs font-medium text-neutral-500 w-20">Fatigue</span>
                                                <div className="w-16">
                                                    <SelectInput
                                                        value={fatigueThreshold.operator}
                                                        options={OPERATORS}
                                                        onChange={(val) => updateCondition(index, {
                                                            fatigue: buildThreshold(val, fatigueThreshold.value)
                                                        })}
                                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-xs font-mono outline-none"
                                                    />
                                                </div>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={fatigueThreshold.value}
                                                    onChange={(e) => updateCondition(index, {
                                                        fatigue: buildThreshold(fatigueThreshold.operator, parseInt(e.target.value) || 0)
                                                    })}
                                                    className="w-16 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-xs font-mono text-center outline-none focus:border-accent"
                                                />
                                                <span className="text-xs text-neutral-400">%</span>
                                                <button
                                                    onClick={() => updateCondition(index, {
                                                        fatigue: condition.fatigue ? undefined : buildThreshold('>', 50)
                                                    })}
                                                    className={`text-[10px] px-2 py-1 rounded transition-colors ${condition.fatigue ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'}`}
                                                >
                                                    {condition.fatigue ? 'ON' : 'OFF'}
                                                </button>
                                            </div>

                                            {/* Logic Selector */}
                                            <div className="flex items-center gap-2 pl-20">
                                                <SelectInput
                                                    value={condition.logic}
                                                    options={LOGIC_OPTIONS}
                                                    onChange={(val) => updateCondition(index, { logic: val as 'and' | 'or' })}
                                                    className="w-20 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1 text-xs font-bold text-center outline-none"
                                                />
                                            </div>

                                            {/* Readiness Threshold */}
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-xs font-medium text-neutral-500 w-20">Readiness</span>
                                                <div className="w-16">
                                                    <SelectInput
                                                        value={readinessThreshold.operator}
                                                        options={OPERATORS}
                                                        onChange={(val) => updateCondition(index, {
                                                            readiness: buildThreshold(val, readinessThreshold.value)
                                                        })}
                                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-xs font-mono outline-none"
                                                    />
                                                </div>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    value={readinessThreshold.value}
                                                    onChange={(e) => updateCondition(index, {
                                                        readiness: buildThreshold(readinessThreshold.operator, parseInt(e.target.value) || 0)
                                                    })}
                                                    className="w-16 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-xs font-mono text-center outline-none focus:border-accent"
                                                />
                                                <span className="text-xs text-neutral-400">%</span>
                                                <button
                                                    onClick={() => updateCondition(index, {
                                                        readiness: condition.readiness ? undefined : buildThreshold('>', 50)
                                                    })}
                                                    className={`text-[10px] px-2 py-1 rounded transition-colors ${condition.readiness ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'}`}
                                                >
                                                    {condition.readiness ? 'ON' : 'OFF'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Phase Name Filter */}
                                        <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-xs font-bold uppercase text-neutral-400">Only in Phase:</span>
                                                {availablePhaseNames.length > 0 ? (
                                                    <select
                                                        value={typeof modifier.phaseName === 'string' ? modifier.phaseName : ''}
                                                        onChange={(e) => updatePhaseName(index, e.target.value || undefined)}
                                                        className="flex-1 max-w-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent"
                                                    >
                                                        <option value="">Any Phase</option>
                                                        {availablePhaseNames.map(name => (
                                                            <option key={name} value={name}>{name}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        value={typeof modifier.phaseName === 'string' ? modifier.phaseName : ''}
                                                        placeholder="Enter phase name (e.g., Build Phase)"
                                                        onChange={(e) => updatePhaseName(index, e.target.value || undefined)}
                                                        className="flex-1 max-w-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-accent"
                                                    />
                                                )}
                                                {modifier.phaseName && (
                                                    <button
                                                        onClick={() => updatePhaseName(index, undefined)}
                                                        className="text-[10px] px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            {modifier.phaseName && !availablePhaseNames.includes(typeof modifier.phaseName === 'string' ? modifier.phaseName : '') && availablePhaseNames.length > 0 && (
                                                <p className="text-[10px] text-amber-500 mt-1">
                                                    ⚠️ Phase name not found in current template
                                                </p>
                                            )}
                                        </div>

                                        {/* Cycle Phase Filter (read-only, set by suggest modifiers) */}
                                        {modifier.cyclePhase && (
                                            <div className="flex flex-wrap items-center gap-2 pt-2">
                                                <span className="text-xs font-bold uppercase text-neutral-400">Cycle Phase:</span>
                                                <div className="flex gap-1">
                                                    {(Array.isArray(modifier.cyclePhase) ? modifier.cyclePhase : [modifier.cyclePhase]).map((phase, i) => (
                                                        <span
                                                            key={i}
                                                            className={`text-[10px] px-2 py-1 rounded font-medium ${phase === 'ascending' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                                                phase === 'peak' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                                                                    phase === 'descending' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                                                        'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                                                }`}
                                                        >
                                                            {phase}
                                                        </span>
                                                    ))}
                                                </div>
                                                <span className="text-[10px] text-neutral-400 italic">(auto-detected)</span>
                                            </div>
                                        )}

                                        {/* Adjustments Row */}
                                        <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
                                            <span className="text-xs font-bold uppercase text-neutral-400 mb-2 block">Then Adjust</span>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">
                                                        Power ×
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.05"
                                                        min="0.1"
                                                        max="2"
                                                        value={modifier.adjustments.powerMultiplier ?? ''}
                                                        placeholder="e.g. 0.9"
                                                        onChange={(e) => updateAdjustments(index, {
                                                            powerMultiplier: e.target.value ? parseFloat(e.target.value) : undefined
                                                        })}
                                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-accent"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">
                                                        RPE +/-
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="1"
                                                        min="-5"
                                                        max="5"
                                                        value={modifier.adjustments.rpeAdjust ?? ''}
                                                        placeholder="e.g. -1"
                                                        onChange={(e) => updateAdjustments(index, {
                                                            rpeAdjust: e.target.value ? parseInt(e.target.value) : undefined
                                                        })}
                                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-accent"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">
                                                        Rest ×
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        min="0.5"
                                                        max="3"
                                                        value={modifier.adjustments.restMultiplier ?? ''}
                                                        placeholder="e.g. 1.5"
                                                        onChange={(e) => updateAdjustments(index, {
                                                            restMultiplier: e.target.value ? parseFloat(e.target.value) : undefined
                                                        })}
                                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-accent"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">
                                                        Volume ×
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        min="0.1"
                                                        max="2"
                                                        value={modifier.adjustments.volumeMultiplier ?? ''}
                                                        placeholder="e.g. 0.8"
                                                        onChange={(e) => updateAdjustments(index, {
                                                            volumeMultiplier: e.target.value ? parseFloat(e.target.value) : undefined
                                                        })}
                                                        className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-xs font-mono outline-none focus:border-accent"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Message Row */}
                                        <div>
                                            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1 block">
                                                Coach's Advice Message
                                            </label>
                                            <input
                                                type="text"
                                                value={modifier.adjustments.message ?? ''}
                                                placeholder="Optional message to show when this modifier is active"
                                                onChange={(e) => updateAdjustments(index, {
                                                    message: e.target.value || undefined
                                                })}
                                                className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-accent"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default FatigueModifiersStep;
