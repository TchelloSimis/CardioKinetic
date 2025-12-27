import React, { useState, useMemo } from 'react';
import { ProgramPreset } from '../types';
import { ArrowRight, Check, ChevronRight, Info, Upload } from 'lucide-react';
import { formatBlockCounts } from '../utils/blockExpansion';
import { getLocalDateString } from '../utils/dateUtils';

interface OnboardingProps {
    presets: ProgramPreset[];
    onComplete: (data: { presetId: string, basePower: number, startDate: string, weekCount?: number }) => void;
    onImportTemplate?: (preset: ProgramPreset) => void;
    initialBasePower?: number;
}

const Onboarding: React.FC<OnboardingProps> = ({ presets, onComplete, onImportTemplate, initialBasePower = 150 }) => {
    const [step, setStep] = useState(0);
    const [selectedPresetId, setSelectedPresetId] = useState<string>(presets[0].id);
    const [basePower, setBasePower] = useState(initialBasePower);
    const [startDate, setStartDate] = useState(getLocalDateString());
    const [selectedWeekCount, setSelectedWeekCount] = useState<number | null>(null);

    const selectedPreset = presets.find(p => p.id === selectedPresetId);

    // Get available week options for the selected preset
    const weekOptions = useMemo(() => {
        if (!selectedPreset) return [12];
        // Use weekOptions from preset if available (from template imports)
        if (selectedPreset.weekOptions && selectedPreset.weekOptions.length > 0) {
            return selectedPreset.weekOptions;
        }
        // Use weekCount if available
        if (selectedPreset.weekCount) {
            return [selectedPreset.weekCount];
        }
        // Only call generator if it exists (not for templates loaded from localStorage)
        if (typeof selectedPreset.generator === 'function') {
            const plan = selectedPreset.generator(150);
            return [plan.length];
        }
        return [12]; // Default fallback
    }, [selectedPreset]);

    // Calculate min/max weeks based on preset settings
    const { minWeeks, maxWeeks } = useMemo(() => {
        if (!selectedPreset) return { minWeeks: 4, maxWeeks: 24 };

        // If preset has explicit min/max, use those
        if (selectedPreset.minWeeks !== undefined || selectedPreset.maxWeeks !== undefined) {
            return {
                minWeeks: selectedPreset.minWeeks ?? 4,
                maxWeeks: selectedPreset.maxWeeks ?? 24
            };
        }

        // If preset has weekOptions (variable-length), use min/max from options
        if (selectedPreset.weekOptions && selectedPreset.weekOptions.length > 0) {
            return {
                minWeeks: Math.min(...selectedPreset.weekOptions),
                maxWeeks: Math.max(...selectedPreset.weekOptions)
            };
        }

        // Default: allow 50% below and 100% above the default weekCount
        const defaultWeeks = weekOptions[0];
        return {
            minWeeks: Math.max(4, Math.floor(defaultWeeks * 0.5)),
            maxWeeks: Math.min(52, Math.ceil(defaultWeeks * 2))
        };
    }, [selectedPreset, weekOptions]);

    // Check if this is a variable-length program
    const isVariableLength = weekOptions.length > 1;

    // Get block composition for block-based templates
    const blockComposition = useMemo(() => {
        if (!selectedPreset) return '';
        // Access the extended preset with block-based fields
        const extendedPreset = selectedPreset as ProgramPreset & {
            structureType?: 'week-based' | 'block-based';
            programBlocks?: import('../programTemplate').ProgramBlock[];
            fixedFirstWeek?: import('../programTemplate').WeekDefinition;
            fixedLastWeek?: import('../programTemplate').WeekDefinition;
            weekConfig?: import('../programTemplate').WeekConfig;
        };

        if (extendedPreset.structureType !== 'block-based' || !extendedPreset.programBlocks?.length) {
            return '';
        }

        // Build a minimal template for formatBlockCounts
        const template = {
            structureType: extendedPreset.structureType,
            programBlocks: extendedPreset.programBlocks,
            fixedFirstWeek: extendedPreset.fixedFirstWeek,
            fixedLastWeek: extendedPreset.fixedLastWeek,
        } as import('../programTemplate').ProgramTemplate;

        const effectiveWeeks = selectedWeekCount ?? weekOptions[0];
        return formatBlockCounts(template, effectiveWeeks);
    }, [selectedPreset, selectedWeekCount, weekOptions]);

    const handleNext = () => {
        if (step === 0) setStep(1);
        else {
            // Use selectedWeekCount if set, otherwise use first weekOption for variable-length,
            // or preset's weekCount for fixed-length
            const effectiveWeekCount = selectedWeekCount ?? (isVariableLength ? weekOptions[0] : selectedPreset?.weekCount);
            onComplete({
                presetId: selectedPresetId,
                basePower,
                startDate,
                weekCount: effectiveWeekCount
            });
        }
    };

    // Reset week count when preset changes
    const handlePresetChange = (presetId: string) => {
        setSelectedPresetId(presetId);
        setSelectedWeekCount(null);
    };

    return (
        <div className="fixed inset-0 z-[200] bg-white dark:bg-black flex flex-col animate-in fade-in duration-500">
            <div className="flex-1 overflow-y-auto p-6 md:p-12">
                <div className="max-w-2xl mx-auto mt-10 md:mt-20">

                    {/* Header */}
                    <div className="mb-12">
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter text-neutral-900 dark:text-white mb-4">
                            {step === 0 ? "Select Your Path." : "Configure."}
                        </h1>
                        <p className="text-neutral-500 text-lg">
                            {step === 0 ? "Choose a training protocol that fits your goals." : "Fine-tune your program settings."}
                        </p>
                    </div>

                    {/* Step 0: Preset Selection */}
                    {step === 0 && (
                        <div className="space-y-4">
                            {presets.map(preset => (
                                <button
                                    key={preset.id}
                                    onClick={() => handlePresetChange(preset.id)}
                                    className={`w-full text-left p-6 rounded-2xl border-2 transition-all duration-200 group relative overflow-hidden ${selectedPresetId === preset.id
                                        ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-900'
                                        : 'border-neutral-200 dark:border-neutral-800 active:border-neutral-400 dark:active:border-neutral-600'
                                        }`}
                                >
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className={`text-xl font-bold ${selectedPresetId === preset.id ? 'text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-400'}`}>
                                                {preset.name}
                                            </h3>
                                            {selectedPresetId === preset.id && (
                                                <div className="bg-neutral-900 dark:bg-white text-white dark:text-black p-1 rounded-full">
                                                    <Check size={16} strokeWidth={3} />
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-sm text-neutral-500 leading-relaxed pr-8">
                                            {preset.description}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Import Template Option - on step 0 */}
                    {step === 0 && onImportTemplate && (
                        <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-800">
                            <button
                                onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = '.json';
                                    input.onchange = async (e) => {
                                        const file = (e.target as HTMLInputElement).files?.[0];
                                        if (file) {
                                            try {
                                                const text = await file.text();
                                                const json = JSON.parse(text);
                                                // Dynamically import templateUtils to validate and convert
                                                const { importTemplateFromJson, templateToPreset } = await import('../utils/templateUtils');
                                                const result = importTemplateFromJson(text);
                                                if (result.valid && result.template) {
                                                    const newPreset = templateToPreset(result.template);
                                                    onImportTemplate(newPreset);
                                                    setSelectedPresetId(newPreset.id);
                                                    alert(`Template "${newPreset.name}" imported successfully!`);
                                                } else {
                                                    alert(`Invalid template: ${result.errors?.map(e => e.message).join(', ')}`);
                                                }
                                            } catch (err) {
                                                alert('Failed to parse template file.');
                                            }
                                        }
                                    };
                                    input.click();
                                }}
                                className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-500 hover:border-neutral-400 dark:hover:border-neutral-600 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                            >
                                <Upload size={20} />
                                <span className="font-medium">Import Custom Template</span>
                            </button>
                            <p className="text-xs text-neutral-400 text-center mt-2">Load a .json template file</p>
                        </div>
                    )}

                    {/* Step 1: Configuration */}
                    {step === 1 && (
                        <div className="space-y-8 animate-in slide-in-from-right-10 duration-300">

                            {/* Selected Program Summary */}
                            <div className="bg-neutral-100 dark:bg-neutral-900 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-800">
                                <div className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">Selected Program</div>
                                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{selectedPreset?.name}</h3>
                                <button onClick={() => setStep(0)} className="text-sm text-neutral-500 underline mt-2 active:text-neutral-900 dark:active:text-white">Change Program</button>
                            </div>

                            {/* Program Duration Selector - Only for variable-length programs */}
                            {isVariableLength && (
                                <div>
                                    <label className="block text-sm font-bold uppercase tracking-widest text-neutral-500 mb-4">
                                        Program Duration
                                    </label>
                                    <div className="bg-neutral-50 dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-800 rounded-2xl p-6">
                                        <div className="flex items-center justify-center mb-4">
                                            <span className="text-4xl font-bold text-neutral-900 dark:text-white">
                                                {selectedWeekCount ?? weekOptions[0]}
                                            </span>
                                            <span className="ml-2 text-lg font-bold text-neutral-400">weeks</span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={weekOptions.length - 1}
                                            step={1}
                                            value={weekOptions.indexOf(selectedWeekCount ?? weekOptions[0])}
                                            onChange={(e) => setSelectedWeekCount(weekOptions[parseInt(e.target.value)])}
                                            className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-neutral-900 dark:accent-white"
                                        />
                                        <div className="flex justify-between text-xs text-neutral-400 mt-2">
                                            <span>{weekOptions[0]} weeks</span>
                                            <span>{weekOptions[weekOptions.length - 1]} weeks</span>
                                        </div>
                                        {/* Block composition display for block-based templates */}
                                        {blockComposition && (
                                            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                                                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Block Structure</div>
                                                <div className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                                                    {blockComposition}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Base Power Input */}
                            <div>
                                <label className="block text-sm font-bold uppercase tracking-widest text-neutral-500 mb-4">
                                    Base Power (FTP / Target)
                                </label>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setBasePower(Math.max(50, basePower - 5))}
                                        className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xl font-bold active:bg-neutral-200 dark:active:bg-neutral-700 transition-colors"
                                    >-</button>
                                    <div className="flex-1 h-16 bg-neutral-50 dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-800 rounded-2xl flex items-center justify-center relative overflow-hidden">
                                        <input
                                            type="number"
                                            value={basePower}
                                            onChange={(e) => setBasePower(Number(e.target.value))}
                                            className="bg-transparent text-center text-3xl font-bold text-neutral-900 dark:text-white w-full h-full outline-none z-10 relative"
                                        />
                                        <span className="absolute right-4 text-sm font-bold text-neutral-400">WATTS</span>
                                    </div>
                                    <button
                                        onClick={() => setBasePower(basePower + 5)}
                                        className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-xl font-bold active:bg-neutral-200 dark:active:bg-neutral-700 transition-colors"
                                    >+</button>
                                </div>
                                <p className="text-xs text-neutral-400 mt-3 flex items-center gap-2">
                                    <Info size={14} />
                                    <span>This sets the baseline intensity for your workouts.</span>
                                </p>
                            </div>

                            {/* Start Date Input */}
                            <div>
                                <label className="block text-sm font-bold uppercase tracking-widest text-neutral-500 mb-4">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full p-4 bg-neutral-50 dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-800 rounded-2xl text-lg font-mono text-neutral-900 dark:text-white outline-none focus:border-neutral-900 dark:focus:border-white transition-colors"
                                />
                            </div>

                        </div>
                    )}

                </div>
            </div>

            {/* Footer / Actions */}
            <div className="p-6 md:p-8 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-t border-neutral-200 dark:border-neutral-800">
                <div className="max-w-2xl mx-auto flex justify-end">
                    <button
                        onClick={handleNext}
                        className="group flex items-center gap-3 bg-neutral-900 dark:bg-white text-white dark:text-black px-8 py-4 rounded-2xl font-bold text-lg hover:scale-105 active:scale-95 transition-all shadow-xl shadow-neutral-900/20"
                    >
                        <span>{step === 0 ? "Next Step" : "Start Program"}</span>
                        <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
