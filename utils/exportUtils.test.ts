/**
 * Tests for exportUtils.ts
 */

import { describe, it, expect } from 'vitest';
import {
    BACKUP_VERSION,
    createBackupPayload,
    validateBackupFile,
    parseBackupFile,
    getImportPreview,
    mergeImportedData,
    replaceWithImportedData,
    BackupPayload,
    BackupSettings
} from './exportUtils';
import { ProgramRecord, Session, QuestionnaireResponse, ProgramPreset } from '../types';

// ============================================================================
// TEST DATA FIXTURES
// ============================================================================

const mockProgram: ProgramRecord = {
    id: 'prog-1',
    presetId: 'test-preset',
    name: 'Test Program',
    startDate: '2024-01-01',
    status: 'active',
    basePower: 150,
    plan: []
};

const mockSession: Session = {
    id: 'session-1',
    date: '2024-01-15',
    duration: 30,
    power: 160,
    distance: 10,
    rpe: 7
};

const mockQuestionnaire: QuestionnaireResponse = {
    date: '2024-01-15',
    responses: { sleep: 4, nutrition: 3 },
    timestamp: '2024-01-15T08:00:00Z'
};

const mockTemplate: ProgramPreset = {
    id: 'custom-template-1',
    name: 'Custom HIIT',
    description: 'A custom HIIT template',
    generator: () => []
};

const mockSettings: BackupSettings = {
    accentColor: 'purple',
    accentModifiers: {},
    templateOrder: ['custom-template-1'],
    modifiedDefaults: {},
    deletedDefaultIds: []
};

// ============================================================================
// createBackupPayload TESTS
// ============================================================================

describe('createBackupPayload', () => {
    it('should create a valid backup payload', () => {
        const payload = createBackupPayload(
            [mockProgram],
            [mockSession],
            [mockQuestionnaire],
            [mockTemplate],
            mockSettings
        );

        expect(payload.version).toBe(BACKUP_VERSION);
        expect(payload.exportedAt).toBeDefined();
        expect(payload.programs).toHaveLength(1);
        expect(payload.sessions).toHaveLength(1);
        expect(payload.questionnaireResponses).toHaveLength(1);
        expect(payload.customTemplates).toHaveLength(1);
        expect(payload.settings).toEqual(mockSettings);
    });

    it('should strip generator function from templates', () => {
        const payload = createBackupPayload(
            [],
            [],
            [],
            [mockTemplate],
            mockSettings
        );

        expect(payload.customTemplates[0].generator).toBeUndefined();
    });

    it('should handle empty data', () => {
        const emptySettings: BackupSettings = {
            accentColor: 'mono',
            accentModifiers: {},
            templateOrder: [],
            modifiedDefaults: {},
            deletedDefaultIds: []
        };

        const payload = createBackupPayload([], [], [], [], emptySettings);

        expect(payload.programs).toHaveLength(0);
        expect(payload.sessions).toHaveLength(0);
        expect(payload.questionnaireResponses).toHaveLength(0);
        expect(payload.customTemplates).toHaveLength(0);
    });
});

// ============================================================================
// validateBackupFile TESTS
// ============================================================================

