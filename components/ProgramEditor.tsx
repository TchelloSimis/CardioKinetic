import React, { useState, useMemo } from 'react';
import {
    ChevronRight, Save, Copy, Download,
    FileText, Settings2, Layers, Activity, AlertCircle, Eye, Boxes
} from 'lucide-react';
import { SessionStyle, ProgressionMode } from '../types';
import {
    WeekDefinition, FatigueModifier, FatigueCondition,
    ValidationError, WeekFocus, ProgramBlock
} from '../programTemplate';
import ProgramPreview from './ProgramPreview';
import MetadataStep from './ProgramEditorSteps/MetadataStep';
import ConfigurationStep from './ProgramEditorSteps/ConfigurationStep';
import WeekDefinitionsStep from './ProgramEditorSteps/WeekDefinitionsStep';
import BlocksDefinitionStep from './ProgramEditorSteps/BlocksDefinitionStep';
import FatigueModifiersStep from './ProgramEditorSteps/FatigueModifiersStep';

// ============================================================================
// TYPES
// ============================================================================

export interface EditorState {
    // Metadata
    id: string;
    name: string;
    description: string;
    author: string;
    tags: string[];

    // Structure type
    structureType: 'week-based' | 'block-based';

    // Week config
    weekConfigType: 'fixed' | 'variable' | 'custom';
    fixedWeeks: number;
    rangeMin: number;
    rangeMax: number;
    rangeStep: number;
    customDurations: number[];
    customDurationsInput: string; // Raw input string for validation

    // Defaults
    defaultSessionStyle: SessionStyle;
    progressionMode: ProgressionMode;
    defaultDurationMinutes: number;

    // Week-based: weeks array
    weeks: WeekDefinition[];

    // Block-based: program blocks and fixed weeks
    programBlocks: ProgramBlock[];
    fixedFirstWeek: WeekDefinition | null;
    fixedLastWeek: WeekDefinition | null;

    // Modifiers
    fatigueModifiers: FatigueModifier[];
}

