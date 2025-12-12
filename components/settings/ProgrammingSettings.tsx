import React from 'react';
import { Pencil, Trash2, RotateCcw, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react';
import { ProgramPreset, ProgramRecord } from '../../types';
import { DEFAULT_PRESETS } from '../../presets';
import { presetToTemplate, templateToPreset, importTemplateFromJson, exportTemplateToJson } from '../../utils/templateUtils';

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
}) => {
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
                        className="flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 active:bg-neutral-200 dark:active:bg-neutral-700 transition-colors focus:outline-none"
                    >
                        Export Current
                    </button>
                    <button
                        onClick={handleImportTemplate}
                        className="flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 active:bg-neutral-200 dark:active:bg-neutral-700 transition-colors focus:outline-none"
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
                                                onClick={() => {
                                                    setEditingTemplateId(preset.id);
                                                    setEditingTemplateName(preset.name);
                                                }}
                                                className="p-2 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 active:bg-neutral-300 dark:active:bg-neutral-700"
                                                title="Rename"
                                            >
                                                <Pencil size={14} />
                                            </button>
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
        </div>
    );
};

export default ProgrammingSettings;
