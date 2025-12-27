/**
 * App Handler Types
 * 
 * Type definitions for App.tsx event handlers
 */

import type React from 'react';
import type { Session, PlanWeek, SessionSetupParams, SessionResult, ProgramRecord } from '../../types';

// ============================================================================
// HANDLER RETURN TYPES
// ============================================================================

export interface AppHandlers {
    // Program handlers
    handleOnboardingComplete: (data: OnboardingData) => void;
    handleFinishProgram: () => void;
    handleRenameProgram: (programId: string, newName: string) => void;
    handleDeleteProgram: (programId: string) => void;
    handleUpdatePlan: (week: number, field: keyof PlanWeek, value: any) => void;
    handleLoadPreset: (presetId: string, basePwr?: number) => void;

    // Session handlers
    handleDeleteSession: (sessionId: string) => void;
    handleSaveSession: (sessionData: Session) => void;
    handleEditSession: (session: Session) => void;
    confirmDeleteSession: () => void;
    handleDeleteClick: (id: string) => void;

    // Live session handlers
    handleStartSessionClick: () => void;
    handleSessionSetupStart: (params: SessionSetupParams) => void;
    handleSessionComplete: (result: SessionResult) => void;

    // Dev tools handlers
    generateSampleData: () => void;
    jumpToLastSession: () => void;

    // Settings handler
    handleUpdateSettings: (newSettings: any) => void;
}

// ============================================================================
// DATA TYPES
// ============================================================================

export interface OnboardingData {
    presetId: string;
    basePower: number;
    startDate: string;
    weekCount?: number;
}

export interface SessionCompleteData {
    result: SessionResult;
    programId?: string;
    currentWeek?: number;
}

// ============================================================================
// STATE SETTERS INTERFACE
// ============================================================================

export interface AppStateSetters {
    setPrograms: React.Dispatch<React.SetStateAction<ProgramRecord[]>>;
    setSessions: React.Dispatch<React.SetStateAction<Session[]>>;
    setShowLogModal: React.Dispatch<React.SetStateAction<boolean>>;
    setEditingSession: React.Dispatch<React.SetStateAction<Session | null>>;
    setLogModalOrigin: React.Dispatch<React.SetStateAction<'dashboard' | 'session' | null>>;
    setPreservedSessionResult: React.Dispatch<React.SetStateAction<SessionResult | null>>;
    setSessionToDelete: React.Dispatch<React.SetStateAction<string | null>>;
    setShowSessionSetup: React.Dispatch<React.SetStateAction<boolean>>;
    setShowLiveSession: React.Dispatch<React.SetStateAction<boolean>>;
    setSessionParams: React.Dispatch<React.SetStateAction<SessionSetupParams | null>>;
    setSimulatedCurrentDate: React.Dispatch<React.SetStateAction<string>>;
}
