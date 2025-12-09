import React, { useState } from 'react';
import { ChevronRight, Pencil, Eye, Plus } from 'lucide-react';
import { PlanWeek, ProgramPreset, ProgramRecord, SessionStyle, ProgressionMode } from '../types';
import {
    ProgramTemplate, WeekDefinition, ValidationError, WeekPosition
} from '../programTemplate';
import {
    validateTemplate, templateToPreset, exportTemplateToJson, TEMPLATE_VERSION
} from '../utils/templateUtils';
import PlanTable from './PlanTable';
import ProgramEditor, {
    EditorState, INITIAL_EDITOR_STATE, FOCUS_OPTIONS, WORK_REST_OPTIONS, FATIGUE_CONDITIONS
} from './ProgramEditor';

// ============================================================================
// TYPES
// ============================================================================

export type ProgramCategory = 'main' | 'edit' | 'create' | 'view';

interface ProgramTabProps {
    // Current program
    activeProgram: ProgramRecord | undefined;
    plan: PlanWeek[];
    basePlan: PlanWeek[];
    settings: { startDate: string; basePower: number; restRecoveryPercentage?: number };
    onUpdateSettings: (settings: { startDate: string; basePower: number; restRecoveryPercentage?: number }) => void;
    onUpdatePlan: (week: number, field: keyof PlanWeek, value: any) => void;
    onLoadPreset: (presetId: string, basePower: number) => void;
    onFinishProgram: () => void;

    // Templates
    activePresets: ProgramPreset[];
    customTemplates: ProgramPreset[];
    setCustomTemplates: React.Dispatch<React.SetStateAction<ProgramPreset[]>>;
    modifiedDefaults: Record<string, Partial<ProgramPreset>>;
    setModifiedDefaults: React.Dispatch<React.SetStateAction<Record<string, Partial<ProgramPreset>>>>;
    deletedDefaultIds: string[];
    setDeletedDefaultIds: React.Dispatch<React.SetStateAction<string[]>>;
    isDefaultPreset: (id: string) => boolean;
    PRESETS: ProgramPreset[];

