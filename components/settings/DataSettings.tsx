import React, { useState } from 'react';
import { ProgramRecord, Session, ProgramPreset, QuestionnaireResponse } from '../../types';
import { AccentColor, AccentModifierState } from '../../presets';
import { Download, Upload, AlertCircle, Check, RefreshCw } from 'lucide-react';
import {
    createBackupPayload,
    downloadBackup,
    parseBackupFile,
    getImportPreview,
    mergeImportedData,
    replaceWithImportedData,
    BackupSettings,
    BackupPayload,
    ImportPreview
} from '../../utils/exportUtils';

export interface DataSettingsProps {
    programs: ProgramRecord[];
    sessions: Session[];
    setPrograms: (programs: ProgramRecord[]) => void;
    setSessions: (sessions: Session[]) => void;
    accentColor: AccentColor;
    setAccentColor: (value: AccentColor) => void;
    // New props for complete backup
    questionnaireResponses: QuestionnaireResponse[];
    setQuestionnaireResponses: (responses: QuestionnaireResponse[]) => void;
    customTemplates: ProgramPreset[];
    setCustomTemplates: (templates: ProgramPreset[]) => void;
    accentModifiers: AccentModifierState;
    setAccentModifiers: (modifiers: AccentModifierState) => void;
    templateOrder: string[];
    setTemplateOrder: (order: string[]) => void;
    modifiedDefaults: Record<string, Partial<ProgramPreset>>;
    setModifiedDefaults: (modified: Record<string, Partial<ProgramPreset>>) => void;
    deletedDefaultIds: string[];
    setDeletedDefaultIds: (ids: string[]) => void;
}

type ImportMode = 'replace' | 'merge';

interface ImportState {
    stage: 'idle' | 'preview' | 'confirm' | 'success' | 'error';
    preview?: ImportPreview;
    payload?: BackupPayload;
    mode: ImportMode;
    error?: string;
    warnings?: string[];
    mergeStats?: {
        programsAdded: number;
        programsSkipped: number;
        sessionsAdded: number;
        sessionsSkipped: number;
        questionnairesAdded: number;
        questionnairesSkipped: number;
        templatesAdded: number;
        templatesSkipped: number;
    };
}

