import React, { useState, useEffect, useMemo } from 'react';
import { Session, ProgramRecord, ProgramPreset, QuestionnaireResponse } from '../types';
import { DEFAULT_PRESETS, AccentColor, AccentModifierState } from '../presets';
import { hydratePreset } from '../utils/templateUtils';

// Mutable array that combines defaults + custom templates (for backward compatibility)
export let PRESETS: ProgramPreset[] = [...DEFAULT_PRESETS];

export interface AppStateReturn {
    // Programs and sessions
    programs: ProgramRecord[];
    setPrograms: React.Dispatch<React.SetStateAction<ProgramRecord[]>>;
    sessions: Session[];
    setSessions: React.Dispatch<React.SetStateAction<Session[]>>;

    // Loading state
    isLoading: boolean;
    loadingStatus: string;
    initError: string | null;

    // Templates
    customTemplates: ProgramPreset[];
    setCustomTemplates: React.Dispatch<React.SetStateAction<ProgramPreset[]>>;
    modifiedDefaults: Record<string, Partial<ProgramPreset>>;
    setModifiedDefaults: React.Dispatch<React.SetStateAction<Record<string, Partial<ProgramPreset>>>>;
    deletedDefaultIds: string[];
    setDeletedDefaultIds: React.Dispatch<React.SetStateAction<string[]>>;
    templateOrder: string[];
    setTemplateOrder: React.Dispatch<React.SetStateAction<string[]>>;
    templateListExpanded: boolean;
    setTemplateListExpanded: React.Dispatch<React.SetStateAction<boolean>>;
    editingTemplateId: string | null;
    setEditingTemplateId: React.Dispatch<React.SetStateAction<string | null>>;
    editingTemplateName: string;
    setEditingTemplateName: React.Dispatch<React.SetStateAction<string>>;

    accentColor: AccentColor;
    setAccentColor: React.Dispatch<React.SetStateAction<AccentColor>>;
    accentModifiers: AccentModifierState;
    setAccentModifiers: React.Dispatch<React.SetStateAction<AccentModifierState>>;

    // Questionnaire
    questionnaireResponses: QuestionnaireResponse[];
    setQuestionnaireResponses: React.Dispatch<React.SetStateAction<QuestionnaireResponse[]>>;
    getTodayQuestionnaireResponse: () => QuestionnaireResponse | undefined;

    // Computed values
    activePresets: ProgramPreset[];
    activeProgram: ProgramRecord | undefined;

    // Helper functions
    isDefaultPreset: (id: string) => boolean;
    isDefaultModified: (id: string) => boolean;
    moveTemplate: (presetId: string, direction: 'up' | 'down') => void;
}

