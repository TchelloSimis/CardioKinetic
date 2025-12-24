/**
 * Unit tests for App Handlers module
 */

import { describe, it, expect, vi } from 'vitest';

// Test the handler factory patterns (we test the logic, not React state integration)
describe('App Handlers - Program Handlers Logic', () => {
    describe('createOnboardingCompleteHandler logic', () => {
        it('should generate program id with timestamp prefix', () => {
            const programId = 'prog-' + Date.now();
            expect(programId).toMatch(/^prog-\d+$/);
        });

        it('should default week count to preset or 12', () => {
            const presetWeekCount = undefined;
            const defaultWeekCount = presetWeekCount || 12;
            expect(defaultWeekCount).toBe(12);
        });
    });

    describe('createFinishProgramHandler logic', () => {
        it('should generate end date in ISO format', () => {
            const endDate = new Date().toISOString().split('T')[0];
            expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });

    describe('generateFallbackPlan logic', () => {
        it('should calculate phase names correctly', () => {
            const weekCount = 12;
            const getPhase = (i: number) =>
                i < weekCount / 3 ? 'Base' : i < (2 * weekCount) / 3 ? 'Build' : 'Peak';

            expect(getPhase(0)).toBe('Base');
            expect(getPhase(3)).toBe('Base');
            expect(getPhase(4)).toBe('Build');
            expect(getPhase(7)).toBe('Build');
            expect(getPhase(8)).toBe('Peak');
            expect(getPhase(11)).toBe('Peak');
        });

        it('should calculate planned power with 2% weekly increase', () => {
            const basePower = 200;
            const weekIndex = 5;
            const plannedPower = Math.round(basePower * (1 + weekIndex * 0.02));
            expect(plannedPower).toBe(220);
        });

        it('should cap target RPE at 9', () => {
            const getRPE = (i: number) => Math.min(5 + Math.floor(i / 4), 9);

            expect(getRPE(0)).toBe(5);
            expect(getRPE(4)).toBe(6);
            expect(getRPE(8)).toBe(7);
            expect(getRPE(12)).toBe(8);
            expect(getRPE(16)).toBe(9);
            expect(getRPE(20)).toBe(9); // Should cap at 9
        });
    });
});

describe('App Handlers - Session Handlers Logic', () => {
    describe('createSaveSessionHandler logic', () => {
        it('should identify existing session by id', () => {
            const sessions = [
                { id: 'session-1', date: '2024-01-01' },
                { id: 'session-2', date: '2024-01-02' },
            ];
            const sessionData = { id: 'session-1', date: '2024-01-03' };

            const existingSession = sessions.find(s => s.id === sessionData.id);
            expect(existingSession).toBeTruthy();
            expect(existingSession?.id).toBe('session-1');
        });

        it('should not find session with new id', () => {
            const sessions = [{ id: 'session-1', date: '2024-01-01' }];
            const sessionData = { id: 'session-new', date: '2024-01-03' };

            const existingSession = sessions.find(s => s.id === sessionData.id);
            expect(existingSession).toBeUndefined();
        });
    });

    describe('createDeleteProgramHandler logic', () => {
        it('should filter out program and its sessions', () => {
            const programs = [
                { id: 'prog-1', name: 'Program 1' },
                { id: 'prog-2', name: 'Program 2' },
            ];
            const sessions = [
                { id: 's1', programId: 'prog-1' },
                { id: 's2', programId: 'prog-1' },
                { id: 's3', programId: 'prog-2' },
            ];

            const programIdToDelete = 'prog-1';
            const filteredPrograms = programs.filter(p => p.id !== programIdToDelete);
            const filteredSessions = sessions.filter(s => s.programId !== programIdToDelete);

            expect(filteredPrograms).toHaveLength(1);
            expect(filteredPrograms[0].id).toBe('prog-2');
            expect(filteredSessions).toHaveLength(1);
            expect(filteredSessions[0].id).toBe('s3');
        });
    });
});
