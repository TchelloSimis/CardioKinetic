import React from 'react';
import { ChevronRight, Palette, Database, ListTodo, Wrench } from 'lucide-react';
import { ProgramPreset, ProgramRecord, Session, QuestionnaireResponse } from '../types';
import { AccentColor, AccentColorConfig, ThemePreference, AccentModifierState } from '../presets';
import AppearanceSettings from './settings/AppearanceSettings';
import ProgrammingSettings from './settings/ProgrammingSettings';
import DataSettings from './settings/DataSettings';
import DevToolsSettings from './settings/DevToolsSettings';
import UpdateAvailableToast from './settings/UpdateAvailableToast';

export type SettingsCategory = 'main' | 'appearance' | 'programming' | 'data' | 'devtools';

interface SettingsTabProps {
    // Theme
    themePreference: ThemePreference;
    setThemePreference: (value: ThemePreference) => void;
    isDarkMode: boolean;

    // Accent color
    accentColor: AccentColor;
    setAccentColor: (value: AccentColor) => void;
    accentModifiers: AccentModifierState;
    setAccentModifiers: React.Dispatch<React.SetStateAction<AccentModifierState>>;
    ACCENT_COLORS: AccentColorConfig[];
    isAndroid: boolean;
    materialYouColor: string | null;

    // Programs
    activeProgram: ProgramRecord | undefined;
    programs: ProgramRecord[];
    sessions: Session[];
    setPrograms: (programs: ProgramRecord[]) => void;
    setSessions: (sessions: Session[]) => void;
    handleFinishProgram: () => void;
    setActiveTab: (tab: 'dashboard' | 'plan' | 'chart' | 'settings') => void;

    // Templates
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

    // Navigation state
    activeCategory: SettingsCategory;
    setActiveCategory: (category: SettingsCategory) => void;

    // Questionnaire and template order (for complete backup)
    questionnaireResponses: QuestionnaireResponse[];
    setQuestionnaireResponses: React.Dispatch<React.SetStateAction<QuestionnaireResponse[]>>;
    templateOrder: string[];
    setTemplateOrder: React.Dispatch<React.SetStateAction<string[]>>;

    // Developer Tools props
    sampleWeeks: number;
    setSampleWeeks: (weeks: number) => void;
    programLength: number;
    simulatedCurrentDate: string;
    setSimulatedCurrentDate: (date: string) => void;
    autoUpdateSimDate: boolean;
    setAutoUpdateSimDate: (auto: boolean) => void;
    jumpToLastSession: () => void;
    generateSampleData: () => void;
    clearSessions: () => void;

    // Auto-Adaptive Training props
    autoAdaptiveEnabled: boolean;
    setAutoAdaptiveEnabled: (enabled: boolean) => void;
    onProgramSimulationGenerated: (programId: string, simulationData: any) => void;
}

