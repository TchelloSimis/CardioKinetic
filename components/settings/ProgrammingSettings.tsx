import React, { useState, useMemo } from 'react';
import { Trash2, RotateCcw, ChevronDown, ChevronUp, ArrowUp, ArrowDown, RefreshCw, Loader2, Zap } from 'lucide-react';
import { ProgramPreset, ProgramRecord } from '../../types';
import { DEFAULT_PRESETS, AccentColor, AccentColorConfig } from '../../presets';
import { presetToTemplate, templateToPreset, importTemplateFromJson, exportTemplateToJson } from '../../utils/templateUtils';
import { generateMissingSimulationData, regenerateAllTemplateSimulations, TemplateRegenerationProgress } from '../../utils/autoAdaptiveSimulation';
import type { SimulationProgress } from '../../utils/autoAdaptiveTypes';
import { getMaterialYouAccentColors } from '../../utils/colorUtils';

export interface ProgrammingSettingsProps {
    activeProgram: ProgramRecord | undefined;
    activePresets: ProgramPreset[];
    customTemplates: ProgramPreset[];
    setCustomTemplates: React.Dispatch<React.SetStateAction<ProgramPreset[]>>;
    modifiedDefaults: Record<string, Partial<ProgramPreset>>;
    setModifiedDefaults: React.Dispatch<React.SetStateAction<Record<string, Partial<ProgramPreset>>>>;
    deletedDefaultIds: string[];
    setDeletedDefaultIds: React.Dispatch<React.SetStateAction<string[]>>;
    templateListExpanded: boolean;
    setTemplateListExpanded: (value: boolean) => void;
    editingTemplateId: string | null;
    setEditingTemplateId: (value: string | null) => void;
    editingTemplateName: string;
    setEditingTemplateName: (value: string) => void;
    isDefaultPreset: (id: string) => boolean;
    isDefaultModified: (id: string) => boolean;
    moveTemplate: (presetId: string, direction: 'up' | 'down') => void;
    PRESETS: ProgramPreset[];
    /** Auto-adaptive modifiers enabled state */
    autoAdaptiveEnabled?: boolean;
    /** Toggle auto-adaptive modifiers */
    setAutoAdaptiveEnabled?: (enabled: boolean) => void;
    /** All program records for simulation scanning */
    allPrograms?: ProgramRecord[];
    /** Callback when simulation data is generated for a program */
    onProgramSimulationGenerated?: (programId: string, simulationData: any) => void;
    /** Current accent color selection */
    accentColor?: AccentColor;
    /** Available accent color configurations */
    ACCENT_COLORS?: AccentColorConfig[];
    /** Material You color from system (Android only) */
    materialYouColor?: string | null;
    /** Whether dark mode is active */
    isDarkMode?: boolean;
}