    // Navigation state (lifted from internal state for back button handling)
    activeCategory: ProgramCategory;
    setActiveCategory: (category: ProgramCategory) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

const ProgramTab: React.FC<ProgramTabProps> = ({
    activeProgram, plan, basePlan, settings, onUpdateSettings, onUpdatePlan, onLoadPreset, onFinishProgram,
    activePresets, customTemplates, setCustomTemplates, modifiedDefaults, setModifiedDefaults,
    deletedDefaultIds, setDeletedDefaultIds, isDefaultPreset, PRESETS,
    activeCategory, setActiveCategory
}) => {
    const [editorState, setEditorState] = useState<EditorState>(INITIAL_EDITOR_STATE);
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [showPreview, setShowPreview] = useState(false);
    const [previewWeekCount, setPreviewWeekCount] = useState<number>(8);

    // Category navigation items
    const categories = [
        { id: 'view' as const, name: 'Current Program', description: 'View and modify your active program', icon: Eye, disabled: !activeProgram },
        { id: 'edit' as const, name: 'Edit Template', description: 'Customize existing program templates', icon: Pencil },
        { id: 'create' as const, name: 'Create Template', description: 'Build a new program from scratch', icon: Plus },
    ];

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    const generateId = () => `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const editorStateToTemplate = (state: EditorState): ProgramTemplate => ({
        templateVersion: TEMPLATE_VERSION,
        id: state.id || generateId(),
        name: state.name,
        description: state.description,
        author: state.author || undefined,
        tags: state.tags.length > 0 ? state.tags : undefined,
        weekConfig: state.weekConfigType === 'fixed'
            ? { type: 'fixed', fixed: state.fixedWeeks }
            : { type: 'variable', range: { min: state.rangeMin, max: state.rangeMax, step: state.rangeStep } },
        defaultSessionStyle: state.defaultSessionStyle,
        progressionMode: state.progressionMode,
        defaultSessionDurationMinutes: state.defaultDurationMinutes,
        weeks: state.weeks,
        fatigueModifiers: state.fatigueModifiers.length > 0 ? state.fatigueModifiers : undefined
    });

    const presetToEditorState = (preset: ProgramPreset, basePower: number = 150): EditorState => {
        // Check if this preset has a direct weeks array OR a generator function
        // Custom templates (from templateToPreset) store weeks array AND generator, 
        // but we prefer the weeks array to preserve relative positions (first, 50%, last, etc.)

        let weeks: WeekDefinition[];

        if ((preset as any).weeks && Array.isArray((preset as any).weeks)) {
            // Template-based preset with weeks array - preferred to preserve dynamic positions
            weeks = (preset as any).weeks;
        } else if (typeof preset.generator === 'function') {
            // Legacy preset with generator function only - extract weeks from generated plan
            const generatedPlan = preset.generator(basePower, preset.weekCount || 12);
            weeks = generatedPlan.map((week, index) => ({
                position: (index + 1) as WeekPosition,
                phaseName: week.phaseName,
                focus: week.focus,
                description: week.description,
                powerMultiplier: week.plannedPower / basePower,
                workRestRatio: week.workRestRatio,
                targetRPE: week.targetRPE,
                sessionStyle: week.sessionStyle,
                durationMinutes: week.targetDurationMinutes,
                workDurationSeconds: week.workDurationSeconds,
                restDurationSeconds: week.restDurationSeconds
            }));
        } else {
            // Fallback: empty weeks array
            weeks = [];
        }

        // Extract week config
        const weekConfig = (preset as any).weekConfig;
        const isVariable = weekConfig?.type === 'variable' || (preset.weekOptions && preset.weekOptions.length > 1);

        return {
            id: preset.id,
            name: preset.name,
            description: preset.description,
            author: (preset as any).author || '',
            tags: (preset as any).tags || [],
            weekConfigType: isVariable ? 'variable' : 'fixed',
            fixedWeeks: weekConfig?.fixed || preset.weekCount || 12,
            rangeMin: weekConfig?.range?.min || preset.minWeeks || Math.min(...(preset.weekOptions || [12])),
            rangeMax: weekConfig?.range?.max || preset.maxWeeks || Math.max(...(preset.weekOptions || [12])),
            rangeStep: weekConfig?.range?.step || 1,
            defaultSessionStyle: preset.defaultSessionStyle || 'interval',
            progressionMode: preset.progressionMode || 'power',
            defaultDurationMinutes: (preset as any).defaultSessionDurationMinutes || 15,
            weeks,
            fatigueModifiers: preset.fatigueModifiers || []
        };
    };

    const validateAndSave = (asNew: boolean = false): boolean => {
        const template = editorStateToTemplate(editorState);
        if (asNew) {
            template.id = generateId();
        }

        const result = validateTemplate(template);
        if (!result.valid) {
            setValidationErrors(result.errors);
            return false;
        }

        // Convert to preset and save
        const newPreset = templateToPreset(template);

        if (asNew || !editingTemplateId) {
            // Add as new custom template
            setCustomTemplates(prev => [...prev, newPreset]);
        } else {
            // Update existing
            if (isDefaultPreset(editingTemplateId)) {
                // When modifying a default preset, we create a custom template that will take precedence.
                // Give it a new ID derived from the original to avoid conflicts.
                const customizedPreset = {
                    ...newPreset,
                    id: `${editingTemplateId}-custom-${Date.now()}`
                };
                setCustomTemplates(prev => [...prev, customizedPreset]);
                // Mark the original default as "replaced" so it doesn't show in the list
                setDeletedDefaultIds(prev => prev.includes(editingTemplateId) ? prev : [...prev, editingTemplateId]);
            } else {
                // Update custom template
                setCustomTemplates(prev => prev.map(p => p.id === editingTemplateId ? newPreset : p));
            }
        }

        setValidationErrors([]);
        setEditingTemplateId(null);
        setActiveCategory('main');
        return true;
    };

    const exportCurrentTemplate = () => {
        const template = editorStateToTemplate(editorState);
        const json = exportTemplateToJson(template);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `template-${template.id}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleBackFromEditor = () => {
        setActiveCategory('main');
        setEditorState(INITIAL_EDITOR_STATE);
        setEditingTemplateId(null);
        setValidationErrors([]);
        setShowPreview(false);
    };

    // ========================================================================
    // RENDER HELPERS
    // ========================================================================

    const renderBackButton = () => (
        <button
            onClick={() => {
                setActiveCategory('main');
                setEditorState(INITIAL_EDITOR_STATE);
                setEditingTemplateId(null);
                setValidationErrors([]);
                setShowPreview(false);
            }}
            className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white mb-6 transition-colors"
        >
            <ChevronRight size={16} className="rotate-180" />
            <span className="text-sm font-medium">Back to Program</span>
        </button>
    );

    // ========================================================================
    // MAIN CATEGORY VIEW
    // ========================================================================

    const renderMainCategory = () => (
        <div className="space-y-3">
            {categories.map(cat => (
                <button
                    key={cat.id}
                    onClick={() => {
                        if (cat.id === 'create') {
                            setEditorState({ ...INITIAL_EDITOR_STATE, id: generateId() });
                            setEditingTemplateId(null);
                        }
                        if (!cat.disabled) setActiveCategory(cat.id);
                    }}
                    disabled={cat.disabled}
                    className={`w-full bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 flex items-center justify-between transition-colors group ${cat.disabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-neutral-400 dark:hover:border-neutral-600'
                        }`}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-2">
                            <cat.icon size={24} strokeWidth={2.5} style={!cat.disabled ? { color: 'var(--accent)' } : { color: 'rgb(163 163 163)' }} />
                        </div>
                        <div className="text-left">
                            <div className="font-medium text-neutral-900 dark:text-white">{cat.name}</div>
                            <div className="text-xs text-neutral-500">{cat.description}</div>
                        </div>
                    </div>
                    <ChevronRight size={20} className="text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors" />
                </button>
            ))}

            {/* Finish Program Button - only shows when there's an active program */}
            {activeProgram && (
                <button
                    onClick={() => {
                        if (window.confirm('Mark this program as completed? You can start a new program afterwards.')) {
                            onFinishProgram();
                        }
                    }}
                    className="w-full rounded-2xl p-5 text-sm font-bold uppercase tracking-wider text-white hover:opacity-90 transition-opacity focus:outline-none mt-6"
                    style={{ backgroundColor: 'var(--accent)' }}
                >
                    Finish Program
                </button>
            )}
        </div>
    );

    // ========================================================================
    // VIEW CURRENT PROGRAM
    // ========================================================================

    const renderViewCategory = () => (
        <div className="space-y-6">
            {renderBackButton()}
            <PlanTable
                plan={plan}
                basePlan={basePlan}
                presets={PRESETS}
                onUpdatePlan={onUpdatePlan}
                onLoadPreset={onLoadPreset}
                settings={settings}
                onUpdateSettings={onUpdateSettings}
                activePresetId={activeProgram?.presetId || ''}
                onFinishProgram={onFinishProgram}
            />
        </div>
    );

    // ========================================================================
    // EDIT TEMPLATE
    // ========================================================================

    const renderEditCategory = () => {
        if (editingTemplateId) {
            return (
                <ProgramEditor
                    editorState={editorState}
                    setEditorState={setEditorState}
                    editingTemplateId={editingTemplateId}
                    validationErrors={validationErrors}
                    setValidationErrors={setValidationErrors}
                    showPreview={showPreview}
                    setShowPreview={setShowPreview}
                    previewWeekCount={previewWeekCount}
                    setPreviewWeekCount={setPreviewWeekCount}
                    onSave={validateAndSave}
                    onBack={handleBackFromEditor}
                    onExport={exportCurrentTemplate}
                />
            );
        }

        return (
            <div className="space-y-6">
                {renderBackButton()}
                <h2 className="text-2xl font-light text-neutral-900 dark:text-white tracking-tight">Edit Template</h2>
                <p className="text-sm text-neutral-500 mb-4">Select a template to customize</p>

                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                    {activePresets.map(preset => (
                        <button
                            key={preset.id}
                            onClick={() => {
                                setEditorState(presetToEditorState(preset));
                                setEditingTemplateId(preset.id);
                            }}
                            className="w-full p-4 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors text-left group"
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-medium text-neutral-900 dark:text-white">{preset.name}</div>
                                    <div className="text-xs text-neutral-500 line-clamp-2 mt-1">{preset.description}</div>
                                    <div className="text-[10px] text-neutral-400 mt-2">
                                        {preset.weekCount || 12} weeks • {isDefaultPreset(preset.id) ? 'Built-in' : 'Custom'}
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        );
    };

    // ========================================================================
    // CREATE TEMPLATE
    // ========================================================================

    const renderCreateCategory = () => (
        <ProgramEditor
            editorState={editorState}
            setEditorState={setEditorState}
            editingTemplateId={editingTemplateId}
            validationErrors={validationErrors}
            setValidationErrors={setValidationErrors}
            showPreview={showPreview}
            setShowPreview={setShowPreview}
            previewWeekCount={previewWeekCount}
            setPreviewWeekCount={setPreviewWeekCount}
            onSave={validateAndSave}
            onBack={handleBackFromEditor}
            onExport={exportCurrentTemplate}
        />
    );

    // ========================================================================
    // MAIN RENDER
    // ========================================================================

    return (
        <div className="h-full animate-in fade-in duration-500 pb-16 md:pb-4">
            {activeCategory === 'main' && (
                <>
                    <h2 className="text-3xl font-light text-neutral-900 dark:text-white tracking-tight mb-2">Program</h2>
                    <p className="text-neutral-500 text-sm mb-8">Manage your training programs and templates</p>
                    {renderMainCategory()}
                </>
            )}

            {activeCategory === 'view' && renderViewCategory()}
            {activeCategory === 'edit' && renderEditCategory()}
            {activeCategory === 'create' && renderCreateCategory()}
        </div>
    );
};

export default ProgramTab;
