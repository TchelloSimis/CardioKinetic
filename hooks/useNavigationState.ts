/**
 * Navigation State Hook
 * 
 * Manages all UI navigation state including:
 * - Active tab selection
 * - Modal visibility states
 * - Tab subcategory navigation
 * - Android back button handling
 */

import React, { useState, useEffect, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Tab } from '../presets';
import { SettingsCategory } from '../components/SettingsTab';
import { ProgramCategory } from '../components/ProgramTab';
import { Session, SessionSetupParams, SessionResult, QuestionnaireResponse } from '../types';

export interface NavigationState {
    // Tab navigation
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;

    // Settings/Program subcategories
    settingsCategory: SettingsCategory;
    setSettingsCategory: (category: SettingsCategory) => void;
    programCategory: ProgramCategory;
    setProgramCategory: (category: ProgramCategory) => void;

    // Session Log Modal
    showLogModal: boolean;
    setShowLogModal: (show: boolean) => void;
    editingSession: Session | null;
    setEditingSession: (session: Session | null) => void;
    logModalOrigin: 'dashboard' | 'session_complete' | null;
    setLogModalOrigin: (origin: 'dashboard' | 'session_complete' | null) => void;
    preservedSessionResult: SessionResult | null;
    setPreservedSessionResult: (result: SessionResult | null) => void;

    // Delete confirmation
    sessionToDelete: string | null;
    setSessionToDelete: (id: string | null) => void;

    // Live Session
    showSessionSetup: boolean;
    setShowSessionSetup: (show: boolean) => void;
    showLiveSession: boolean;
    setShowLiveSession: (show: boolean) => void;
    sessionParams: SessionSetupParams | null;
    setSessionParams: (params: SessionSetupParams | null) => void;
    sessionResult: SessionResult | null;
    setSessionResult: (result: SessionResult | null) => void;
    liveSessionBackPress: number;
    triggerLiveSessionBack: () => void;

    // Questionnaire
    showQuestionnaireModal: boolean;
    setShowQuestionnaireModal: (show: boolean) => void;
    showQuestionnaireHistory: boolean;
    setShowQuestionnaireHistory: (show: boolean) => void;
    editingQuestionnaireResponse: QuestionnaireResponse | null;
    setEditingQuestionnaireResponse: (response: QuestionnaireResponse | null) => void;

    // Insights
    showInsightsPage: boolean;
    setShowInsightsPage: (show: boolean) => void;

    // FAB visibility
    showFab: boolean;
    handleScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}