const DataSettings: React.FC<DataSettingsProps> = ({
    programs,
    sessions,
    setPrograms,
    setSessions,
    accentColor,
    setAccentColor,
    questionnaireResponses,
    setQuestionnaireResponses,
    customTemplates,
    setCustomTemplates,
    accentModifiers,
    setAccentModifiers,
    templateOrder,
    setTemplateOrder,
    modifiedDefaults,
    setModifiedDefaults,
    deletedDefaultIds,
    setDeletedDefaultIds,
}) => {
    const [importState, setImportState] = useState<ImportState>({ stage: 'idle', mode: 'replace' });

    const handleExport = () => {
        const settings: BackupSettings = {
            accentColor,
            accentModifiers,
            templateOrder,
            modifiedDefaults,
            deletedDefaultIds
        };

        const payload = createBackupPayload(
            programs,
            sessions,
            questionnaireResponses,
            customTemplates,
            settings
        );

        downloadBackup(payload);
    };

    const handleImportClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const result = parseBackupFile(event.target?.result as string);

                    if (!result.valid) {
                        setImportState({
                            stage: 'error',
                            mode: 'replace',
                            error: result.errors.join(', '),
                            warnings: result.warnings
                        });
                        return;
                    }

                    const preview = getImportPreview(result.payload!);
                    setImportState({
                        stage: 'preview',
                        mode: 'replace',
                        preview,
                        payload: result.payload,
                        warnings: result.warnings
                    });
                };
                reader.readAsText(file);
            }
        };
        input.click();
    };

    const handleConfirmImport = () => {
        if (!importState.payload) return;

        const existingSettings: BackupSettings = {
            accentColor,
            accentModifiers,
            templateOrder,
            modifiedDefaults,
            deletedDefaultIds
        };

        if (importState.mode === 'merge') {
            const result = mergeImportedData(importState.payload, {
                programs,
                sessions,
                questionnaireResponses,
                customTemplates,
                settings: existingSettings
            });

            setPrograms(result.programs);
            setSessions(result.sessions);
            setQuestionnaireResponses(result.questionnaireResponses);
            setCustomTemplates(result.customTemplates);
            setAccentColor(result.settings.accentColor);
            setAccentModifiers(result.settings.accentModifiers);
            setTemplateOrder(result.settings.templateOrder);
            setModifiedDefaults(result.settings.modifiedDefaults);
            setDeletedDefaultIds(result.settings.deletedDefaultIds);

            setImportState({
                stage: 'success',
                mode: 'merge',
                mergeStats: result.stats
            });
        } else {
            const result = replaceWithImportedData(importState.payload);

            setPrograms(result.programs);
            setSessions(result.sessions);
            setQuestionnaireResponses(result.questionnaireResponses);
            setCustomTemplates(result.customTemplates);
            setAccentColor(result.settings.accentColor);
            setAccentModifiers(result.settings.accentModifiers);
            setTemplateOrder(result.settings.templateOrder);
            setModifiedDefaults(result.settings.modifiedDefaults);
            setDeletedDefaultIds(result.settings.deletedDefaultIds);

            setImportState({ stage: 'success', mode: 'replace' });
        }
    };

    const handleCancelImport = () => {
        setImportState({ stage: 'idle', mode: 'replace' });
    };

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-light text-neutral-900 dark:text-white tracking-tight">Data</h2>

            {/* Export Section */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4">Backup</h3>
                <button
                    onClick={handleExport}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors focus:outline-none"
                >
                    <Download size={16} />
                    Export All Data
                </button>
                <p className="text-xs text-neutral-500 mt-3">
                    Exports programs, sessions, questionnaires, templates, and settings
                </p>
            </div>

            {/* Import Section */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4">Restore</h3>

                {importState.stage === 'idle' && (
                    <>
                        <button
                            onClick={handleImportClick}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors focus:outline-none"
                        >
                            <Upload size={16} />
                            Import Backup
                        </button>
                        <p className="text-xs text-neutral-500 mt-3">
                            Supports both v1 and v2 backup formats
                        </p>
                    </>
                )}

                {importState.stage === 'preview' && importState.preview && (
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800">
                            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                                Backup from {formatDate(importState.preview.exportedAt)}
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                                <div>{importState.preview.programCount} programs</div>
                                <div>{importState.preview.sessionCount} sessions</div>
                                <div>{importState.preview.questionnaireCount} questionnaires</div>
                                <div>{importState.preview.customTemplateCount} templates</div>
                            </div>
                        </div>

                        {importState.warnings && importState.warnings.length > 0 && (
                            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-start gap-2">
                                <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                <div className="text-xs text-amber-700 dark:text-amber-300">
                                    {importState.warnings.map((w, i) => <p key={i}>{w}</p>)}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={() => setImportState(s => ({ ...s, mode: 'replace' }))}
                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${importState.mode === 'replace'
                                        ? 'bg-[var(--accent)] text-white'
                                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                                    }`}
                            >
                                Replace All
                            </button>
                            <button
                                onClick={() => setImportState(s => ({ ...s, mode: 'merge' }))}
                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${importState.mode === 'merge'
                                        ? 'bg-[var(--accent)] text-white'
                                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                                    }`}
                            >
                                Merge
                            </button>
                        </div>

                        <p className="text-xs text-neutral-500">
                            {importState.mode === 'replace'
                                ? 'Replaces all existing data with backup data'
                                : 'Adds new items, skips duplicates, uses newer questionnaire entries'}
                        </p>

                        <div className="flex gap-2">
                            <button
                                onClick={handleCancelImport}
                                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmImport}
                                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider bg-[var(--accent)] text-white hover:opacity-90 transition-opacity"
                            >
                                {importState.mode === 'replace' ? 'Replace' : 'Merge'}
                            </button>
                        </div>
                    </div>
                )}

                {importState.stage === 'success' && (
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center gap-3">
                            <Check size={20} className="text-emerald-600 dark:text-emerald-400" />
                            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                Import successful!
                            </span>
                        </div>

                        {importState.mode === 'merge' && importState.mergeStats && (
                            <div className="p-4 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
                                <p>{importState.mergeStats.programsAdded} programs added, {importState.mergeStats.programsSkipped} skipped</p>
                                <p>{importState.mergeStats.sessionsAdded} sessions added, {importState.mergeStats.sessionsSkipped} skipped</p>
                                <p>{importState.mergeStats.questionnairesAdded} questionnaires added, {importState.mergeStats.questionnairesSkipped} skipped</p>
                                <p>{importState.mergeStats.templatesAdded} templates added, {importState.mergeStats.templatesSkipped} skipped</p>
                            </div>
                        )}

                        <button
                            onClick={handleCancelImport}
                            className="w-full py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                )}

                {importState.stage === 'error' && (
                    <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-start gap-3">
                            <AlertCircle size={20} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-red-700 dark:text-red-300">Import failed</p>
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{importState.error}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleCancelImport}
                            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                            <RefreshCw size={16} />
                            Try Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DataSettings;
