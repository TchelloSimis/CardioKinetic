/**
 * Export/Import Utilities
 * 
 * Comprehensive backup and restore functionality for CardioKinetic.
 * Supports all app data including questionnaire responses and custom templates.
 */

import { Session, ProgramRecord, ProgramPreset, QuestionnaireResponse } from '../types';
import { AccentColor, AccentModifierState } from '../presets';
import { hydratePreset } from './templateUtils';

// ============================================================================
// TYPES
// ============================================================================

export const BACKUP_VERSION = '2.0';

export interface BackupSettings {
    accentColor: AccentColor;
    accentModifiers: AccentModifierState;
    templateOrder: string[];
    modifiedDefaults: Record<string, Partial<ProgramPreset>>;
    deletedDefaultIds: string[];
}

export interface BackupPayload {
    version: string;
    exportedAt: string;
    programs: ProgramRecord[];
    sessions: Session[];
    questionnaireResponses: QuestionnaireResponse[];
    customTemplates: ProgramPreset[];
    settings: BackupSettings;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    payload?: BackupPayload;
}

export interface ImportPreview {
    programCount: number;
    sessionCount: number;
    questionnaireCount: number;
    customTemplateCount: number;
    exportedAt: string;
    version: string;
}

export interface MergeResult {
    programs: ProgramRecord[];
    sessions: Session[];
    questionnaireResponses: QuestionnaireResponse[];
    customTemplates: ProgramPreset[];
    settings: BackupSettings;
    stats: {
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

// ============================================================================
// CREATE BACKUP
// ============================================================================

/**
 * Creates a complete backup payload from current app state.
 */
export function createBackupPayload(
    programs: ProgramRecord[],
    sessions: Session[],
    questionnaireResponses: QuestionnaireResponse[],
    customTemplates: ProgramPreset[],
    settings: BackupSettings
): BackupPayload {
    return {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        programs,
        sessions,
        questionnaireResponses,
        customTemplates: customTemplates.map(t => ({
            ...t,
            // Strip generator function as it's not serializable
            generator: undefined as any
        })),
        settings
    };
}

/**
 * Creates a downloadable backup file.
 */
export function downloadBackup(payload: BackupPayload): void {
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cardiokinetic-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================================================
// VALIDATE BACKUP
// ============================================================================

/**
 * Validates a backup file and returns parsed payload if valid.
 */
export function validateBackupFile(data: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if it's an object
    if (typeof data !== 'object' || data === null) {
        return { valid: false, errors: ['Invalid backup: not an object'], warnings: [] };
    }

    const payload = data as Record<string, unknown>;

    // Version check
    if (typeof payload.version !== 'string') {
        // Legacy v1 format (no version field)
        if (payload.programs && payload.sessions) {
            warnings.push('Legacy backup format detected (v1). Will attempt migration.');
            return migrateV1ToV2(payload);
        }
        errors.push('Missing version field');
    }

    // Required arrays
    if (!Array.isArray(payload.programs)) {
        errors.push('Missing or invalid programs array');
    }
    if (!Array.isArray(payload.sessions)) {
        errors.push('Missing or invalid sessions array');
    }

    // Optional v2 fields
    if (payload.questionnaireResponses !== undefined && !Array.isArray(payload.questionnaireResponses)) {
        errors.push('Invalid questionnaireResponses: expected array');
    }
    if (payload.customTemplates !== undefined && !Array.isArray(payload.customTemplates)) {
        errors.push('Invalid customTemplates: expected array');
    }

    // Validate program structure
    if (Array.isArray(payload.programs)) {
        payload.programs.forEach((p: any, i: number) => {
            if (!p.id) errors.push(`Program ${i}: missing id`);
            if (!p.name) warnings.push(`Program ${i}: missing name`);
            if (!p.startDate) warnings.push(`Program ${i}: missing startDate`);
        });
    }

    // Validate session structure
    if (Array.isArray(payload.sessions)) {
        payload.sessions.forEach((s: any, i: number) => {
            if (!s.id) errors.push(`Session ${i}: missing id`);
            if (!s.date) errors.push(`Session ${i}: missing date`);
            if (typeof s.duration !== 'number') warnings.push(`Session ${i}: missing duration`);
            if (typeof s.power !== 'number') warnings.push(`Session ${i}: missing power`);
        });
    }

    if (errors.length > 0) {
        return { valid: false, errors, warnings };
    }

    // Build validated payload
    const validPayload: BackupPayload = {
        version: (payload.version as string) || BACKUP_VERSION,
        exportedAt: (payload.exportedAt as string) || new Date().toISOString(),
        programs: payload.programs as ProgramRecord[],
        sessions: payload.sessions as Session[],
        questionnaireResponses: (payload.questionnaireResponses as QuestionnaireResponse[]) || [],
        customTemplates: (payload.customTemplates as ProgramPreset[]) || [],
        settings: (payload.settings as BackupSettings) || {
            accentColor: 'mono',
            accentModifiers: {},
            templateOrder: [],
            modifiedDefaults: {},
            deletedDefaultIds: []
        }
    };

    return { valid: true, errors: [], warnings, payload: validPayload };
}

/**
 * Migrates v1 backup format to v2.
 */
function migrateV1ToV2(data: Record<string, unknown>): ValidationResult {
    const payload: BackupPayload = {
        version: BACKUP_VERSION,
        exportedAt: (data.exportedAt as string) || new Date().toISOString(),
        programs: (data.programs as ProgramRecord[]) || [],
        sessions: (data.sessions as Session[]) || [],
        questionnaireResponses: [],
        customTemplates: [],
        settings: {
            accentColor: (data.accentColor as AccentColor) || 'mono',
            accentModifiers: {},
            templateOrder: [],
            modifiedDefaults: {},
            deletedDefaultIds: []
        }
    };

    return {
        valid: true,
        errors: [],
        warnings: ['Migrated from v1 format. Questionnaire and custom templates not included in this backup.'],
        payload
    };
}

// ============================================================================
// IMPORT PREVIEW
// ============================================================================

/**
 * Generates a preview of import contents without applying changes.
 */
export function getImportPreview(payload: BackupPayload): ImportPreview {
    return {
        programCount: payload.programs.length,
        sessionCount: payload.sessions.length,
        questionnaireCount: payload.questionnaireResponses.length,
        customTemplateCount: payload.customTemplates.length,
        exportedAt: payload.exportedAt,
        version: payload.version
    };
}

// ============================================================================
// MERGE IMPORT
// ============================================================================

/**
 * Merges imported data with existing data.
 * - Programs: Skip if ID already exists
 * - Sessions: Skip if ID already exists
 * - Questionnaires: Use newer if date conflict
 * - Templates: Skip if ID already exists
 */
export function mergeImportedData(
    imported: BackupPayload,
    existing: {
        programs: ProgramRecord[];
        sessions: Session[];
        questionnaireResponses: QuestionnaireResponse[];
        customTemplates: ProgramPreset[];
        settings: BackupSettings;
    }
): MergeResult {
    const stats = {
        programsAdded: 0,
        programsSkipped: 0,
        sessionsAdded: 0,
        sessionsSkipped: 0,
        questionnairesAdded: 0,
        questionnairesSkipped: 0,
        templatesAdded: 0,
        templatesSkipped: 0
    };

    // Merge programs
    const existingProgramIds = new Set(existing.programs.map(p => p.id));
    const newPrograms = imported.programs.filter(p => {
        if (existingProgramIds.has(p.id)) {
            stats.programsSkipped++;
            return false;
        }
        stats.programsAdded++;
        return true;
    });
    const mergedPrograms = [...existing.programs, ...newPrograms];

    // Merge sessions
    const existingSessionIds = new Set(existing.sessions.map(s => s.id));
    const newSessions = imported.sessions.filter(s => {
        if (existingSessionIds.has(s.id)) {
            stats.sessionsSkipped++;
            return false;
        }
        stats.sessionsAdded++;
        return true;
    });
    const mergedSessions = [...existing.sessions, ...newSessions];

    // Merge questionnaires (use newer timestamp if date conflict)
    const questionnaireMap = new Map<string, QuestionnaireResponse>();
    existing.questionnaireResponses.forEach(q => questionnaireMap.set(q.date, q));

    imported.questionnaireResponses.forEach(q => {
        const existingQ = questionnaireMap.get(q.date);
        if (!existingQ) {
            questionnaireMap.set(q.date, q);
            stats.questionnairesAdded++;
        } else if (q.timestamp > existingQ.timestamp) {
            questionnaireMap.set(q.date, q);
            stats.questionnairesAdded++;
        } else {
            stats.questionnairesSkipped++;
        }
    });
    const mergedQuestionnaires = Array.from(questionnaireMap.values());

    // Merge custom templates (hydrate to restore generator functions)
    const existingTemplateIds = new Set(existing.customTemplates.map(t => t.id));
    const newTemplates = imported.customTemplates
        .filter(t => {
            if (existingTemplateIds.has(t.id)) {
                stats.templatesSkipped++;
                return false;
            }
            stats.templatesAdded++;
            return true;
        })
        .map(hydratePreset);
    const mergedTemplates = [...existing.customTemplates, ...newTemplates];

    // Merge settings (imported settings take precedence only for empty values)
    const mergedSettings: BackupSettings = {
        accentColor: existing.settings.accentColor || imported.settings.accentColor,
        accentModifiers: Object.keys(existing.settings.accentModifiers).length > 0
            ? existing.settings.accentModifiers
            : imported.settings.accentModifiers,
        templateOrder: existing.settings.templateOrder.length > 0
            ? existing.settings.templateOrder
            : imported.settings.templateOrder,
        modifiedDefaults: Object.keys(existing.settings.modifiedDefaults).length > 0
            ? existing.settings.modifiedDefaults
            : imported.settings.modifiedDefaults,
        deletedDefaultIds: existing.settings.deletedDefaultIds.length > 0
            ? existing.settings.deletedDefaultIds
            : imported.settings.deletedDefaultIds
    };

    return {
        programs: mergedPrograms,
        sessions: mergedSessions,
        questionnaireResponses: mergedQuestionnaires,
        customTemplates: mergedTemplates,
        settings: mergedSettings,
        stats
    };
}

/**
 * Full replace import - replaces all existing data.
 */
export function replaceWithImportedData(
    imported: BackupPayload
): {
    programs: ProgramRecord[];
    sessions: Session[];
    questionnaireResponses: QuestionnaireResponse[];
    customTemplates: ProgramPreset[];
    settings: BackupSettings;
} {
    return {
        programs: imported.programs,
        sessions: imported.sessions,
        questionnaireResponses: imported.questionnaireResponses,
        customTemplates: imported.customTemplates.map(hydratePreset),
        settings: imported.settings
    };
}

/**
 * Parses a backup file from JSON string.
 */
export function parseBackupFile(jsonString: string): ValidationResult {
    try {
        const data = JSON.parse(jsonString);
        return validateBackupFile(data);
    } catch (e) {
        return {
            valid: false,
            errors: ['Failed to parse JSON: ' + (e instanceof Error ? e.message : 'Unknown error')],
            warnings: []
        };
    }
}
