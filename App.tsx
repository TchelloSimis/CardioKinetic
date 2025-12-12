import React, { useState, useMemo, useRef, useEffect } from 'react';
import { LayoutDashboard, List, BarChart2, LineChart, Plus, Settings, Play } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import SessionLog from './components/SessionLog';
import Chart from './components/Chart';
import PlanTable from './components/PlanTable';
import ProgramTab, { ProgramCategory } from './components/ProgramTab';
import Onboarding from './components/Onboarding';
import LoadingScreen from './components/LoadingScreen';
import SettingsTab, { SettingsCategory } from './components/SettingsTab';
import DashboardTab from './components/DashboardTab';
import DeleteConfirmModal from './components/modals/DeleteConfirmModal';
import SessionSetupModal from './components/modals/SessionSetupModal';
import LiveSessionGuide from './components/LiveSessionGuide';
import { Session, PlanWeek, ReadinessState, ProgramPreset, ProgramRecord, SessionSetupParams, SessionResult } from './types';
import { DEFAULT_PRESETS, ACCENT_COLORS, Tab } from './presets';
import { useAppState, PRESETS } from './hooks/useAppState';
import { useTheme } from './hooks/useTheme';
import {
    generatePlanFromTemplate,
    applyFatigueModifiers
} from './utils/templateUtils';
import {
    calculateSessionLoad,
    calculateRecentAveragePower,
    getCurrentMetrics,
    calculateFatigueScore,
    calculateReadinessScore
} from './utils/metricsUtils';
import { useMetrics } from './hooks/useMetrics';
import { requestNotificationPermission, isAndroid as isAndroidPlatform } from './utils/foregroundService';

