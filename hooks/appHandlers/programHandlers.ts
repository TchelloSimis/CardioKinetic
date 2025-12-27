/**
 * Program Handlers
 * 
 * Handlers for program-related actions (onboarding, finish, rename, delete, update, load preset)
 */

import type { ProgramRecord, ProgramTemplate } from '../../programTemplate';
import type { PlanWeek, Session } from '../../types';
import type { OnboardingData } from './types';
import { getLocalDateString } from '../../utils/dateUtils';

/**
 * Create handler for onboarding completion
 */
export function createOnboardingCompleteHandler(
    presets: ProgramTemplate[],
    setPrograms: React.Dispatch<React.SetStateAction<ProgramRecord[]>>
) {
    return (data: OnboardingData) => {
        const preset = presets.find(p => p.id === data.presetId);
        if (!preset) return;

        const weekCount = data.weekCount || preset.weekCount || 12;

        let plan: PlanWeek[];
        if (typeof preset.generator === 'function') {
            plan = preset.generator(data.basePower, weekCount);
        } else {
            console.warn(`Generator missing for preset ${preset.id}, generating fallback plan`);
            plan = generateFallbackPlan(data.basePower, weekCount);
        }

        const newProgram: ProgramRecord = {
            id: 'prog-' + Date.now(),
            presetId: data.presetId,
            name: preset.name,
            startDate: data.startDate,
            status: 'active',
            basePower: data.basePower,
            plan,
            fatigueModifiers: preset.fatigueModifiers
        };

        setPrograms(prev => prev
            .map(p => p.status === 'active'
                ? { ...p, status: 'completed' as const, endDate: getLocalDateString() }
                : p)
            .concat(newProgram)
        );
    };
}

/**
 * Create handler for finishing the active program
 */
export function createFinishProgramHandler(
    activeProgram: ProgramRecord | undefined,
    setPrograms: React.Dispatch<React.SetStateAction<ProgramRecord[]>>
) {
    return () => {
        if (activeProgram) {
            setPrograms(prev => prev.map(p =>
                p.id === activeProgram.id
                    ? { ...p, status: 'completed' as const, endDate: getLocalDateString() }
                    : p
            ));
        }
    };
}

/**
 * Create handler for renaming a program
 */
export function createRenameProgramHandler(
    setPrograms: React.Dispatch<React.SetStateAction<ProgramRecord[]>>
) {
    return (programId: string, newName: string) => {
        setPrograms(prev => prev.map(p =>
            p.id === programId ? { ...p, name: newName } : p
        ));
    };
}

/**
 * Create handler for deleting a program
 */
export function createDeleteProgramHandler(
    setPrograms: React.Dispatch<React.SetStateAction<ProgramRecord[]>>,
    setSessions: React.Dispatch<React.SetStateAction<Session[]>>
) {
    return (programId: string) => {
        setPrograms(prev => prev.filter(p => p.id !== programId));
        setSessions(prev => prev.filter(s => s.programId !== programId));
    };
}

/**
 * Create handler for updating plan week
 */
export function createUpdatePlanHandler(
    activeProgram: ProgramRecord | undefined,
    setPrograms: React.Dispatch<React.SetStateAction<ProgramRecord[]>>
) {
    return (week: number, field: keyof PlanWeek, value: any) => {
        if (!activeProgram) return;
        setPrograms(prev => prev.map(p => {
            if (p.id === activeProgram.id) {
                return {
                    ...p,
                    presetId: '',
                    plan: p.plan.map(pw => pw.week === week ? { ...pw, [field]: value } : pw)
                };
            }
            return p;
        }));
    };
}

/**
 * Create handler for loading a preset
 */
export function createLoadPresetHandler(
    activeProgram: ProgramRecord | undefined,
    presets: ProgramTemplate[],
    defaultBasePower: number,
    setPrograms: React.Dispatch<React.SetStateAction<ProgramRecord[]>>
) {
    return (presetId: string, basePwr?: number) => {
        if (!activeProgram) return;
        const preset = presets.find(p => p.id === presetId);
        const pwr = basePwr || defaultBasePower;
        if (preset) {
            setPrograms(prev => prev.map(p => {
                if (p.id === activeProgram.id) {
                    return {
                        ...p,
                        presetId: presetId,
                        plan: preset.generator(pwr)
                    };
                }
                return p;
            }));
        }
    };
}

// Helper function
function generateFallbackPlan(basePower: number, weekCount: number): PlanWeek[] {
    return Array.from({ length: weekCount }, (_, i) => ({
        week: i + 1,
        phaseName: i < weekCount / 3 ? 'Base' : i < (2 * weekCount) / 3 ? 'Build' : 'Peak',
        focus: 'Volume' as const,
        workRestRatio: '1:1',
        targetRPE: Math.min(5 + Math.floor(i / 4), 9),
        plannedPower: Math.round(basePower * (1 + i * 0.02)),
        description: `Week ${i + 1} of ${weekCount}`
    }));
}
