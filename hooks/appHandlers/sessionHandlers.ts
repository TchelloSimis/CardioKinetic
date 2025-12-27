/**
 * Session Handlers
 * 
 * Handlers for session-related actions (save, edit, delete, live session)
 */

import type React from 'react';
import type { Session, SessionSetupParams, SessionResult } from '../../types';

/**
 * Create handler for saving a session
 */
export function createSaveSessionHandler(
    sessions: Session[],
    setSessions: React.Dispatch<React.SetStateAction<Session[]>>,
    setShowLogModal: React.Dispatch<React.SetStateAction<boolean>>,
    setEditingSession: React.Dispatch<React.SetStateAction<Session | null>>,
    setLogModalOrigin: React.Dispatch<React.SetStateAction<'dashboard' | 'session' | null>>,
    setPreservedSessionResult: React.Dispatch<React.SetStateAction<SessionResult | null>>
) {
    return (sessionData: Session) => {
        const existingSession = sessions.find(s => s.id === sessionData.id);

        if (existingSession) {
            setSessions(prev => prev.map(s => s.id === sessionData.id ? sessionData : s));
        } else {
            setSessions(prev => [...prev, sessionData]);
        }

        setShowLogModal(false);
        setEditingSession(null);
        setLogModalOrigin(null);
        setPreservedSessionResult(null);
    };
}

/**
 * Create handler for confirming session deletion
 */
export function createConfirmDeleteSessionHandler(
    sessionToDelete: string | null,
    setSessions: React.Dispatch<React.SetStateAction<Session[]>>,
    setSessionToDelete: React.Dispatch<React.SetStateAction<string | null>>
) {
    return () => {
        if (sessionToDelete) {
            setSessions(prev => prev.filter(s => s.id !== sessionToDelete));
            setSessionToDelete(null);
        }
    };
}

/**
 * Create handler for delete click
 */
export function createDeleteClickHandler(
    setSessionToDelete: React.Dispatch<React.SetStateAction<string | null>>
) {
    return (id: string) => {
        setSessionToDelete(id);
    };
}

/**
 * Create handler for editing a session
 */
export function createEditSessionHandler(
    setEditingSession: React.Dispatch<React.SetStateAction<Session | null>>,
    setLogModalOrigin: React.Dispatch<React.SetStateAction<'dashboard' | 'session' | null>>,
    setShowLogModal: React.Dispatch<React.SetStateAction<boolean>>
) {
    return (session: Session) => {
        setEditingSession(session);
        setLogModalOrigin('dashboard');
        setShowLogModal(true);
    };
}

/**
 * Create handler for deleting a session
 */
export function createDeleteSessionHandler(
    setSessions: React.Dispatch<React.SetStateAction<Session[]>>
) {
    return (sessionId: string) => {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
    };
}

/**
 * Create handler for starting a session (opens setup modal)
 */
export function createStartSessionClickHandler(
    setShowSessionSetup: React.Dispatch<React.SetStateAction<boolean>>
) {
    return () => {
        setShowSessionSetup(true);
    };
}

/**
 * Create handler for session setup completion
 */
export function createSessionSetupStartHandler(
    setSessionParams: React.Dispatch<React.SetStateAction<SessionSetupParams | null>>,
    setShowSessionSetup: React.Dispatch<React.SetStateAction<boolean>>,
    setShowLiveSession: React.Dispatch<React.SetStateAction<boolean>>
) {
    return (params: SessionSetupParams) => {
        setSessionParams(params);
        setShowSessionSetup(false);
        setShowLiveSession(true);
    };
}