const SettingsTab: React.FC<SettingsTabProps> = ({
    themePreference, setThemePreference, isDarkMode,
    accentColor, setAccentColor, ACCENT_COLORS, isAndroid, materialYouColor,
    activeProgram, programs, sessions, setPrograms, setSessions, handleFinishProgram, setActiveTab,
    activePresets, customTemplates, setCustomTemplates, modifiedDefaults, setModifiedDefaults,
    deletedDefaultIds, setDeletedDefaultIds, templateListExpanded, setTemplateListExpanded,
    editingTemplateId, setEditingTemplateId, editingTemplateName, setEditingTemplateName,
    isDefaultPreset, isDefaultModified, moveTemplate, PRESETS,
    activeCategory, setActiveCategory,
    questionnaireResponses, setQuestionnaireResponses,
    templateOrder, setTemplateOrder,
    sampleWeeks, setSampleWeeks, programLength, simulatedCurrentDate, setSimulatedCurrentDate,
    autoUpdateSimDate, setAutoUpdateSimDate, jumpToLastSession, generateSampleData, clearSessions,
    accentModifiers, setAccentModifiers,
    autoAdaptiveEnabled, setAutoAdaptiveEnabled, onProgramSimulationGenerated
}) => {
    // Category navigation items
    const categories = [
        { id: 'appearance' as const, name: 'Appearance', description: 'Theme and accent color', icon: Palette },
        { id: 'programming' as const, name: 'Programming', description: 'Manage program and templates', icon: ListTodo },
        { id: 'data' as const, name: 'Data', description: 'Import and export data', icon: Database },
        { id: 'devtools' as const, name: 'Developer Tools', description: 'Testing and simulation', icon: Wrench },
    ];

    return (
        <div className="h-full animate-in fade-in duration-500 pb-16 md:pb-4">
            {/* Header with back button when in a category */}
            {activeCategory === 'main' ? (
                <>
                    <h2 className="text-3xl font-light text-neutral-900 dark:text-white tracking-tight mb-2">Settings</h2>
                    <p className="text-neutral-500 text-sm mb-8">App preferences and actions</p>
                </>
            ) : (
                <button
                    onClick={() => setActiveCategory('main')}
                    className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white mb-6 transition-colors"
                >
                    <ChevronRight size={16} className="rotate-180" />
                    <span className="text-sm font-medium">Back to Settings</span>
                </button>
            )}

            {/* Main category selection */}
            {activeCategory === 'main' && (
                <div className="space-y-3">
                    <UpdateAvailableToast />
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className="w-full bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 flex items-center justify-between hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2">
                                    <cat.icon size={24} strokeWidth={2.5} style={{ color: 'var(--accent)' }} />
                                </div>
                                <div className="text-left">
                                    <div className="font-medium text-neutral-900 dark:text-white">{cat.name}</div>
                                    <div className="text-xs text-neutral-500">{cat.description}</div>
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors" />
                        </button>
                    ))}
                </div>
            )}

            {/* Appearance Category */}
            {activeCategory === 'appearance' && (
                <AppearanceSettings
                    themePreference={themePreference}
                    setThemePreference={setThemePreference}
                    isDarkMode={isDarkMode}
                    accentColor={accentColor}
                    setAccentColor={setAccentColor}
                    ACCENT_COLORS={ACCENT_COLORS}
                    isAndroid={isAndroid}
                    materialYouColor={materialYouColor}
                />
            )}

            {/* Programming Category */}
            {activeCategory === 'programming' && (
                <ProgrammingSettings
                    activeProgram={activeProgram}
                    activePresets={activePresets}
                    customTemplates={customTemplates}
                    setCustomTemplates={setCustomTemplates}
                    modifiedDefaults={modifiedDefaults}
                    setModifiedDefaults={setModifiedDefaults}
                    deletedDefaultIds={deletedDefaultIds}
                    setDeletedDefaultIds={setDeletedDefaultIds}
                    templateListExpanded={templateListExpanded}
                    setTemplateListExpanded={setTemplateListExpanded}
                    editingTemplateId={editingTemplateId}
                    setEditingTemplateId={setEditingTemplateId}
                    editingTemplateName={editingTemplateName}
                    setEditingTemplateName={setEditingTemplateName}
                    isDefaultPreset={isDefaultPreset}
                    isDefaultModified={isDefaultModified}
                    moveTemplate={moveTemplate}
                    PRESETS={PRESETS}
                    autoAdaptiveEnabled={autoAdaptiveEnabled}
                    setAutoAdaptiveEnabled={setAutoAdaptiveEnabled}
                    allPrograms={programs}
                    onProgramSimulationGenerated={onProgramSimulationGenerated}
                    accentColor={accentColor}
                    ACCENT_COLORS={ACCENT_COLORS}
                    materialYouColor={materialYouColor}
                    isDarkMode={isDarkMode}
                />
            )}

            {/* Data Category */}
            {activeCategory === 'data' && (
                <DataSettings
                    programs={programs}
                    sessions={sessions}
                    setPrograms={setPrograms}
                    setSessions={setSessions}
                    accentColor={accentColor}
                    setAccentColor={setAccentColor}
                    questionnaireResponses={questionnaireResponses}
                    setQuestionnaireResponses={setQuestionnaireResponses}
                    customTemplates={customTemplates}
                    setCustomTemplates={setCustomTemplates}
                    accentModifiers={accentModifiers}
                    setAccentModifiers={setAccentModifiers}
                    templateOrder={templateOrder}
                    setTemplateOrder={setTemplateOrder}
                    modifiedDefaults={modifiedDefaults}
                    setModifiedDefaults={setModifiedDefaults}
                    deletedDefaultIds={deletedDefaultIds}
                    setDeletedDefaultIds={setDeletedDefaultIds}
                    ACCENT_COLORS={ACCENT_COLORS}
                    materialYouColor={materialYouColor}
                    isDarkMode={isDarkMode}
                />
            )}

            {/* Developer Tools Category */}
            {activeCategory === 'devtools' && (
                <DevToolsSettings
                    sampleWeeks={sampleWeeks}
                    setSampleWeeks={setSampleWeeks}
                    programLength={programLength}
                    simulatedCurrentDate={simulatedCurrentDate}
                    setSimulatedCurrentDate={setSimulatedCurrentDate}
                    autoUpdateSimDate={autoUpdateSimDate}
                    setAutoUpdateSimDate={setAutoUpdateSimDate}
                    jumpToLastSession={jumpToLastSession}
                    generateSampleData={generateSampleData}
                    clearSessions={clearSessions}
                    accentColor={accentColor}
                    accentModifiers={accentModifiers}
                    setAccentModifiers={setAccentModifiers}
                    ACCENT_COLORS={ACCENT_COLORS}
                    materialYouColor={materialYouColor}
                    activePresets={activePresets}
                    isDarkMode={isDarkMode}
                />
            )}
        </div>
    );
};

export default SettingsTab;
