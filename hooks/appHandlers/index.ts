/**
 * App Handlers Module - Index
 * 
 * Re-exports all handler factories for App.tsx
 */

// Types
export * from './types';

// Program handlers
export {
    createOnboardingCompleteHandler,
    createFinishProgramHandler,
    createRenameProgramHandler,
    createDeleteProgramHandler,
    createUpdatePlanHandler,
    createLoadPresetHandler,
} from './programHandlers';

// Session handlers
export {
    createSaveSessionHandler,
    createConfirmDeleteSessionHandler,
    createDeleteClickHandler,
    createEditSessionHandler,
    createDeleteSessionHandler,
    createStartSessionClickHandler,
    createSessionSetupStartHandler,
} from './sessionHandlers';