export function useAppState(): AppStateReturn {
    const [programs, setPrograms] = useState<ProgramRecord[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingStatus, setLoadingStatus] = useState("Initializing...");
    const [initError, setInitError] = useState<string | null>(null);

    // Custom templates state (stored separately from default presets)
    const [customTemplates, setCustomTemplates] = useState<ProgramPreset[]>([]);
    // Track modifications to default presets (overrides)
    const [modifiedDefaults, setModifiedDefaults] = useState<Record<string, Partial<ProgramPreset>>>({});
    // Track deleted default presets
    const [deletedDefaultIds, setDeletedDefaultIds] = useState<string[]>([]);
    const [templateListExpanded, setTemplateListExpanded] = useState(false);
    const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
    const [editingTemplateName, setEditingTemplateName] = useState('');

    // Track template order (array of IDs)
    const [templateOrder, setTemplateOrder] = useState<string[]>([]);

    // Accent color preference
    const [accentColor, setAccentColor] = useState<AccentColor>('mono');
    // Accent modifiers
    const [accentModifiers, setAccentModifiers] = useState<AccentModifierState>({});
    // Questionnaire responses
    const [questionnaireResponses, setQuestionnaireResponses] = useState<QuestionnaireResponse[]>([]);

    // Get today's questionnaire response
    const getTodayQuestionnaireResponse = () => {
        const today = new Date().toISOString().split('T')[0];
        return questionnaireResponses.find(r => r.date === today);
    };

    // Check if a preset is a default (built-in) preset
    const isDefaultPreset = (id: string) => DEFAULT_PRESETS.some(p => p.id === id);

    // Check if a default has been modified
    const isDefaultModified = (id: string) => modifiedDefaults[id] !== undefined || deletedDefaultIds.includes(id);

    // Get active presets (defaults with modifications + custom, minus deleted)
    const activePresets = useMemo(() => {
        const activeDefaults = DEFAULT_PRESETS
            .filter(p => !deletedDefaultIds.includes(p.id))
            .map(p => modifiedDefaults[p.id] ? { ...p, ...modifiedDefaults[p.id] } : p);
        const allPresets = [...activeDefaults, ...customTemplates];

        // If we have a custom order, use it; otherwise use default order
        if (templateOrder.length > 0) {
            return [...allPresets].sort((a, b) => {
                const indexA = templateOrder.indexOf(a.id);
                const indexB = templateOrder.indexOf(b.id);
                // If not in order array, put at end
                if (indexA === -1 && indexB === -1) return 0;
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });
        }
        return allPresets;
    }, [customTemplates, modifiedDefaults, deletedDefaultIds, templateOrder]);

    // Move template up/down in list
    const moveTemplate = (presetId: string, direction: 'up' | 'down') => {
        const currentOrder = templateOrder.length > 0
            ? templateOrder
            : activePresets.map(p => p.id);
        const currentIndex = currentOrder.indexOf(presetId);
        if (currentIndex === -1) return;

        const newIndex = direction === 'up'
            ? Math.max(0, currentIndex - 1)
            : Math.min(currentOrder.length - 1, currentIndex + 1);

        if (newIndex === currentIndex) return;

        const newOrder = [...currentOrder];
        newOrder.splice(currentIndex, 1);
        newOrder.splice(newIndex, 0, presetId);
        setTemplateOrder(newOrder);
    };

    // Sync PRESETS array whenever activePresets changes
    useEffect(() => {
        PRESETS = activePresets;
    }, [activePresets]);

    // Initialize app data
    useEffect(() => {
        const initApp = async () => {
            try {
                setLoadingStatus("Loading settings...");
                await new Promise(r => setTimeout(r, 500)); // Visible delay

                setLoadingStatus("Checking data migration...");
                const savedPrograms = localStorage.getItem('ck_programs');
                let loadedPrograms: ProgramRecord[] = [];

                if (savedPrograms) {
                    loadedPrograms = JSON.parse(savedPrograms);
                } else {
                    // Migration Logic
                    const oldSettings = localStorage.getItem('ck_settings');
                    if (oldSettings) {
                        try {
                            const parsed = JSON.parse(oldSettings);
                            const preset = PRESETS[0];
                            loadedPrograms = [{
                                id: 'legacy-' + Date.now(),
                                presetId: preset.id,
                                name: 'Legacy Program',
                                startDate: parsed.startDate || new Date().toISOString().split('T')[0],
                                status: 'active',
                                basePower: parsed.basePower || 150,
                                plan: preset.generator(parsed.basePower || 150)
                            }];
                        } catch (e) {
                            console.error("Migration failed", e);
                        }
                    }
                }
                setPrograms(loadedPrograms);

                setLoadingStatus("Loading sessions...");
                const savedSessions = localStorage.getItem('ck_sessions');
                let loadedSessions: Session[] = savedSessions ? JSON.parse(savedSessions) : [];

                // Session Migration
                if (loadedPrograms.length > 0 && loadedSessions.some(s => !s.programId)) {
                    const mainProgramId = loadedPrograms[0].id;
                    loadedSessions = loadedSessions.map(s => s.programId ? s : { ...s, programId: mainProgramId });
                }
                setSessions(loadedSessions);

                // Load accent color preference
                const savedAccent = localStorage.getItem('ck_accent_color');
                if (savedAccent && ['mono', 'red', 'orange', 'green', 'blue', 'purple', 'pink', 'material'].includes(savedAccent)) {
                    setAccentColor(savedAccent as AccentColor);
                }

                // Load accent modifiers
                const savedModifiers = localStorage.getItem('ck_accent_modifiers');
                if (savedModifiers) {
                    try {
                        setAccentModifiers(JSON.parse(savedModifiers));
                    } catch (e) {
                        console.error('Failed to load accent modifiers', e);
                    }
                }

                // Load custom templates
                const savedTemplates = localStorage.getItem('ck_custom_templates');
                if (savedTemplates) {
                    try {
                        const parsed = JSON.parse(savedTemplates);
                        // Hydrate presets to reconstruct generator functions (lost during JSON serialization)
                        const hydrated = (parsed as ProgramPreset[]).map(hydratePreset);
                        setCustomTemplates(hydrated);
                    } catch (e) {
                        console.error('Failed to load custom templates', e);
                    }
                }

                // Load modified defaults
                const savedModified = localStorage.getItem('ck_modified_defaults');
                if (savedModified) {
                    try {
                        setModifiedDefaults(JSON.parse(savedModified));
                    } catch (e) {
                        console.error('Failed to load modified defaults', e);
                    }
                }

                // Load deleted defaults
                const savedDeleted = localStorage.getItem('ck_deleted_defaults');
                if (savedDeleted) {
                    try {
                        setDeletedDefaultIds(JSON.parse(savedDeleted));
                    } catch (e) {
                        console.error('Failed to load deleted defaults', e);
                    }
                }

                // Load template order
                const savedOrder = localStorage.getItem('ck_template_order');
                if (savedOrder) {
                    try {
                        setTemplateOrder(JSON.parse(savedOrder));
                    } catch (e) {
                        console.error('Failed to load template order', e);
                    }
                }

                // Load questionnaire responses
                const savedQuestionnaire = localStorage.getItem('ck_questionnaire_responses');
                if (savedQuestionnaire) {
                    try {
                        setQuestionnaireResponses(JSON.parse(savedQuestionnaire));
                    } catch (e) {
                        console.error('Failed to load questionnaire responses', e);
                    }
                }

                setLoadingStatus("Ready.");
                setIsLoading(false);

            } catch (err: any) {
                console.error("Initialization Error:", err);
                setInitError(err.message || "Unknown error occurred during startup.");
                setIsLoading(false);
            }
        };

        initApp();
    }, []);

    // Persist programs
    useEffect(() => {
        if (!isLoading) {
            localStorage.setItem('ck_programs', JSON.stringify(programs));
        }
    }, [programs, isLoading]);

    // Persist sessions
    useEffect(() => {
        if (!isLoading) {
            localStorage.setItem('ck_sessions', JSON.stringify(sessions));
        }
    }, [sessions, isLoading]);

    // Save accent color preference
    useEffect(() => {
        if (!isLoading) {
            localStorage.setItem('ck_accent_color', accentColor);
        }
    }, [accentColor, isLoading]);

    // Save accent modifiers
    useEffect(() => {
        if (!isLoading) {
            localStorage.setItem('ck_accent_modifiers', JSON.stringify(accentModifiers));
        }
    }, [accentModifiers, isLoading]);

    // Save custom templates
    useEffect(() => {
        if (!isLoading) {
            localStorage.setItem('ck_custom_templates', JSON.stringify(customTemplates));
        }
    }, [customTemplates, isLoading]);

    // Save modified defaults and deleted defaults
    useEffect(() => {
        if (!isLoading) {
            localStorage.setItem('ck_modified_defaults', JSON.stringify(modifiedDefaults));
            localStorage.setItem('ck_deleted_defaults', JSON.stringify(deletedDefaultIds));
        }
    }, [modifiedDefaults, deletedDefaultIds, isLoading]);

    // Save template order
    useEffect(() => {
        if (!isLoading && templateOrder.length > 0) {
            localStorage.setItem('ck_template_order', JSON.stringify(templateOrder));
        }
    }, [templateOrder, isLoading]);

    // Save questionnaire responses
    useEffect(() => {
        if (!isLoading) {
            localStorage.setItem('ck_questionnaire_responses', JSON.stringify(questionnaireResponses));
        }
    }, [questionnaireResponses, isLoading]);

    const activeProgram = programs.find(p => p.status === 'active');

    return {
        programs,
        setPrograms,
        sessions,
        setSessions,
        isLoading,
        loadingStatus,
        initError,
        customTemplates,
        setCustomTemplates,
        modifiedDefaults,
        setModifiedDefaults,
        deletedDefaultIds,
        setDeletedDefaultIds,
        templateOrder,
        setTemplateOrder,
        templateListExpanded,
        setTemplateListExpanded,
        editingTemplateId,
        setEditingTemplateId,
        editingTemplateName,
        setEditingTemplateName,
        accentColor,
        setAccentColor,
        accentModifiers,
        setAccentModifiers,
        questionnaireResponses,
        setQuestionnaireResponses,
        getTodayQuestionnaireResponse,
        activePresets,
        activeProgram,
        isDefaultPreset,
        isDefaultModified,
        moveTemplate,
    };
}