const App: React.FC = () => {
    // Use extracted hooks
    const appState = useAppState();
    const {
        programs, setPrograms,
        sessions, setSessions,
        isLoading, loadingStatus, initError,
        customTemplates, setCustomTemplates,
        modifiedDefaults, setModifiedDefaults,
        deletedDefaultIds, setDeletedDefaultIds,
        templateOrder, setTemplateOrder,
        templateListExpanded, setTemplateListExpanded,
        editingTemplateId, setEditingTemplateId,
        editingTemplateName, setEditingTemplateName,
        accentColor, setAccentColor,
        activePresets, activeProgram,
        isDefaultPreset, isDefaultModified, moveTemplate,
        accentModifiers, setAccentModifiers,
    } = appState;

    const theme = useTheme(accentColor, accentModifiers);
    const {
        isDarkMode,
        themePreference, setThemePreference,
        materialYouColor, isAndroid,
        currentAccent, accentValue, accentAltValue,
    } = theme;

    // UI state
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');
    const [showLogModal, setShowLogModal] = useState(false);
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
    const [sampleWeeks, setSampleWeeks] = useState(12);
    const [autoUpdateSimDate, setAutoUpdateSimDate] = useState(false);
    const [simulatedCurrentDate, setSimulatedCurrentDate] = useState<string>(new Date().toISOString().split('T')[0]);


    // Live Session Guide state
    const [showSessionSetup, setShowSessionSetup] = useState(false);
    const [showLiveSession, setShowLiveSession] = useState(false);
    const [sessionParams, setSessionParams] = useState<SessionSetupParams | null>(null);
    const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);
    const [liveSessionBackPress, setLiveSessionBackPress] = useState(0); // Counter to trigger back in LiveSessionGuide

    // Tab subcategory state (lifted from child components for back button handling)
    const [settingsCategory, setSettingsCategory] = useState<SettingsCategory>('main');
    const [programCategory, setProgramCategory] = useState<ProgramCategory>('main');

    // Log modal origin tracking for back button navigation
    const [logModalOrigin, setLogModalOrigin] = useState<'dashboard' | 'session_complete' | null>(null);
    const [preservedSessionResult, setPreservedSessionResult] = useState<SessionResult | null>(null);

    // Derived state for backward compatibility with existing components
    const settings = useMemo(() => activeProgram ? {
        startDate: activeProgram.startDate,
        basePower: activeProgram.basePower,
        restRecoveryPercentage: 50
    } : { startDate: new Date().toISOString().split('T')[0], basePower: 150 }, [activeProgram]);

    const basePlan = useMemo(() => activeProgram ? activeProgram.plan : [], [activeProgram]);

    const getWeekNumber = (dateStr: string, startStr: string) => {
        const d = new Date(dateStr);
        const s = new Date(startStr);
        d.setHours(0, 0, 0, 0);
        s.setHours(0, 0, 0, 0);
        const diffTime = d.getTime() - s.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return 1;
        return Math.floor(diffDays / 7) + 1;
    };

    const programLength = basePlan.length || 12;

    const currentWeekNum = useMemo(() => {
        const w = getWeekNumber(simulatedCurrentDate, settings.startDate);
        return Math.max(1, Math.min(w, programLength));
    }, [simulatedCurrentDate, settings.startDate, programLength]);

    const adaptedPlan = useMemo(() => {
        let newPlan = basePlan.map(w => ({ ...w }));
        let accumulatedMultiplier = 1.0;
        for (let w = 1; w <= basePlan.length; w++) {
            if (newPlan[w - 1]) {
                newPlan[w - 1].plannedPower = Math.round(newPlan[w - 1].plannedPower * accumulatedMultiplier);
            }
            if (w < currentWeekNum) {
                const weekSessions = sessions.filter(s => getWeekNumber(s.date, settings.startDate) === w);
                if (weekSessions.length > 0) {
                    const avgRPE = weekSessions.reduce((acc, s) => acc + s.rpe, 0) / weekSessions.length;
                    const targetWeek = basePlan[w - 1];
                    if (targetWeek) {
                        const targetRPE = targetWeek.targetRPE;
                        if (avgRPE <= targetRPE - 2) {
                            accumulatedMultiplier += 0.05;
                        } else if (avgRPE >= targetRPE + 2) {
                            accumulatedMultiplier -= 0.05;
                        }
                    }
                }
            }
        }
        return newPlan;
    }, [basePlan, sessions, settings.startDate, currentWeekNum]);

    const currentWeekPlan = adaptedPlan.find(p => p.week === currentWeekNum) || adaptedPlan[adaptedPlan.length - 1];

    const metrics = useMetrics({
        sessions,
        simulatedDate: simulatedCurrentDate,
        startDate: settings.startDate,
        basePower: settings.basePower,
        currentWeekNum,
        programLength,
        currentWeekPlan,
        activeProgram
    });

    // Android back button handler
    useEffect(() => {
        const handleBackButton = () => {
            // Priority 1: Close any open modals first
            if (sessionToDelete) {
                setSessionToDelete(null);
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
        activeTab, settingsCategory, programCategory, logModalOrigin, preservedSessionResult
    ]);

    // Request notification permission on Android app startup (Android 13+ requires runtime permission)
    useEffect(() => {
        if (isAndroidPlatform()) {
            requestNotificationPermission().then(granted => {
                console.log('Notification permission:', granted ? 'granted' : 'denied');
            });
        }
    }, []);

    // Event handlers
    const handleOnboardingComplete = (data: { presetId: string, basePower: number, startDate: string, weekCount?: number }) => {
        const preset = PRESETS.find(p => p.id === data.presetId);
        if (!preset) return;

        const weekCount = data.weekCount || preset.weekCount || 12;

        let plan: PlanWeek[];
        if (typeof preset.generator === 'function') {
            plan = preset.generator(data.basePower, weekCount);
        } else {
            console.warn(`Generator missing for preset ${preset.id}, generating fallback plan`);
            plan = Array.from({ length: weekCount }, (_, i) => ({
                week: i + 1,
                phaseName: i < weekCount / 3 ? 'Base' : i < (2 * weekCount) / 3 ? 'Build' : 'Peak',
                focus: 'Volume' as const,
                workRestRatio: '1:1',
                targetRPE: Math.min(5 + Math.floor(i / 4), 9),
                plannedPower: Math.round(data.basePower * (1 + i * 0.02)),
                description: `Week ${i + 1} of ${weekCount}`
            }));
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

        setPrograms(prev => prev.map(p => p.status === 'active' ? { ...p, status: 'completed', endDate: new Date().toISOString().split('T')[0] } : p).concat(newProgram));
    };

    const handleFinishProgram = () => {
        if (activeProgram) {
            setPrograms(prev => prev.map(p => p.id === activeProgram.id ? { ...p, status: 'completed', endDate: new Date().toISOString().split('T')[0] } : p));
        }
    };

    const handleRenameProgram = (programId: string, newName: string) => {
        setPrograms(prev => prev.map(p => p.id === programId ? { ...p, name: newName } : p));
    };

    const handleDeleteProgram = (programId: string) => {
        setPrograms(prev => prev.filter(p => p.id !== programId));
        setSessions(prev => prev.filter(s => s.programId !== programId));
    };

    const handleDeleteSession = (sessionId: string) => {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
    };

    const handleSaveSession = (sessionData: Session) => {
        // Check if session already exists in the array by ID
        // (not just if editingSession is set, since guided sessions pre-fill editingSession with a new ID)
        const existingSession = sessions.find(s => s.id === sessionData.id);

        if (existingSession) {
            // Update existing session
            setSessions(prev => prev.map(s => s.id === sessionData.id ? sessionData : s));
        } else {
            // Add new session (either fresh log or from guided session completion)
            setSessions(prev => [...prev, sessionData]);
        }
        setShowLogModal(false);
        setEditingSession(null);
        // Clear back navigation state
        setLogModalOrigin(null);
        setPreservedSessionResult(null);
    };

    const confirmDeleteSession = () => {
        if (sessionToDelete) {
            setSessions(prev => prev.filter(s => s.id !== sessionToDelete));
            setSessionToDelete(null);
        }
    };

    const handleDeleteClick = (id: string) => {
        setSessionToDelete(id);
    };

    const handleEditSession = (session: Session) => {
        setEditingSession(session);
        setLogModalOrigin('dashboard');
        setShowLogModal(true);
    };

    const handleUpdatePlan = (week: number, field: keyof PlanWeek, value: any) => {
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

    const handleLoadPreset = (presetId: string, basePwr?: number) => {
        if (!activeProgram) return;
        const preset = PRESETS.find(p => p.id === presetId);
        const pwr = basePwr || settings.basePower;
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

    const generateSampleData = () => {
        const newSessions: Session[] = [];
        const start = new Date(settings.startDate);
        let latestDate = start;

        for (let w = 1; w <= sampleWeeks; w++) {
            const targetWeek = adaptedPlan.find(p => p.week === w) || adaptedPlan[0];
            const targetPower = targetWeek.plannedPower;
            const targetRPE = targetWeek.targetRPE;

            const numSessions = Math.floor(Math.random() * 3) + 2;
            const daysOffsets = new Set<number>();
            while (daysOffsets.size < numSessions) {
                daysOffsets.add(Math.floor(Math.random() * 7));
            }

            daysOffsets.forEach(dayOffset => {
                const sessionDate = new Date(start);
                sessionDate.setDate(sessionDate.getDate() + (w - 1) * 7 + dayOffset);

                if (sessionDate > latestDate) latestDate = sessionDate;

                const variance = (Math.random() * 0.1) - 0.05;
                const power = Math.round(targetPower * (1 + variance));
                const rpe = Math.max(1, Math.min(10, Math.round(targetRPE + (Math.random() * 2 - 1))));

                const plannedDuration = targetWeek.targetDurationMinutes || 15;
                const durationVariance = (Math.random() * 0.1) - 0.05;
                const duration = Math.round(plannedDuration * (1 + durationVariance));

                newSessions.push({
                    id: Date.now() + Math.random().toString(),
                    date: sessionDate.toISOString().split('T')[0],
                    duration: duration,
                    power: power,
                    workPower: Math.round(power * 1.1),
                    restPower: Math.round(power * 0.9),
                    distance: parseFloat((power * 0.02).toFixed(2)),
                    rpe: rpe,
                    workRestRatio: targetWeek.workRestRatio,
                    notes: 'Generated Sample Data',
                    programId: activeProgram?.id
                });
            });
        }

        setSessions(prev => [...prev, ...newSessions]);

        if (autoUpdateSimDate) {
            setSimulatedCurrentDate(latestDate.toISOString().split('T')[0]);
        }
    };

    const jumpToLastSession = () => {
        if (sessions.length === 0) return;
        const latest = sessions.reduce((max, s) => s.date > max ? s.date : max, sessions[0].date);
        setSimulatedCurrentDate(latest);
    };

    // Live Session handlers
    const handleStartSessionClick = () => {
        setShowSessionSetup(true);
    };

    const handleSessionSetupStart = (params: SessionSetupParams) => {
        setSessionParams(params);
        setShowSessionSetup(false);
        setShowLiveSession(true);
    };

    const handleSessionComplete = (result: SessionResult) => {
        setSessionResult(result);
        setShowLiveSession(false);

        // Use weighted average power if adjustments were made
        const effectivePower = result.wasAdjusted && result.averagePower
            ? result.averagePower
            : result.targetPower;

        // Pre-fill session log with guided session data
        const restRecoveryPct = settings.restRecoveryPercentage || 50;
        const recoveryRatio = restRecoveryPct / 100;

        // Parse work:rest ratio to calculate proper work/rest power
        // IMPORTANT: Use ORIGINAL ratio (from session params) for power calculation
        // The actualWorkRestRatio is computed from time and may differ due to adjustments
        let suggestedWorkPower = effectivePower;
        let suggestedRestPower = Math.round(effectivePower * recoveryRatio);

        // Use ORIGINAL ratio for power calculation (this is the intended work:rest pattern)
        const powerCalcRatio = result.workRestRatio;
        // Use actual ratio for display (shows what really happened)
        const displayRatio = result.actualWorkRestRatio || result.workRestRatio;

        if (powerCalcRatio && powerCalcRatio !== 'steady' && powerCalcRatio !== '1:0') {
            const parts = powerCalcRatio.split(':').map(Number);
            if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
                const workPart = parts[0];
                const restPart = parts[1];
                const totalParts = workPart + restPart;

                // Calculate work power from average using the formula:
                // avgPower = (workPart * workPower + restPart * restPower) / totalParts
                // With restPower = workPower * recoveryRatio:
                // avgPower = workPower * (workPart + restPart * recoveryRatio) / totalParts
                // workPower = avgPower * totalParts / (workPart + restPart * recoveryRatio)
                suggestedWorkPower = Math.round((effectivePower * totalParts) / (workPart + restPart * recoveryRatio));
                suggestedRestPower = Math.round(suggestedWorkPower * recoveryRatio);
            }
        } else if (powerCalcRatio === 'steady' || powerCalcRatio === '1:0') {
            // Steady state - work power IS the average power
            suggestedWorkPower = effectivePower;
            suggestedRestPower = 0;
        }

        // Build notes with adjustment info
        let notes = result.wasCompleted
            ? `Guided session - ${result.intervalsCompleted}/${result.totalIntervals} intervals completed`
            : `Guided session (ended early) - ${result.intervalsCompleted}/${result.totalIntervals} intervals`;

        if (result.wasAdjusted && result.averagePower) {
            notes += ` | Avg power: ${result.averagePower}W (adjusted)`;
        }

        // Include actual ratio if it differs from target
        if (result.actualWorkRestRatio && result.actualWorkRestRatio !== result.workRestRatio) {
            notes += ` | Actual ratio: ${result.actualWorkRestRatio} (approx)`;
        }

        setEditingSession({
            id: Date.now().toString(),
            date: new Date().toISOString().split('T')[0],
            duration: result.actualDurationMinutes,
            power: effectivePower,
            workPower: suggestedWorkPower,
            restPower: suggestedRestPower,
            distance: 0,
            rpe: result.targetRPE,
            workRestRatio: displayRatio,
            weekNum: currentWeekNum,
            programId: activeProgram?.id,
            notes,
        } as Session);
        // Preserve result for back navigation to completion screen
        setPreservedSessionResult(result);
        setLogModalOrigin('session_complete');
        setShowLogModal(true);
        setSessionResult(null);
        setSessionParams(null);
    };



    // FAB visibility on scroll
    const [showFab, setShowFab] = useState(true);
    const lastScrollY = useRef(0);
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const currentScrollY = e.currentTarget.scrollTop;
        if (currentScrollY > lastScrollY.current && currentScrollY > 50) setShowFab(false);
        else setShowFab(true);
        lastScrollY.current = currentScrollY;
    };

    const handleUpdateSettings = (newSettings: any) => {
        if (!activeProgram) return;

        const currentSettings = {
            startDate: activeProgram.startDate,
            basePower: activeProgram.basePower,
            restRecoveryPercentage: 50
        };

        const updated = typeof newSettings === 'function' ? newSettings(currentSettings) : newSettings;

        setPrograms(prev => prev.map(p => {
            if (p.id === activeProgram.id) {
                return {
                    ...p,
                    startDate: updated.startDate,
                    basePower: updated.basePower,
                };
            }
            return p;
        }));
    };

    // Loading state
    if (isLoading) {
        return <LoadingScreen message={loadingStatus} />;
    }

    // Error state
    if (initError) {
        return (
            <div className="h-screen flex items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-8">
                <div className="max-w-md text-center">
                    <h2 className="text-2xl font-bold mb-4">Startup Error</h2>
                    <p className="mb-6">{initError}</p>
                    <button onClick={() => window.location.reload()} className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold">Retry</button>
                </div>
            </div>
        );
    }

    // Onboarding state
    if ((programs.length === 0 && !activeProgram) || (programs.length > 0 && !activeProgram)) {
        return (
            <Onboarding
                presets={PRESETS}
                onComplete={handleOnboardingComplete}
                onImportTemplate={(preset) => {
                    setCustomTemplates(prev => [...prev, preset]);
                }}
            />
        );
    }

    if (!activeProgram) {
        return (
            <div className="h-screen flex items-center justify-center bg-neutral-100 dark:bg-black">
                <div className="text-center">
                    <h2 className="text-xl font-bold mb-2">No Active Program</h2>
                    <p className="text-neutral-500 mb-4">Please create a new program to continue.</p>
                    <button onClick={() => setPrograms([])} className="px-6 py-3 bg-neutral-900 text-white rounded-xl">Reset App</button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col md:flex-row bg-neutral-100 dark:bg-black text-neutral-900 dark:text-neutral-100 overflow-hidden font-sans selection:bg-neutral-200 dark:selection:bg-neutral-800">
            {/* Desktop Sidebar */}
            <nav className="hidden md:flex w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex-col justify-between z-50">
                <div className="p-8">
                    <h1 className="text-2xl font-bold tracking-tighter text-neutral-900 dark:text-white">CK.</h1>
                    <p className="text-xs text-neutral-400 mt-1 tracking-widest uppercase">CardioKinetic</p>
                </div>
                <div className="flex flex-col p-4 gap-2">
                    {[{ id: 'dashboard', label: 'Overview', icon: LayoutDashboard }, { id: 'chart', label: 'Analytics', icon: BarChart2 }, { id: 'plan', label: 'Program', icon: List }].map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}>
                            <tab.icon size={18} strokeWidth={1.5} />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                    <button onClick={() => { setEditingSession(null); setLogModalOrigin('dashboard'); setShowLogModal(true); }} className="mt-4 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold bg-neutral-900 dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity">
                        <Plus size={18} strokeWidth={2.5} /> <span>Log Session</span>
                    </button>
                </div>
            </nav>

            {/* Mobile Bottom Nav */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 z-50 flex justify-around items-center pb-4 shadow-lg">
                {[{ id: 'dashboard', label: 'Home', icon: LayoutDashboard }, { id: 'chart', label: 'Analytics', icon: LineChart }, { id: 'plan', label: 'Program', icon: List }, { id: 'settings', label: 'Settings', icon: Settings }].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as Tab)} className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all focus:outline-none ${activeTab === tab.id ? 'scale-105' : 'text-neutral-400 scale-100'}`}>
                        <tab.icon size={24} strokeWidth={2.5} style={activeTab === tab.id ? { color: isDarkMode ? currentAccent.displayDark : currentAccent.displayLight } : undefined} />
                        <span className="text-[10px] font-semibold" style={activeTab === tab.id ? { color: isDarkMode ? currentAccent.displayDark : currentAccent.displayLight } : undefined}>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Mobile FAB - Start Session & Log buttons */}
            {!showLogModal && (
                <div className={`md:hidden fixed bottom-24 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-in-out ${showFab && activeTab === 'dashboard' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
                    <div className="flex items-center justify-center gap-3">
                        <button
                            onClick={handleStartSessionClick}
                            className="backdrop-blur-2xl backdrop-saturate-150 text-white border border-white/30 rounded-2xl py-3 px-6 shadow-2xl flex items-center gap-2 hover:scale-105 transition-transform active:scale-95"
                            style={{ backgroundColor: `${isDarkMode ? currentAccent.displayDark : currentAccent.displayLight}cc` }}
                        >
                            <Play size={18} strokeWidth={2.5} fill="currentColor" /> <span className="text-xs font-bold uppercase tracking-widest">Start</span>
                        </button>
                        <button
                            onClick={() => { setEditingSession(null); setLogModalOrigin('dashboard'); setShowLogModal(true); }}
                            className="backdrop-blur-2xl backdrop-saturate-150 text-white border border-white/30 rounded-2xl py-3 px-6 shadow-2xl flex items-center gap-2 hover:scale-105 transition-transform active:scale-95"
                            style={{ backgroundColor: `${isDarkMode ? currentAccent.displayDark : currentAccent.displayLight}cc` }}
                        >
                            <Plus size={20} strokeWidth={3} /> <span className="text-xs font-bold uppercase tracking-widest">Log</span>
                        </button>
                    </div>
                </div>
            )}


            {/* Session Log Modal */}
            {showLogModal && (
                <div className="fixed inset-0 z-[100] bg-white dark:bg-black flex flex-col animate-in slide-in-from-bottom-10 duration-300">
                    <div className="flex-1 overflow-auto p-6">
                        <SessionLog onAddSession={handleSaveSession} onCancel={() => { setShowLogModal(false); setEditingSession(null); }} currentWeekPlan={currentWeekPlan} allPlans={adaptedPlan} startDate={settings.startDate} currentWeekNum={currentWeekNum} restRecoveryPercentage={settings.restRecoveryPercentage} initialData={editingSession || undefined} />
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {sessionToDelete && (
                <DeleteConfirmModal
                    onClose={() => setSessionToDelete(null)}
                    onConfirm={confirmDeleteSession}
                />
            )}

            {/* Session Setup Modal */}
            <SessionSetupModal
                isOpen={showSessionSetup}
                onClose={() => setShowSessionSetup(false)}
                onStart={handleSessionSetupStart}
                currentWeekPlan={metrics.modifiedWeekPlan || currentWeekPlan}
                initialParams={sessionParams}
                accentColor={accentValue}
                accentAltColor={accentAltValue}
                isDarkMode={isDarkMode}
            />

            {/* Live Session Guide */}
            <LiveSessionGuide
                isOpen={showLiveSession}
                params={sessionParams}
                onClose={() => {
                    setShowLiveSession(false);
                    setSessionParams(null);
                }}
                onBackToSetup={() => {
                    setShowLiveSession(false);
                    setShowSessionSetup(true);
                }}
                onComplete={handleSessionComplete}
                accentColor={accentValue}
                backButtonPressed={liveSessionBackPress}
            />

            {/* Main Content */}
            <main className="flex-1 relative overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto scroll-smooth" onScroll={handleScroll}>
                    <div className="p-4 md:p-12">
                        <div className={`max-w-5xl mx-auto pb-20 md:pb-12 ${activeTab === 'chart' ? 'h-full' : 'min-h-full'}`}>

                            {/* DASHBOARD */}
                            <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
                                <DashboardTab
                                    currentWeekNum={currentWeekNum}
                                    currentWeekPlan={metrics.modifiedWeekPlan || currentWeekPlan}
                                    metrics={metrics}
                                    programs={programs}
                                    sessions={sessions}
                                    isDarkMode={isDarkMode}
                                    currentAccent={currentAccent}
                                    onEditSession={handleEditSession}
                                    onDeleteSession={handleDeleteSession}
                                    onRenameProgram={handleRenameProgram}
                                    onDeleteProgram={handleDeleteProgram}
                                    onStartSession={handleStartSessionClick}
                                />
                            </div>

                            {activeTab === 'chart' && (
                                <div className="h-full animate-in fade-in duration-500">
                                    <Chart sessions={sessions} programs={programs} isDarkMode={isDarkMode} accentColor={accentValue} accentAltColor={accentAltValue} />
                                </div>
                            )}
                            {activeTab === 'plan' && (
                                <div className="h-full animate-in fade-in duration-500">
                                    <ProgramTab
                                        activeProgram={activeProgram}
                                        plan={adaptedPlan}
                                        basePlan={basePlan}
                                        settings={settings}
                                        onUpdateSettings={handleUpdateSettings}
                                        onUpdatePlan={handleUpdatePlan}
                                        onLoadPreset={handleLoadPreset}
                                        onFinishProgram={handleFinishProgram}
                                        activePresets={activePresets}
                                        customTemplates={customTemplates}
                                        setCustomTemplates={setCustomTemplates}
                                        modifiedDefaults={modifiedDefaults}
                                        setModifiedDefaults={setModifiedDefaults}
                                        deletedDefaultIds={deletedDefaultIds}
                                        setDeletedDefaultIds={setDeletedDefaultIds}
                                        isDefaultPreset={isDefaultPreset}
                                        PRESETS={PRESETS}
                                        activeCategory={programCategory}
                                        setActiveCategory={setProgramCategory}
                                    />
                                </div>
                            )}
                            {activeTab === 'settings' && (
                                <SettingsTab
                                    themePreference={themePreference}
                                    setThemePreference={setThemePreference}
                                    isDarkMode={isDarkMode}
                                    accentColor={accentColor}
                                    setAccentColor={setAccentColor}
                                    accentModifiers={accentModifiers}
                                    setAccentModifiers={setAccentModifiers}
                                    ACCENT_COLORS={ACCENT_COLORS}
                                    isAndroid={isAndroid}
                                    materialYouColor={materialYouColor}
                                    activeProgram={activeProgram}
                                    programs={programs}
                                    sessions={sessions}
                                    setPrograms={setPrograms}
                                    setSessions={setSessions}
                                    handleFinishProgram={handleFinishProgram}
                                    setActiveTab={setActiveTab}
                                    activePresets={activePresets}
                                    customTemplates={customTemplates}
                                    setCustomTemplates={setCustomTemplates}
                                    modifiedDefaults={modifiedDefaults}
                                    setModifiedDefaults={setModifiedDefaults}
                                    deletedDefaultIds={deletedDefaultIds}
                                    setDeletedDefaultIds={setDeletedDefaultIds}
                                    templateListExpanded={templateListExpanded}
                                    setTemplateListExpanded={setTemplateListExpanded}
                                    editingTemplateId={editingTemplateId}
                                    setEditingTemplateId={setEditingTemplateId}
                                    editingTemplateName={editingTemplateName}
                                    setEditingTemplateName={setEditingTemplateName}
                                    isDefaultPreset={isDefaultPreset}
                                    isDefaultModified={isDefaultModified}
                                    moveTemplate={moveTemplate}
                                    PRESETS={PRESETS}
                                    activeCategory={settingsCategory}
                                    setActiveCategory={setSettingsCategory}
                                    sampleWeeks={sampleWeeks}
                                    setSampleWeeks={setSampleWeeks}
                                    programLength={programLength}
                                    simulatedCurrentDate={simulatedCurrentDate}
                                    setSimulatedCurrentDate={setSimulatedCurrentDate}
                                    autoUpdateSimDate={autoUpdateSimDate}
                                    setAutoUpdateSimDate={setAutoUpdateSimDate}
                                    jumpToLastSession={jumpToLastSession}
                                    generateSampleData={generateSampleData}
                                    clearSessions={() => setSessions([])}
                                    colorBrightness={100} // Mocked for backward compat if needed, or removed if SettingsTab updated
                                    setColorBrightness={() => { }}
                                    colorSaturation={100}
                                    setColorSaturation={() => { }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;
