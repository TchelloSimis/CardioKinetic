import React, { useState, useEffect } from 'react';
import { Calendar, Settings2, Layers, Info } from 'lucide-react';
import { SessionStyle, ProgressionMode } from '../../types';
import { NumberInput, SelectInput } from '../ProgramInputs';
import { EditorState } from '../ProgramEditor';

interface ConfigurationStepProps {
    editorState: EditorState;
    setEditorState: React.Dispatch<React.SetStateAction<EditorState>>;
}

const SESSION_STYLE_OPTIONS: { value: SessionStyle; label: string }[] = [
    { value: 'interval', label: 'Interval Training' },
    { value: 'steady-state', label: 'Steady-State' },
];

const PROGRESSION_MODE_OPTIONS: { value: ProgressionMode; label: string }[] = [
    { value: 'power', label: 'Power Progression' },
    { value: 'duration', label: 'Duration Progression' },
    { value: 'double', label: 'Double Progression (Power + Duration)' },
];

// Validate and parse comma-separated durations
const parseCustomDurations = (input: string): { valid: boolean; durations: number[]; error?: string } => {
    if (!input.trim()) {
        return { valid: false, durations: [], error: 'Enter at least one duration' };
    }

    const parts = input.split(',').map(s => s.trim());
    const durations: number[] = [];

    for (const part of parts) {
        const num = parseInt(part, 10);
        if (isNaN(num) || num <= 0 || num > 52) {
            return { valid: false, durations: [], error: `Invalid value: "${part}". Use positive integers 1-52.` };
        }
        if (!Number.isInteger(parseFloat(part))) {
            return { valid: false, durations: [], error: `"${part}" must be a whole number` };
        }
        durations.push(num);
    }

    // Sort and remove duplicates
    const uniqueSorted = [...new Set(durations)].sort((a, b) => a - b);
    return { valid: true, durations: uniqueSorted };
};

