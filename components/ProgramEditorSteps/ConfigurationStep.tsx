import React from 'react';
import { Calendar, Settings2 } from 'lucide-react';
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

const ConfigurationStep: React.FC<ConfigurationStepProps> = ({ editorState, setEditorState }) => {
    return (
        <>
            {/* Week Configuration Section */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                    <Calendar size={14} style={{ color: 'var(--accent)' }} />
                    Week Configuration
                </h3>
                <div className="space-y-4">
                    <div className="flex gap-3">
                        <button
                            onClick={() => setEditorState(prev => ({ ...prev, weekConfigType: 'fixed' }))}
                            className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-colors ${editorState.weekConfigType === 'fixed'
                                ? 'text-white shadow-lg'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                                }`}
                            style={editorState.weekConfigType === 'fixed' ? { backgroundColor: 'var(--accent)' } : {}}
                        >
                            Fixed Length
                        </button>
                        <button
                            onClick={() => setEditorState(prev => ({ ...prev, weekConfigType: 'variable' }))}
                            className={`flex-1 py-3 px-4 rounded-xl text-sm font-medium transition-colors ${editorState.weekConfigType === 'variable'
                                ? 'text-white shadow-lg'
                                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                                }`}
                            style={editorState.weekConfigType === 'variable' ? { backgroundColor: 'var(--accent)' } : {}}
                        >
                            Variable Length
                        </button>
                    </div>

                    {editorState.weekConfigType === 'fixed' ? (
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
                    ) : (
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