export interface ProgramEditorProps {
    editorState: EditorState;
    setEditorState: React.Dispatch<React.SetStateAction<EditorState>>;
    editingTemplateId: string | null;
    validationErrors: ValidationError[];
    setValidationErrors: React.Dispatch<React.SetStateAction<ValidationError[]>>;
    showPreview: boolean;
    setShowPreview: React.Dispatch<React.SetStateAction<boolean>>;
    previewWeekCount: number;
    setPreviewWeekCount: React.Dispatch<React.SetStateAction<number>>;
    onSave: (asNew: boolean) => boolean;
    onBack: () => void;
    onExport: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const INITIAL_EDITOR_STATE: EditorState = {
    id: '',
    name: '',
    description: '',
    author: '',
    tags: [],
    structureType: 'week-based',
    weekConfigType: 'fixed',
    fixedWeeks: 12,
    rangeMin: 4,
    rangeMax: 8,
    rangeStep: 1,
    customDurations: [],
    customDurationsInput: '',
    defaultSessionStyle: 'interval',
    progressionMode: 'power',
    defaultDurationMinutes: 15,
    weeks: [],
    programBlocks: [],
    fixedFirstWeek: null,
    fixedLastWeek: null,
    fatigueModifiers: []
};

export const FOCUS_OPTIONS: WeekFocus[] = ['Volume', 'Density', 'Intensity', 'Recovery'];

export const WORK_REST_OPTIONS: { value: string; label: string }[] = [
    { value: 'steady', label: 'Steady State' },
    { value: '1:6', label: '1:6' },
    { value: '1:2', label: '1:2' },
    { value: '1:1', label: '1:1' },
    { value: '2:1', label: '2:1' }
];

export const FATIGUE_CONDITIONS: { value: FatigueCondition; label: string }[] = [
    { value: 'low_fatigue', label: 'Low Fatigue' },
    { value: 'moderate_fatigue', label: 'Moderate Fatigue' },
    { value: 'high_fatigue', label: 'High Fatigue' },
    { value: 'very_high_fatigue', label: 'Very High Fatigue' },
    { value: 'fresh', label: 'Fresh' },
    { value: 'recovered', label: 'Recovered' },
    { value: 'tired', label: 'Tired' },
    { value: 'overreached', label: 'Overreached' }
];

// ============================================================================
// COMPONENT
// ============================================================================

const ProgramEditor: React.FC<ProgramEditorProps> = ({
    editorState,
    setEditorState,
    editingTemplateId,
    validationErrors,
    setValidationErrors,
    showPreview,
    setShowPreview,
    previewWeekCount,
    setPreviewWeekCount,
    onSave,
    onBack,
    onExport
}) => {
    // Step state for multi-step workflow
    const [currentStep, setCurrentStep] = useState(1);
    // Save dialog state
    const [showSaveDialog, setShowSaveDialog] = useState(false);

    // Dynamic steps based on structure type
    const STEPS = useMemo(() => {
        if (editorState.structureType === 'block-based') {
            return [
                { num: 1, label: 'Metadata', icon: FileText },
                { num: 2, label: 'Configuration', icon: Settings2 },
                { num: 3, label: 'Blocks', icon: Boxes },
                { num: 4, label: 'Modifiers', icon: Activity }
            ];
        }
        return [
            { num: 1, label: 'Metadata', icon: FileText },
            { num: 2, label: 'Configuration', icon: Settings2 },
            { num: 3, label: 'Weeks', icon: Layers },
            { num: 4, label: 'Modifiers', icon: Activity }
        ];
    }, [editorState.structureType]);

    const totalSteps = STEPS.length;

    // ========================================================================
    // RENDER HELPERS
    // ========================================================================

    const renderBackButton = () => (
        <button
            onClick={onBack}
            className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white mb-6 transition-colors"
        >
            <ChevronRight size={16} className="rotate-180" />
            <span className="text-sm font-medium">Back to Program</span>
        </button>
    );

    const renderValidationErrors = () => {
        if (validationErrors.length === 0) return null;
        return (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                    <AlertCircle size={16} />
                    <span className="text-sm font-bold">Validation Errors</span>
                </div>
                <ul className="text-sm text-red-600 dark:text-red-400 space-y-1">
                    {validationErrors.map((e, i) => (
                        <li key={i}><strong>{e.field}:</strong> {e.message}</li>
                    ))}
                </ul>
            </div>
        );
    };

    // ========================================================================
    // MAIN EDITOR
    // ========================================================================

    return (
        <div className="space-y-6 pb-16">
            {renderBackButton()}

            {/* Header with Preview/Export */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-2xl font-light text-neutral-900 dark:text-white tracking-tight">
                        {editingTemplateId ? 'Edit Template' : 'Create Template'}
                    </h2>
                    <p className="text-sm text-neutral-500 mt-1">
                        {editingTemplateId ? `Editing: ${editorState.name || 'Untitled'}` : 'Design your custom program'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2"
                    >
                        <Eye size={14} />
                        Preview
                    </button>
                    <button
                        onClick={onExport}
                        className="px-3 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2"
                    >
                        <Download size={14} />
                        Export
                    </button>
                </div>
            </div>


            {renderValidationErrors()}

            {showPreview ? (
                <ProgramPreview
                    editorState={editorState}
                    previewWeekCount={previewWeekCount}
                    setPreviewWeekCount={setPreviewWeekCount}
                    setShowPreview={setShowPreview}
                />
            ) : (
                <>
                    {/* Step 1: Metadata */}
                    {currentStep === 1 && (
                        <MetadataStep editorState={editorState} setEditorState={setEditorState} />
                    )}

                    {/* Step 2: Configuration */}
                    {currentStep === 2 && (
                        <ConfigurationStep editorState={editorState} setEditorState={setEditorState} />
                    )}

                    {/* Step 3: Week Definitions (week-based) or Blocks (block-based) */}
                    {currentStep === 3 && (
                        editorState.structureType === 'block-based' 
                            ? <BlocksDefinitionStep editorState={editorState} setEditorState={setEditorState} />
                            : <WeekDefinitionsStep editorState={editorState} setEditorState={setEditorState} />
                    )}

                    {/* Step 4: Fatigue Modifiers */}
                    {currentStep === 4 && (
                        <FatigueModifiersStep editorState={editorState} setEditorState={setEditorState} />
                    )}

                    {/* Step Navigation */}
                    <div className="flex items-center justify-between gap-3">
                        <button
                            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                            disabled={currentStep === 1}
                            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            <ChevronRight size={16} className="rotate-180" />
                            Back
                        </button>
                        <span className="text-xs text-neutral-400">
                            Step {currentStep} of {totalSteps}
                        </span>
                        {currentStep < totalSteps ? (
                            <button
                                onClick={() => setCurrentStep(prev => Math.min(totalSteps, prev + 1))}
                                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg"
                                style={{ backgroundColor: 'var(--accent)' }}
                            >
                                Next
                                <ChevronRight size={16} />
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowSaveDialog(true)}
                                className="px-4 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider text-white hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg"
                                style={{ backgroundColor: 'var(--accent)' }}
                            >
                                <Save size={14} />
                                Save
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* Save Dialog Modal */}
            {showSaveDialog && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowSaveDialog(false)}>
                    <div
                        className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6 max-w-sm w-full shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">
                            Save Template
                        </h3>
                        <p className="text-sm text-neutral-500 mb-6">
                            How would you like to save this template?
                        </p>
                        <div className="space-y-3">
                            {editingTemplateId && (
                                <button
                                    onClick={() => {
                                        setShowSaveDialog(false);
                                        onSave(false);
                                    }}
                                    className="w-full px-4 py-3 rounded-xl text-sm font-medium text-white flex items-center justify-center gap-2"
                                    style={{ backgroundColor: 'var(--accent)' }}
                                >
                                    <Save size={16} />
                                    Overwrite Existing
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    setShowSaveDialog(false);
                                    onSave(true);
                                }}
                                className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center justify-center gap-2 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                            >
                                <Copy size={16} />
                                Save as New Template
                            </button>
                            <button
                                onClick={() => setShowSaveDialog(false)}
                                className="w-full px-4 py-3 rounded-xl text-sm font-medium text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProgramEditor;