describe('validateBackupFile', () => {
    it('should validate a correct v2 payload', () => {
        const payload: BackupPayload = {
            version: '2.0',
            exportedAt: '2024-01-01T00:00:00Z',
            programs: [mockProgram],
            sessions: [mockSession],
            questionnaireResponses: [mockQuestionnaire],
            customTemplates: [],
            settings: mockSettings
        };

        const result = validateBackupFile(payload);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should reject non-object input', () => {
        expect(validateBackupFile(null).valid).toBe(false);
        expect(validateBackupFile('string').valid).toBe(false);
        expect(validateBackupFile(123).valid).toBe(false);
    });

    it('should reject missing programs array', () => {
        const result = validateBackupFile({ version: '2.0', sessions: [] });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Missing or invalid programs array');
    });

    it('should reject missing sessions array', () => {
        const result = validateBackupFile({ version: '2.0', programs: [] });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Missing or invalid sessions array');
    });

    it('should migrate v1 format', () => {
        const v1Payload = {
            programs: [mockProgram],
            sessions: [mockSession],
            accentColor: 'blue',
            exportedAt: '2024-01-01T00:00:00Z'
        };

        const result = validateBackupFile(v1Payload);
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.includes('v1'))).toBe(true);
        expect(result.payload?.version).toBe(BACKUP_VERSION);
        expect(result.payload?.settings.accentColor).toBe('blue');
    });

    it('should validate program structure', () => {
        const payload = {
            version: '2.0',
            programs: [{ name: 'No ID' }], // missing id
            sessions: []
        };

        const result = validateBackupFile(payload);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('missing id'))).toBe(true);
    });

    it('should validate session structure', () => {
        const payload = {
            version: '2.0',
            programs: [],
            sessions: [{ id: 's1' }] // missing date
        };

        const result = validateBackupFile(payload);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('missing date'))).toBe(true);
    });

    it('should add warnings for missing optional fields', () => {
        const payload = {
            version: '2.0',
            programs: [{ id: 'p1' }], // missing name, startDate
            sessions: [{ id: 's1', date: '2024-01-01' }] // missing duration, power
        };

        const result = validateBackupFile(payload);
        expect(result.valid).toBe(true);
        expect(result.warnings.some(w => w.includes('missing name'))).toBe(true);
        expect(result.warnings.some(w => w.includes('missing duration'))).toBe(true);
    });
});

// ============================================================================
// parseBackupFile TESTS
// ============================================================================

describe('parseBackupFile', () => {
    it('should parse valid JSON', () => {
        const json = JSON.stringify({
            version: '2.0',
            programs: [],
            sessions: []
        });

        const result = parseBackupFile(json);
        expect(result.valid).toBe(true);
    });

    it('should reject invalid JSON', () => {
        const result = parseBackupFile('not json');
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('Failed to parse JSON');
    });

    it('should reject JSON with validation errors', () => {
        const result = parseBackupFile('{"programs": "not an array"}');
        expect(result.valid).toBe(false);
    });
});

// ============================================================================
// getImportPreview TESTS
// ============================================================================

describe('getImportPreview', () => {
    it('should generate correct preview', () => {
        const payload: BackupPayload = {
            version: '2.0',
            exportedAt: '2024-01-15T10:00:00Z',
            programs: [mockProgram, { ...mockProgram, id: 'prog-2' }],
            sessions: [mockSession],
            questionnaireResponses: [mockQuestionnaire],
            customTemplates: [mockTemplate as any],
            settings: mockSettings
        };

        const preview = getImportPreview(payload);
        expect(preview.programCount).toBe(2);
        expect(preview.sessionCount).toBe(1);
        expect(preview.questionnaireCount).toBe(1);
        expect(preview.customTemplateCount).toBe(1);
        expect(preview.version).toBe('2.0');
    });
});

// ============================================================================
// mergeImportedData TESTS
// ============================================================================