const ProgrammingSettings: React.FC<ProgrammingSettingsProps> = ({
    activeProgram,
    activePresets,
    customTemplates,
    setCustomTemplates,
    modifiedDefaults,
    setModifiedDefaults,
    deletedDefaultIds,
    setDeletedDefaultIds,
    templateListExpanded,
    setTemplateListExpanded,
    editingTemplateId,
    setEditingTemplateId,
    editingTemplateName,
    setEditingTemplateName,
    isDefaultPreset,
    isDefaultModified,
    moveTemplate,
    PRESETS,
    autoAdaptiveEnabled = false,
    setAutoAdaptiveEnabled,
    allPrograms = [],
    onProgramSimulationGenerated,
    accentColor = 'emerald',
    ACCENT_COLORS = [],
    materialYouColor = null,
    isDarkMode = false,
}) => {
    // Compute active accent color for dynamic theming
    const activeColorConfig = useMemo(() => {
        if (accentColor === 'material' && materialYouColor) {
            return {
                id: 'material',
                name: 'Material You',
                ...getMaterialYouAccentColors(materialYouColor)
            };
        }
        return ACCENT_COLORS.find(c => c.id === accentColor) || ACCENT_COLORS[0] || {
            id: 'emerald',
            name: 'Emerald',
            light: '#10b981',
            dark: '#6ee7b7',
            displayLight: '#10b981',
            displayDark: '#6ee7b7'
        };
    }, [accentColor, ACCENT_COLORS, materialYouColor]);

    // Primary = readiness, Alt = fatigue
    const readinessColor = isDarkMode ? activeColorConfig.dark : activeColorConfig.light;
    const fatigueColor = isDarkMode
        ? (activeColorConfig.darkAlt || activeColorConfig.dark)
        : (activeColorConfig.lightAlt || activeColorConfig.light);
    // Auto-adaptive simulation generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState<{
        current: number;
        total: number;
        programName: string;
    } | null>(null);
    const [lastScanResult, setLastScanResult] = useState<string | null>(null);

    // Regeneration state with ETA
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [regenProgress, setRegenProgress] = useState<TemplateRegenerationProgress | null>(null);

    const handleScanAndGenerate = async () => {
        if (!allPrograms || allPrograms.length === 0) {
            setLastScanResult('No programs to scan.');
            return;
        }

        setIsGenerating(true);
        setLastScanResult(null);

        try {
            const { updated, results } = await generateMissingSimulationData(
                allPrograms,
                PRESETS,
                (current, total, programName) => {
                    setGenerationProgress({ current, total, programName });
                }
            );

            // Debug: Log generation results (remove before release)
            console.log('[ProgrammingSettings] Simulation generation complete:', {
                updated,
                programIds: Array.from(results.keys()),
                allProgramIds: allPrograms.map(p => p.id)
            });

            // Notify parent of updated programs
            if (onProgramSimulationGenerated) {
                results.forEach((data, programId) => {
                    console.log('[ProgrammingSettings] Calling onProgramSimulationGenerated for:', programId, {
                        weekCount: data.weekCount,
                        percentilesLength: data.weekPercentiles?.length
                    });
                    onProgramSimulationGenerated(programId, data);
                });
            } else {
                console.warn('[ProgrammingSettings] onProgramSimulationGenerated callback is not defined!');
            }

            setLastScanResult(
                updated > 0
                    ? `Generated simulation data for ${updated} program${updated === 1 ? '' : 's'}.`
                    : 'All programs already have simulation data.'
            );
        } catch (error) {
            setLastScanResult('Error generating simulation data. See console for details.');
            console.error('Simulation generation error:', error);
        } finally {
            setIsGenerating(false);
            setGenerationProgress(null);
        }
    };

    // Format seconds to MM:SS
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleRegenerateAll = async () => {
        if (!PRESETS || PRESETS.length === 0) {
            setLastScanResult('No templates available.');
            return;
        }

        setIsRegenerating(true);
        setLastScanResult(null);

        try {
            const { templatesProcessed, totalDurations } = await regenerateAllTemplateSimulations(
                PRESETS,
                200, // Default base power for simulation
                (progress) => {
                    setRegenProgress(progress);
                }
            );

            setLastScanResult(
                `Regenerated ${totalDurations} simulations for ${templatesProcessed} template${templatesProcessed === 1 ? '' : 's'}.`
            );
        } catch (error) {
            setLastScanResult('Error regenerating simulation data. See console for details.');
            console.error('Template simulation regeneration error:', error);
        } finally {
            setIsRegenerating(false);
            setRegenProgress(null);
        }
    };

    const handleExportTemplate = () => {
        if (!activeProgram) {
            alert('No active program to export.');
            return;
        }
        const preset = PRESETS.find(p => p.id === activeProgram.presetId);
        if (!preset) {
            alert('Cannot export custom-modified programs as templates yet.');
            return;
        }
        const template = presetToTemplate(preset, activeProgram.basePower);
        const json = exportTemplateToJson(template);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `template-${template.id}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportTemplate = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const jsonStr = event.target?.result as string;
                        const result = importTemplateFromJson(jsonStr);
                        if (result.valid && result.template) {
                            const newPreset = templateToPreset(result.template);
                            if (PRESETS.find(p => p.id === newPreset.id)) {
                                if (!window.confirm(`A template with ID "${newPreset.id}" already exists. Replace it?`)) return;
                                setCustomTemplates(prev => prev.filter(p => p.id !== newPreset.id).concat(newPreset));
                            } else {
                                setCustomTemplates(prev => [...prev, newPreset]);
                            }
                            alert(`Template "${newPreset.name}" imported successfully!`);
                        } else {
                            const errorMsg = result.errors?.map(e => `${e.field}: ${e.message}`).join('\n') || 'Unknown error';
                            alert(`Invalid template file format:\n${errorMsg}`);
                        }
                    } catch (err) {
                        alert('Failed to parse template file.');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    };

    const handleSaveTemplateName = (presetId: string, isDefault: boolean) => {
        if (editingTemplateName.trim()) {
            if (isDefault) {
                setModifiedDefaults(prev => ({
                    ...prev,
                    [presetId]: { ...prev[presetId], name: editingTemplateName.trim() }
                }));
            } else {
                setCustomTemplates(prev => prev.map(p =>
                    p.id === presetId ? { ...p, name: editingTemplateName.trim() } : p
                ));
            }
        }
        setEditingTemplateId(null);
    };

    const handleResetTemplate = (presetId: string) => {
        setModifiedDefaults(prev => {
            const next = { ...prev };
            delete next[presetId];
            return next;
        });
        setDeletedDefaultIds(prev => prev.filter(id => id !== presetId));
    };

    const handleDeleteTemplate = (preset: ProgramPreset, isDefault: boolean) => {
        const confirmMsg = isDefault
            ? `Hide "${preset.name}" from presets? You can restore it with Reset All.`
            : `Delete template "${preset.name}"?`;
        if (window.confirm(confirmMsg)) {
            if (isDefault) {
                setDeletedDefaultIds(prev => [...prev, preset.id]);
            } else {
                setCustomTemplates(prev => prev.filter(p => p.id !== preset.id));
            }
        }
    };

    const handleResetAll = () => {
        if (window.confirm('Reset ALL templates to original defaults? This will remove custom templates and restore all built-in presets.')) {
            setCustomTemplates([]);
            setModifiedDefaults({});
            setDeletedDefaultIds([]);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-light text-neutral-900 dark:text-white tracking-tight">Programming</h2>

            {/* Program Templates Section */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4">Program Templates</h3>

                {/* Import/Export buttons */}
                <div className="flex gap-3 mb-4">
                    <button
                        onClick={handleExportTemplate}
                        className="flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider text-white active:opacity-80 transition-opacity focus:outline-none"
                        style={{ backgroundColor: readinessColor }}
                    >
                        Export Current
                    </button>
                    <button
                        onClick={handleImportTemplate}
                        className="flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider text-white active:opacity-80 transition-opacity focus:outline-none"
                        style={{ backgroundColor: fatigueColor }}
                    >
                        Import Template
                    </button>
                </div>

                {/* Template List Toggle */}
                <button
                    onClick={() => setTemplateListExpanded(!templateListExpanded)}
                    className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 text-sm font-medium text-neutral-600 dark:text-neutral-400 active:bg-neutral-100 dark:active:bg-neutral-900 transition-colors"
                >
                    <span>Manage Templates ({activePresets.length})</span>
                    {templateListExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {/* Template List (Expanded) */}
                {templateListExpanded && (
                    <div className="space-y-2 max-h-80 overflow-y-auto mt-4">
                        {activePresets.map(preset => {
                            const isDefault = isDefaultPreset(preset.id);
                            const isModified = isDefault && isDefaultModified(preset.id);
                            const originalName = DEFAULT_PRESETS.find(p => p.id === preset.id)?.name;

                            return (
                                <div key={preset.id} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                                    {editingTemplateId === preset.id ? (
                                        /* Rename Mode */
                                        <div className="flex items-center gap-2 w-full">
                                            <input
                                                type="text"
                                                value={editingTemplateName}
                                                onChange={(e) => setEditingTemplateName(e.target.value)}
                                                className="flex-1 min-w-0 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => handleSaveTemplateName(preset.id, isDefault)}
                                                className="shrink-0 px-3 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-black text-sm font-medium"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setEditingTemplateId(null)}
                                                className="shrink-0 px-3 py-2 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-sm font-medium"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        /* Display Mode */
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                                                    {preset.name}
                                                    {isModified && originalName !== preset.name && (
                                                        <span className="text-[9px] text-neutral-400 ml-2">(was: {originalName})</span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-neutral-400 truncate">
                                                    {preset.weekCount || 12} weeks • {isDefault ? (isModified ? 'Modified' : 'Built-in') : 'Custom'}
                                                </div>
                                            </div>

                                            {/* Reorder buttons */}
                                            <div className="flex flex-col gap-0.5 mr-1">
                                                <button
                                                    onClick={() => moveTemplate(preset.id, 'up')}
                                                    className="p-1 rounded text-neutral-400 active:text-neutral-900 dark:active:text-white active:bg-neutral-200 dark:active:bg-neutral-700"
                                                    title="Move Up"
                                                >
                                                    <ArrowUp size={12} />
                                                </button>
                                                <button
                                                    onClick={() => moveTemplate(preset.id, 'down')}
                                                    className="p-1 rounded text-neutral-400 active:text-neutral-900 dark:active:text-white active:bg-neutral-200 dark:active:bg-neutral-700"
                                                    title="Move Down"
                                                >
                                                    <ArrowDown size={12} />
                                                </button>
                                            </div>

                                            {/* Reset button for modified defaults */}
                                            {isModified && (
                                                <button
                                                    onClick={() => handleResetTemplate(preset.id)}
                                                    className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 active:bg-blue-200 dark:active:bg-blue-900/50"
                                                    title="Reset to Default"
                                                >
                                                    <RotateCcw size={14} />
                                                </button>
                                            )}


                                            <button
                                                onClick={() => handleDeleteTemplate(preset, isDefault)}
                                                className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 active:bg-red-200 dark:active:bg-red-900/50"
                                                title={isDefault ? "Hide" : "Delete"}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {activePresets.length === 0 && (
                            <p className="text-xs text-neutral-400 text-center py-4">No templates available.</p>
                        )}
                    </div>
                )}

                {/* Reset Actions */}
                {templateListExpanded && (customTemplates.length > 0 || Object.keys(modifiedDefaults).length > 0 || deletedDefaultIds.length > 0) && (
                    <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                        <button
                            onClick={handleResetAll}
                            className="w-full py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 active:bg-red-200 dark:active:bg-red-900/40 transition-colors focus:outline-none flex items-center justify-center gap-2"
                        >
                            <RotateCcw size={14} />
                            Reset All to Defaults
                        </button>
                        <p className="text-[10px] text-neutral-400 text-center mt-2">Removes all changes and restores original presets.</p>
                    </div>
                )}

                <p className="text-[10px] text-neutral-400 mt-4">See TEMPLATE_DOCUMENTATION.md for schema details.</p>
            </div>

            {/* Auto-Adaptive Training Section */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400">Auto-Adaptive Training</h3>
                </div>

                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                    Automatically adjusts training when fatigue/readiness deviate from expected percentiles.
                    These adjustments are applied only if no coach-created modifiers match.
                </p>

                {/* On/Off Buttons */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setAutoAdaptiveEnabled?.(false)}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-colors focus:outline-none ${!autoAdaptiveEnabled
                            ? 'bg-neutral-100 dark:bg-neutral-800 border-2 text-neutral-900 dark:text-white'
                            : 'border border-neutral-200 dark:border-neutral-700 text-neutral-500'
                            }`}
                        style={!autoAdaptiveEnabled ? { borderColor: readinessColor } : undefined}
                    >
                        Off
                    </button>
                    <button
                        onClick={() => setAutoAdaptiveEnabled?.(true)}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-colors focus:outline-none ${autoAdaptiveEnabled
                            ? 'bg-neutral-100 dark:bg-neutral-800 border-2 text-neutral-900 dark:text-white'
                            : 'border border-neutral-200 dark:border-neutral-700 text-neutral-500'
                            }`}
                        style={autoAdaptiveEnabled ? { borderColor: readinessColor } : undefined}
                    >
                        On
                    </button>
                </div>

                {/* Scan & Generate Button */}
                <button
                    onClick={handleScanAndGenerate}
                    disabled={isGenerating}
                    className={`w-full mt-4 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-colors focus:outline-none flex items-center justify-center gap-2 ${isGenerating
                        ? 'opacity-50 cursor-not-allowed'
                        : 'active:opacity-80'
                        } text-white`}
                    style={{ backgroundColor: readinessColor }}
                >
                    {isGenerating ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            {generationProgress
                                ? `Generating ${generationProgress.current}/${generationProgress.total}...`
                                : 'Scanning...'}
                        </>
                    ) : (
                        <>
                            <RefreshCw size={16} />
                            Scan & Generate Missing Data
                        </>
                    )}
                </button>

                {/* Progress details */}
                {isGenerating && generationProgress && (
                    <div className="mt-2 space-y-1">
                        <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-1.5">
                            <div
                                className="h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${(generationProgress.current / generationProgress.total) * 100}%`, backgroundColor: readinessColor }}
                            />
                        </div>
                        <p className="text-[10px] text-neutral-400 text-center">
                            Processing: {generationProgress.programName}
                        </p>
                    </div>
                )}

                {/* Result message */}
                {lastScanResult && !isGenerating && (
                    <p className="text-[10px] text-neutral-400 text-center mt-2">
                        {lastScanResult}
                    </p>
                )}


                {/* Regenerate All Button */}
                <button
                    onClick={handleRegenerateAll}
                    disabled={isRegenerating || isGenerating}
                    className={`w-full mt-3 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-colors focus:outline-none flex items-center justify-center gap-2 ${isRegenerating || isGenerating
                        ? 'opacity-50 cursor-not-allowed'
                        : 'active:opacity-80'
                        } text-white`}
                    style={{ backgroundColor: fatigueColor }}
                >
                    {isRegenerating ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            {regenProgress
                                ? `Template ${regenProgress.currentTemplate}/${regenProgress.totalTemplates}...`
                                : 'Starting...'}
                        </>
                    ) : (
                        <>
                            <RotateCcw size={16} />
                            Regenerate All Simulations
                        </>
                    )}
                </button>

                {/* Regeneration progress details with ETA */}
                {isRegenerating && regenProgress && (
                    <div className="mt-2 space-y-2">
                        <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                            <div
                                className="h-2 rounded-full transition-all duration-300"
                                style={{ width: `${regenProgress.percentComplete}%`, backgroundColor: readinessColor }}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] text-neutral-400">
                            <span>{regenProgress.percentComplete}% complete</span>
                            <span>ETA: {formatTime(regenProgress.estimatedSecondsRemaining)}</span>
                        </div>
                        <p className="text-[10px] text-neutral-400 text-center">
                            {regenProgress.currentTemplateName} • Week {regenProgress.currentWeekCount}/{regenProgress.totalWeekCounts}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgrammingSettings;