const ConfigurationStep: React.FC<ConfigurationStepProps> = ({ editorState, setEditorState }) => {
    const [durationsError, setDurationsError] = useState<string>('');

    // Validate custom durations on input change
    useEffect(() => {
        if (editorState.weekConfigType === 'custom') {
            const result = parseCustomDurations(editorState.customDurationsInput);
            if (result.valid) {
                setDurationsError('');
                setEditorState(prev => ({ ...prev, customDurations: result.durations }));
            } else {
                setDurationsError(result.error || '');
            }
        }
    }, [editorState.customDurationsInput, editorState.weekConfigType]);

    return (
        <>
            {/* Structure Type Section */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                    <Layers size={14} style={{ color: 'var(--accent)' }} />
                    Program Structure
                </h3>
                <div className="space-y-4">
                    <div className="flex gap-3">
                        <button
                            onClick={() => setEditorState(prev => ({ ...prev, structureType: 'week-based' }))}
                            className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-colors ${editorState.structureType === 'week-based'
                                ? 'text-white shadow-lg'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                                }`}
                            style={editorState.structureType === 'week-based' ? { backgroundColor: 'var(--accent)' } : {}}
                        >
                            Week-Based
                        </button>
                        <button
                            onClick={() => setEditorState(prev => ({ ...prev, structureType: 'block-based' }))}
                            className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-colors ${editorState.structureType === 'block-based'
                                ? 'text-white shadow-lg'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                                }`}
                            style={editorState.structureType === 'block-based' ? { backgroundColor: 'var(--accent)' } : {}}
                        >
                            Block-Based
                        </button>
                    </div>
                    <p className="text-xs text-neutral-500 flex items-start gap-2">
                        <Info size={14} className="mt-0.5 flex-shrink-0" />
                        {editorState.structureType === 'week-based'
                            ? 'Define individual weeks with positions. Weeks are interpolated for different program lengths.'
                            : 'Define reusable blocks (e.g., 4-week Builder, 2-week Deload) that repeat to fill the program duration. Configure blocks in the next step.'
                        }
                    </p>
                </div>
            </div>

            {/* Week Configuration Section */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                    <Calendar size={14} style={{ color: 'var(--accent)' }} />
                    Duration Configuration
                </h3>
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setEditorState(prev => ({ ...prev, weekConfigType: 'fixed' }))}
                            className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${editorState.weekConfigType === 'fixed'
                                ? 'text-white shadow-lg'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                                }`}
                            style={editorState.weekConfigType === 'fixed' ? { backgroundColor: 'var(--accent)' } : {}}
                        >
                            Fixed
                        </button>
                        <button
                            onClick={() => setEditorState(prev => ({ ...prev, weekConfigType: 'variable' }))}
                            className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${editorState.weekConfigType === 'variable'
                                ? 'text-white shadow-lg'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                                }`}
                            style={editorState.weekConfigType === 'variable' ? { backgroundColor: 'var(--accent)' } : {}}
                        >
                            Range
                        </button>
                        <button
                            onClick={() => setEditorState(prev => ({ ...prev, weekConfigType: 'custom' }))}
                            className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${editorState.weekConfigType === 'custom'
                                ? 'text-white shadow-lg'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                                }`}
                            style={editorState.weekConfigType === 'custom' ? { backgroundColor: 'var(--accent)' } : {}}
                        >
                            Custom
                        </button>
                    </div>

                    {editorState.weekConfigType === 'fixed' && (
                        <div>
                            <label className="text-xs font-medium text-neutral-500 mb-1 block">Number of Weeks</label>
                            <NumberInput
                                value={editorState.fixedWeeks}
                                onChange={(val) => setEditorState(prev => ({ ...prev, fixedWeeks: val ?? 12 }))}
                                min={1}
                                max={52}
                                placeholder="12"
                                className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-sm focus:border-neutral-400 outline-none font-mono"
                            />
                        </div>
                    )}

                    {editorState.weekConfigType === 'variable' && (
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-xs font-medium text-neutral-500 mb-1 block">Min Weeks</label>
                                <NumberInput
                                    value={editorState.rangeMin}
                                    onChange={(val) => setEditorState(prev => ({ ...prev, rangeMin: val ?? 1 }))}
                                    min={1}
                                    max={52}
                                    placeholder="4"
                                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-sm focus:border-neutral-400 outline-none font-mono"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-neutral-500 mb-1 block">Max Weeks</label>
                                <NumberInput
                                    value={editorState.rangeMax}
                                    onChange={(val) => setEditorState(prev => ({ ...prev, rangeMax: val ?? 12 }))}
                                    min={1}
                                    max={52}
                                    placeholder="12"
                                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-sm focus:border-neutral-400 outline-none font-mono"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-neutral-500 mb-1 block">Step</label>
                                <NumberInput
                                    value={editorState.rangeStep}
                                    onChange={(val) => setEditorState(prev => ({ ...prev, rangeStep: val ?? 1 }))}
                                    min={1}
                                    max={12}
                                    placeholder="1"
                                    className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-sm focus:border-neutral-400 outline-none font-mono"
                                />
                            </div>
                        </div>
                    )}

                    {editorState.weekConfigType === 'custom' && (
                        <div>
                            <label className="text-xs font-medium text-neutral-500 mb-1 block">Valid Durations (comma-separated)</label>
                            <input
                                type="text"
                                value={editorState.customDurationsInput}
                                onChange={(e) => setEditorState(prev => ({ ...prev, customDurationsInput: e.target.value }))}
                                placeholder="8, 10, 12, 14"
                                className={`w-full bg-neutral-50 dark:bg-neutral-950 border rounded-lg px-3 py-2.5 text-sm focus:border-neutral-400 outline-none font-mono ${durationsError
                                        ? 'border-red-400 dark:border-red-600'
                                        : 'border-neutral-200 dark:border-neutral-800'
                                    }`}
                            />
                            {durationsError ? (
                                <p className="text-xs text-red-500 mt-1">{durationsError}</p>
                            ) : editorState.customDurations.length > 0 ? (
                                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                    Valid durations: {editorState.customDurations.join(', ')} weeks
                                </p>
                            ) : (
                                <p className="text-xs text-neutral-400 mt-1">
                                    Enter specific week counts (e.g., "8, 10, 12, 14")
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Program Defaults Section */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                    <Settings2 size={14} style={{ color: 'var(--accent)' }} />
                    Program Defaults
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-medium text-neutral-500 mb-1 block">Session Style</label>
                        <SelectInput
                            value={editorState.defaultSessionStyle}
                            options={SESSION_STYLE_OPTIONS}
                            onChange={(val) => setEditorState(prev => ({ ...prev, defaultSessionStyle: val as SessionStyle }))}
                            className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-sm focus:border-neutral-400 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-neutral-500 mb-1 block">Progression Mode</label>
                        <SelectInput
                            value={editorState.progressionMode}
                            options={PROGRESSION_MODE_OPTIONS}
                            onChange={(val) => setEditorState(prev => ({ ...prev, progressionMode: val as ProgressionMode }))}
                            className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-sm focus:border-neutral-400 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-neutral-500 mb-1 block">Default Duration (min)</label>
                        <NumberInput
                            value={editorState.defaultDurationMinutes}
                            onChange={(val) => setEditorState(prev => ({ ...prev, defaultDurationMinutes: val ?? 15 }))}
                            min={1}
                            max={300}
                            placeholder="15"
                            className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-sm focus:border-neutral-400 outline-none font-mono"
                        />
                    </div>
                </div>
            </div>
        </>
    );
};

export default ConfigurationStep;