export function useNavigationState(): NavigationState {
    // Tab navigation
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');

    // Settings/Program subcategories
    const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>('main');
    const [programCategory, setProgramCategory] = useState<ProgramCategory>('main');

    // Session Log Modal
    const [showLogModal, setShowLogModal] = useState(false);
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [logModalOrigin, setLogModalOrigin] = useState<'dashboard' | 'session_complete' | null>(null);
    const [preservedSessionResult, setPreservedSessionResult] = useState<SessionResult | null>(null);

    // Delete confirmation
    const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

    // Live Session
    const [showSessionSetup, setShowSessionSetup] = useState(false);
    const [showLiveSession, setShowLiveSession] = useState(false);
    const [sessionParams, setSessionParams] = useState<SessionSetupParams | null>(null);
    const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
    const [liveSessionBackPress, setLiveSessionBackPress] = useState(0);

    // Questionnaire
    const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false);
    const [showQuestionnaireHistory, setShowQuestionnaireHistory] = useState(false);
    const [editingQuestionnaireResponse, setEditingQuestionnaireResponse] = useState<QuestionnaireResponse | null>(null);

    // Insights
    const [showInsightsPage, setShowInsightsPage] = useState(false);

    // FAB visibility
    const [showFab, setShowFab] = useState(true);
    const lastScrollYRef = { current: 0 };

    const triggerLiveSessionBack = useCallback(() => {
        setLiveSessionBackPress(prev => prev + 1);
    }, []);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const currentScrollY = e.currentTarget.scrollTop;
        if (currentScrollY > lastScrollYRef.current && currentScrollY > 50) {
            setShowFab(false);
        } else {
            setShowFab(true);
        }
        lastScrollYRef.current = currentScrollY;
    }, []);

    // Android back button handler
    useEffect(() => {
        const handleBackButton = () => {
            // Priority 1: Close any open modals first
            if (sessionToDelete) {
                setSessionToDelete(null);
                return;
            }

            // Priority 1.5: Close Insights Page (full-screen overlay)
            if (showInsightsPage) {
                setShowInsightsPage(false);
                return;
            }

            // Priority 1.6: Close Readiness Questionnaire Modal
            if (showQuestionnaireModal) {
                setShowQuestionnaireModal(false);
                setEditingQuestionnaireResponse(null);
                return;
            }

            // Priority 1.7: Close Questionnaire History
            if (showQuestionnaireHistory) {
                setShowQuestionnaireHistory(false);
                return;
            }

            // Priority 2: Session Log Modal - return based on origin
            if (showLogModal) {
                if (logModalOrigin === 'session_complete' && preservedSessionResult) {
                    // Case 3: Return to session complete screen with charts preserved
                    setShowLogModal(false);
                    setEditingSession(null);
                    setSessionResult(preservedSessionResult);
                } else {
                    // Case 4: Return to dashboard
                    setShowLogModal(false);
                    setEditingSession(null);
                    setLogModalOrigin(null);
                }
                return;
            }

            // Priority 3: Live Session - delegate to LiveSessionGuide for confirmation handling
            if (showLiveSession) {
                // Increment counter to trigger handleClose in LiveSessionGuide
                // This ensures proper confirmation logic and session cleanup
                setLiveSessionBackPress(prev => prev + 1);
                return;
            }

            // Priority 4: Session Setup - return to dashboard (Case 1)
            if (showSessionSetup) {
                setShowSessionSetup(false);
                return;
            }

            // Priority 5: Tab subcategories - return to main
            if (activeTab === 'settings' && settingsCategory !== 'main') {
                // Case 7: Return to settings main
                setSettingsCategory('main');
                return;
            }

            if (activeTab === 'plan' && programCategory !== 'main') {
                // Case 6: Return to program main
                setProgramCategory('main');
                return;
            }

            // Priority 6: Non-home tabs - return to dashboard (Case 5)
            if (activeTab !== 'dashboard') {
                setActiveTab('dashboard');
                return;
            }

            // Already at home dashboard - let system handle (minimize app)
            CapacitorApp.minimizeApp();
        };

        // Listen for back button events
        const listener = CapacitorApp.addListener('backButton', handleBackButton);

        return () => {
            listener.then(handle => handle.remove());
        };
    }, [
        sessionToDelete, showLogModal, showLiveSession, showSessionSetup,
        activeTab, settingsCategory, programCategory, logModalOrigin, preservedSessionResult,
        showInsightsPage, showQuestionnaireModal, showQuestionnaireHistory
    ]);

    return {
        // Tab navigation
        activeTab,
        setActiveTab,

        // Settings/Program subcategories
        settingsCategory,
        setSettingsCategory,
        programCategory,
        setProgramCategory,

        // Session Log Modal
        showLogModal,
        setShowLogModal,
        editingSession,
        setEditingSession,
        logModalOrigin,
        setLogModalOrigin,
        preservedSessionResult,
        setPreservedSessionResult,

        // Delete confirmation
        sessionToDelete,
        setSessionToDelete,

        // Live Session
        showSessionSetup,
        setShowSessionSetup,
        showLiveSession,
        setShowLiveSession,
        sessionParams,
        setSessionParams,
        sessionResult,
        setSessionResult,
        liveSessionBackPress,
        triggerLiveSessionBack,

        // Questionnaire
        showQuestionnaireModal,
        setShowQuestionnaireModal,
        showQuestionnaireHistory,
        setShowQuestionnaireHistory,
        editingQuestionnaireResponse,
        setEditingQuestionnaireResponse,

        // Insights
        showInsightsPage,
        setShowInsightsPage,

        // FAB visibility
        showFab,
        handleScroll,
    };
}