describe('mergeImportedData', () => {
    const existingData = {
        programs: [mockProgram],
        sessions: [mockSession],
        questionnaireResponses: [mockQuestionnaire],
        customTemplates: [],
        settings: mockSettings
    };

    it('should add new programs', () => {
        const newProgram = { ...mockProgram, id: 'prog-2', name: 'New Program' };
        const imported: BackupPayload = {
            version: '2.0',
            exportedAt: '2024-01-01T00:00:00Z',
            programs: [newProgram],
            sessions: [],
            questionnaireResponses: [],
            customTemplates: [],
            settings: mockSettings
        };

        const result = mergeImportedData(imported, existingData);
        expect(result.programs).toHaveLength(2);
        expect(result.stats.programsAdded).toBe(1);
    });

    it('should skip duplicate programs', () => {
        const imported: BackupPayload = {
            version: '2.0',
            exportedAt: '2024-01-01T00:00:00Z',
            programs: [mockProgram], // same ID
            sessions: [],
            questionnaireResponses: [],
            customTemplates: [],
            settings: mockSettings
        };

        const result = mergeImportedData(imported, existingData);
        expect(result.programs).toHaveLength(1);
        expect(result.stats.programsSkipped).toBe(1);
    });

    it('should add new sessions', () => {
        const newSession = { ...mockSession, id: 'session-2', date: '2024-01-16' };
        const imported: BackupPayload = {
            version: '2.0',
            exportedAt: '2024-01-01T00:00:00Z',
            programs: [],
            sessions: [newSession],
            questionnaireResponses: [],
            customTemplates: [],
            settings: mockSettings
        };

        const result = mergeImportedData(imported, existingData);
        expect(result.sessions).toHaveLength(2);
        expect(result.stats.sessionsAdded).toBe(1);
    });

    it('should use newer questionnaire for date conflict', () => {
        const newerQuestionnaire: QuestionnaireResponse = {
            date: '2024-01-15', // same date
            responses: { sleep: 5 },
            timestamp: '2024-01-15T10:00:00Z' // newer
        };
        const imported: BackupPayload = {
            version: '2.0',
            exportedAt: '2024-01-01T00:00:00Z',
            programs: [],
            sessions: [],
            questionnaireResponses: [newerQuestionnaire],
            customTemplates: [],
            settings: mockSettings
        };

        const result = mergeImportedData(imported, existingData);
        expect(result.questionnaireResponses).toHaveLength(1);
        expect(result.questionnaireResponses[0].responses.sleep).toBe(5);
        expect(result.stats.questionnairesAdded).toBe(1);
    });

    it('should skip older questionnaire for date conflict', () => {
        const olderQuestionnaire: QuestionnaireResponse = {
            date: '2024-01-15', // same date
            responses: { sleep: 2 },
            timestamp: '2024-01-15T06:00:00Z' // older
        };
        const imported: BackupPayload = {
            version: '2.0',
            exportedAt: '2024-01-01T00:00:00Z',
            programs: [],
            sessions: [],
            questionnaireResponses: [olderQuestionnaire],
            customTemplates: [],
            settings: mockSettings
        };

        const result = mergeImportedData(imported, existingData);
        expect(result.questionnaireResponses).toHaveLength(1);
        expect(result.questionnaireResponses[0].responses.sleep).toBe(4); // original
        expect(result.stats.questionnairesSkipped).toBe(1);
    });

    it('should preserve existing settings over empty imported settings', () => {
        const emptySettings: BackupSettings = {
            accentColor: 'mono',
            accentModifiers: {},
            templateOrder: [],
            modifiedDefaults: {},
            deletedDefaultIds: []
        };
        const imported: BackupPayload = {
            version: '2.0',
            exportedAt: '2024-01-01T00:00:00Z',
            programs: [],
            sessions: [],
            questionnaireResponses: [],
            customTemplates: [],
            settings: emptySettings
        };

        const result = mergeImportedData(imported, existingData);
        expect(result.settings.accentColor).toBe('purple'); // existing
    });
});

// ============================================================================
// replaceWithImportedData TESTS
// ============================================================================

describe('replaceWithImportedData', () => {
    it('should fully replace all data', () => {
        const newProgram = { ...mockProgram, id: 'new-prog', name: 'Replacement' };
        const payload: BackupPayload = {
            version: '2.0',
            exportedAt: '2024-01-01T00:00:00Z',
            programs: [newProgram],
            sessions: [],
            questionnaireResponses: [],
            customTemplates: [mockTemplate as any],
            settings: mockSettings
        };

        const result = replaceWithImportedData(payload);
        expect(result.programs).toHaveLength(1);
        expect(result.programs[0].id).toBe('new-prog');
        expect(result.sessions).toHaveLength(0);
        expect(result.customTemplates).toHaveLength(1);
    });
});

// ============================================================================
// ROUND-TRIP TESTS
// ============================================================================

describe('round-trip export/import', () => {
    it('should preserve data through export/import cycle', () => {
        // Create backup
        const originalPayload = createBackupPayload(
            [mockProgram],
            [mockSession],
            [mockQuestionnaire],
            [{ ...mockTemplate, generator: () => [] }],
            mockSettings
        );

        // Serialize and parse (simulating file save/load)
        const json = JSON.stringify(originalPayload);
        const parseResult = parseBackupFile(json);

        expect(parseResult.valid).toBe(true);
        expect(parseResult.payload?.programs).toHaveLength(1);
        expect(parseResult.payload?.sessions).toHaveLength(1);
        expect(parseResult.payload?.questionnaireResponses).toHaveLength(1);
        expect(parseResult.payload?.programs[0].id).toBe(mockProgram.id);
        expect(parseResult.payload?.sessions[0].id).toBe(mockSession.id);
    });
});
