import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Database, Trash2, Calendar, CheckSquare, Bell, Info, Smartphone, LineChart, Play, Zap } from 'lucide-react';
import { ProgramPreset } from '../../types';
import { runMonteCarloSimulation, SimulationResult } from '../../utils/simulationEngine';
import SimulationCharts from './SimulationCharts';
import { AccentColor, AccentColorConfig, AccentModifierState, ColorRole, ThemeVariant } from '../../presets';
import { getMaterialYouAccentColors, hexToHsl, hslToHex } from '../../utils/colorUtils';
import { ModifierTestingPanel } from '../devtools/ModifierTestingPanel';
import {
    isNativePlatform,
    getPlatformName,
    requestNotificationPermissions,
    checkNotificationPermissions,
    registerNotificationActions,
    sendRegularNotification,
    sendPersistentNotification,
    cancelAllTestNotifications,
    setupNotificationActionListener,
    getAppDiagnostics,
    NotificationLogEntry,
} from '../../utils/NotificationService';
import {
    startSessionNotification,
    stopSessionNotification,
    isAndroid as isForegroundAndroid,
} from '../../utils/foregroundService';

export interface DevToolsSettingsProps {
    sampleWeeks: number;
    setSampleWeeks: (weeks: number) => void;
    programLength: number;
    simulatedCurrentDate: string;
    setSimulatedCurrentDate: (date: string) => void;
    autoUpdateSimDate: boolean;
    setAutoUpdateSimDate: (auto: boolean) => void;
    jumpToLastSession: () => void;
    generateSampleData: () => void;
    clearSessions: () => void;
    accentColor: AccentColor;
    accentModifiers: AccentModifierState;
    setAccentModifiers: React.Dispatch<React.SetStateAction<AccentModifierState>>;
    ACCENT_COLORS: AccentColorConfig[];
    materialYouColor: string | null;
    activePresets: ProgramPreset[];
    isDarkMode: boolean;
}

const DevToolsSettings: React.FC<DevToolsSettingsProps> = ({
    sampleWeeks,
    setSampleWeeks,
    programLength,
    simulatedCurrentDate,
    setSimulatedCurrentDate,
    autoUpdateSimDate,
    setAutoUpdateSimDate,
    jumpToLastSession,
    generateSampleData,
    clearSessions,
    accentColor,
    accentModifiers,
    setAccentModifiers,
    ACCENT_COLORS,
    materialYouColor,
    activePresets,
    isDarkMode,
}) => {
    // Notification diagnostics state
    const [notificationPermission, setNotificationPermission] = useState<string>('unknown');
    const [notificationLogs, setNotificationLogs] = useState<NotificationLogEntry[]>([]);
    const [isLoadingPermission, setIsLoadingPermission] = useState(false);

    // Program simulation state
    const [selectedPresetId, setSelectedPresetId] = useState<string>(activePresets[0]?.id || '');
    const [simBasePower, setSimBasePower] = useState<number>(150);
    const [simWeekCount, setSimWeekCount] = useState<number>(12);
    const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
    const [isSimulating, setIsSimulating] = useState(false);

    // Get selected preset
    const selectedPreset = useMemo(() =>
        activePresets.find(p => p.id === selectedPresetId) || activePresets[0],
        [activePresets, selectedPresetId]
    );

    // Get week options for selected preset
    const weekOptions = useMemo(() => {
        if (!selectedPreset) return { min: 4, max: 24, options: null, isFixed: false };

        // Check for explicit weekOptions array
        if (selectedPreset.weekOptions && selectedPreset.weekOptions.length > 0) {
            const isFixed = selectedPreset.weekOptions.length === 1;
            return {
                min: Math.min(...selectedPreset.weekOptions),
                max: Math.max(...selectedPreset.weekOptions),
                options: selectedPreset.weekOptions,
                isFixed
            };
        }

        // Check for fixed weekCount (no range specified)
        if (selectedPreset.weekCount && !selectedPreset.minWeeks && !selectedPreset.maxWeeks) {
            return {
                min: selectedPreset.weekCount,
                max: selectedPreset.weekCount,
                options: [selectedPreset.weekCount],
                isFixed: true
            };
        }

        // Variable range
        return {
            min: selectedPreset.minWeeks || 4,
            max: selectedPreset.maxWeeks || 24,
            options: null,
            isFixed: false
        };
    }, [selectedPreset]);

    // Sync simWeekCount when preset changes
    useEffect(() => {
        if (weekOptions.isFixed && weekOptions.options) {
            setSimWeekCount(weekOptions.options[0]);
        } else if (simWeekCount < weekOptions.min || simWeekCount > weekOptions.max) {
            // Clamp to valid range
            setSimWeekCount(Math.max(weekOptions.min, Math.min(weekOptions.max, simWeekCount)));
        }
        setSimulationResult(null);
    }, [selectedPresetId, weekOptions]);

    // Run simulation handler
    const handleRunSimulation = useCallback(() => {
        if (!selectedPreset) return;
        setIsSimulating(true);
        // Use setTimeout to allow UI to update before heavy computation
        setTimeout(() => {
            const result = runMonteCarloSimulation({
                preset: selectedPreset,
                basePower: simBasePower,
                weekCount: simWeekCount,
                iterations: 100000
            });
            setSimulationResult(result);
            setIsSimulating(false);
        }, 50);
    }, [selectedPreset, simBasePower, simWeekCount]);

    // Add log entry helper
    const addLog = useCallback((type: NotificationLogEntry['type'], message: string, data?: Record<string, unknown>) => {
        setNotificationLogs(prev => [
            { timestamp: new Date(), type, message, data },
            ...prev.slice(0, 19), // Keep last 20 entries
        ]);
    }, []);

    // Check permissions and setup listeners on mount
    useEffect(() => {
        const init = async () => {
            if (isNativePlatform()) {
                const { status } = await checkNotificationPermissions();
                setNotificationPermission(status);
                await registerNotificationActions();
            }
        };
        init();

        // Setup action listener
        const cleanup = setupNotificationActionListener((action) => {
            addLog('action', `Action: ${action.actionId}`, {
                notificationId: action.notification.id,
                actionId: action.actionId,
                extra: action.notification.extra,
            });
        });

        return () => {
            cleanup();
        };
    }, [addLog]);

    // Get active color config for modifier UI
    const activeColorConfig = accentColor === 'material'
        ? {
            id: 'material',
            name: 'Material You',
            // @ts-ignore
            ...getMaterialYouAccentColors(materialYouColor)
        }
        : ACCENT_COLORS.find(c => c.id === accentColor) || ACCENT_COLORS[0];

    const modifiers = accentModifiers[activeColorConfig.id];

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-light text-neutral-900 dark:text-white tracking-tight">Developer Tools</h2>

            {/* Simulation Controls */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4">Data Simulation</h3>

                {/* Weeks to Simulate */}
                <div className="mb-6">
                    <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-widest mb-2 block">Weeks to Simulate</label>
                    <div className="flex items-center gap-4">
                        <input
                            type="range"
                            min="1"
                            max={programLength}
                            value={sampleWeeks}
                            onChange={(e) => setSampleWeeks(Number(e.target.value))}
                            className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full appearance-none cursor-pointer accent-neutral-900 dark:accent-white"
                        />
                        <span className="font-mono font-bold text-lg w-8 text-right">{sampleWeeks}</span>
                    </div>
                </div>

                {/* Generate/Clear Buttons */}
                <div className="flex flex-col gap-3">
                    <button
                        onClick={generateSampleData}
                        className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-neutral-900 dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                        <Database size={14} /> Generate Data
                    </button>
                    <button
                        onClick={clearSessions}
                        className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <Trash2 size={14} /> Clear Sessions
                    </button>
                </div>
            </div>

            {/* Date Simulation */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4">Date Simulation</h3>

                <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-widest mb-2 block">Simulate Current Date</label>
                <div className="flex gap-2 mb-3">
                    <input
                        type="date"
                        value={simulatedCurrentDate}
                        onChange={(e) => setSimulatedCurrentDate(e.target.value)}
                        className="flex-1 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                    <button
                        onClick={jumpToLastSession}
                        className="px-3 py-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
                        title="Jump to last session"
                    >
                        <Calendar size={16} />
                    </button>
                </div>
                <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                        <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={autoUpdateSimDate}
                            onChange={(e) => setAutoUpdateSimDate(e.target.checked)}
                        />
                        <div className="w-5 h-5 border-2 border-neutral-300 dark:border-neutral-600 rounded flex items-center justify-center peer-checked:bg-neutral-900 dark:peer-checked:bg-white peer-checked:border-transparent transition-colors">
                            {autoUpdateSimDate && <CheckSquare size={12} className="text-white dark:text-black" />}
                        </div>
                    </div>
                    <span className="text-xs text-neutral-600 dark:text-neutral-400 select-none">Auto-set date to last generated session</span>
                </label>
            </div>

            {/* Program Simulation */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                    <LineChart size={14} style={{ color: 'var(--accent)' }} />
                    Program Simulation
                </h3>

                {activePresets.length === 0 ? (
                    <p className="text-sm text-neutral-500">No program templates available.</p>
                ) : (
                    <div className="space-y-4">
                        {/* Program Selection */}
                        <div>
                            <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-widest mb-2 block">Program Template</label>
                            <select
                                value={selectedPresetId}
                                onChange={(e) => {
                                    setSelectedPresetId(e.target.value);
                                    setSimulationResult(null);
                                }}
                                className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm"
                            >
                                {activePresets.map(preset => (
                                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Base Power */}
                        <div>
                            <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-widest mb-2 block">Base Power (W)</label>
                            <input
                                type="number"
                                value={simBasePower || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '') {
                                        setSimBasePower(0);
                                    } else {
                                        setSimBasePower(Number(val));
                                    }
                                    setSimulationResult(null);
                                }}
                                onBlur={(e) => {
                                    const val = Number(e.target.value);
                                    setSimBasePower(Math.max(50, Math.min(500, val || 150)));
                                }}
                                className="w-full bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono"
                                min={50}
                                max={500}
                            />
                        </div>

                        {/* Week Count */}
                        <div>
                            <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-widest mb-2 block">Weeks to Simulate</label>
                            {weekOptions.isFixed ? (
                                /* Fixed duration program - show static value */
                                <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-lg">{simWeekCount}</span>
                                    <span className="text-xs text-neutral-500">weeks (fixed)</span>
                                </div>
                            ) : (
                                /* Variable duration - show slider */
                                <>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="range"
                                            min={weekOptions.min}
                                            max={weekOptions.max}
                                            step={weekOptions.options ? 1 : 1}
                                            value={simWeekCount}
                                            onChange={(e) => {
                                                let val = Number(e.target.value);
                                                // Snap to valid options if weekOptions exist
                                                if (weekOptions.options) {
                                                    val = weekOptions.options.reduce((prev, curr) =>
                                                        Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev
                                                    );
                                                }
                                                setSimWeekCount(val);
                                                setSimulationResult(null);
                                            }}
                                            className="flex-1 h-2 bg-neutral-200 dark:bg-neutral-800 rounded-full appearance-none cursor-pointer accent-neutral-900 dark:accent-white"
                                        />
                                        <span className="font-mono font-bold text-lg w-8 text-right">{simWeekCount}</span>
                                    </div>
                                    {weekOptions.options && (
                                        <p className="text-[10px] text-neutral-400 mt-1">Available: {weekOptions.options.join(', ')} weeks</p>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Run Button */}
                        <button
                            onClick={handleRunSimulation}
                            disabled={isSimulating}
                            className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                            style={{ backgroundColor: 'var(--accent)' }}
                        >
                            <Play size={14} fill="currentColor" />
                            {isSimulating ? 'Simulating...' : 'Run Monte Carlo Simulation'}
                        </button>

                        {/* Simulation Results */}
                        {simulationResult && (
                            <div className="mt-6 -mx-6">
                                <SimulationCharts result={simulationResult} isDarkMode={isDarkMode} />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modifier Testing Lab */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                        <Zap size={14} style={{ color: 'var(--accent)' }} />
                        Modifier Testing Lab
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1">Compare baseline vs adaptive simulation to validate suggested modifiers</p>
                </div>
                <ModifierTestingPanel preset={selectedPreset || null} />
            </div>

            {/* Accent Color Modifiers */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400">Accent Color Modifiers</h3>
                    <button
                        onClick={() => setAccentModifiers({})}
                        className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                    >
                        Reset All
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl transition-all">
                        <div className="w-full flex items-center justify-between p-3 border-b border-neutral-200 dark:border-neutral-700">
                            <div className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full border border-black/10 dark:border-white/10" style={{ backgroundColor: activeColorConfig.displayLight }}></div>
                                <span className="text-sm font-medium text-neutral-900 dark:text-white">{activeColorConfig.name}</span>
                            </div>
                            {modifiers && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
                        </div>

                        <div className="p-3">
                            <div className="w-full">
                                {(['light', 'dark'] as ThemeVariant[]).map(variant => (
                                    <div key={variant} className="mb-6 last:mb-0">
                                        <h4 className="text-xs font-bold uppercase text-neutral-400 mb-3">{variant} Mode</h4>
                                        <div className="space-y-4">
                                            {(['primary', 'secondary', 'ui', 'logo'] as ColorRole[]).map(role => {
                                                const roleLabel = { primary: 'Readiness', secondary: 'Fatigue', ui: 'UI Elements', logo: 'Logo' }[role];

                                                // Determine base color for preview
                                                const baseKey = variant === 'light'
                                                    ? (role === 'primary' ? 'light' : role === 'secondary' ? 'lightAlt' : role === 'ui' ? 'displayLight' : 'logoLight')
                                                    : (role === 'primary' ? 'dark' : role === 'secondary' ? 'darkAlt' : role === 'ui' ? 'displayDark' : 'logoDark');

                                                // @ts-ignore
                                                const baseHex = activeColorConfig[baseKey];
                                                const [h, baseSat, baseLit] = hexToHsl(baseHex);

                                                // Use stored modifiers or fall back to base color's actual values
                                                const currentMods = modifiers?.[variant]?.[role] || { saturation: Math.round(baseSat), brightness: Math.round(baseLit) };

                                                // Preview uses absolute values directly
                                                const previewS = Math.max(0, Math.min(100, currentMods.saturation));
                                                const previewL = Math.max(0, Math.min(100, currentMods.brightness));
                                                const previewHex = hslToHex(h, previewS, previewL);

                                                return (
                                                    <div key={role} className="bg-white dark:bg-neutral-900 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <div className="w-8 h-8 rounded-lg shadow-sm border border-black/10" style={{ backgroundColor: previewHex }}></div>
                                                            <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">{roleLabel}</span>
                                                            {(currentMods.saturation !== Math.round(baseSat) || currentMods.brightness !== Math.round(baseLit)) && (
                                                                <button
                                                                    onClick={() => {
                                                                        const newMods = { ...accentModifiers };
                                                                        if (newMods[activeColorConfig.id]?.[variant]?.[role]) {
                                                                            delete newMods[activeColorConfig.id][variant][role];
                                                                            setAccentModifiers({ ...newMods });
                                                                        }
                                                                    }}
                                                                    className="ml-auto text-[10px] text-red-500 hover:underline"
                                                                >
                                                                    Reset
                                                                </button>
                                                            )}
                                                        </div>

                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] w-6 text-neutral-400">SAT</span>
                                                                <input
                                                                    type="range" min="0" max="100" step="1"
                                                                    value={currentMods.saturation}
                                                                    onChange={(e) => {
                                                                        const val = parseInt(e.target.value);
                                                                        setAccentModifiers(prev => ({
                                                                            ...prev,
                                                                            [activeColorConfig.id]: {
                                                                                ...prev[activeColorConfig.id],
                                                                                [variant]: {
                                                                                    ...prev[activeColorConfig.id]?.[variant],
                                                                                    [role]: { ...currentMods, saturation: val }
                                                                                }
                                                                            }
                                                                        }));
                                                                    }}
                                                                    className="flex-1 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full appearance-none cursor-pointer accent-neutral-900 dark:accent-white"
                                                                />
                                                                <span className="text-[10px] w-8 text-right font-mono text-neutral-500">{currentMods.saturation}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] w-6 text-neutral-400">BRI</span>
                                                                <input
                                                                    type="range" min="0" max="100" step="1"
                                                                    value={currentMods.brightness}
                                                                    onChange={(e) => {
                                                                        const val = parseInt(e.target.value);
                                                                        setAccentModifiers(prev => ({
                                                                            ...prev,
                                                                            [activeColorConfig.id]: {
                                                                                ...prev[activeColorConfig.id],
                                                                                [variant]: {
                                                                                    ...prev[activeColorConfig.id]?.[variant],
                                                                                    [role]: { ...currentMods, brightness: val }
                                                                                }
                                                                            }
                                                                        }));
                                                                    }}
                                                                    className="flex-1 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full appearance-none cursor-pointer accent-neutral-900 dark:accent-white"
                                                                />
                                                                <span className="text-[10px] w-8 text-right font-mono text-neutral-500">{currentMods.brightness}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification Diagnostics */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                    <Bell size={14} style={{ color: 'var(--accent)' }} />
                    Notification Diagnostics
                </h3>

                {!isNativePlatform() ? (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                            Notification testing is only available on native platforms (Android/iOS).
                            You're currently running in: <strong>{getPlatformName()}</strong>
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Permission Status */}
                        <div className="mb-4">
                            <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-widest mb-2 block">
                                Permission Status
                            </label>
                            <div className="flex items-center gap-3">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${notificationPermission === 'granted'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : notificationPermission === 'denied'
                                        ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                                    }`}>
                                    {notificationPermission}
                                </span>
                                <button
                                    onClick={async () => {
                                        setIsLoadingPermission(true);
                                        const result = await requestNotificationPermissions();
                                        addLog('permission', result.message);
                                        const { status } = await checkNotificationPermissions();
                                        setNotificationPermission(status);
                                        setIsLoadingPermission(false);
                                    }}
                                    disabled={isLoadingPermission}
                                    className="px-3 py-1 rounded-lg text-xs font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                                >
                                    {isLoadingPermission ? 'Checking...' : 'Request Permission'}
                                </button>
                            </div>
                        </div>

                        {/* Test Notification Buttons */}
                        <div className="flex flex-col gap-3 mb-4">
                            <button
                                onClick={async () => {
                                    const result = await sendRegularNotification();
                                    addLog(result.success ? 'scheduled' : 'error', result.message);
                                }}
                                className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-neutral-900 dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                            >
                                <Bell size={14} /> Send Regular Notification
                            </button>
                            <button
                                onClick={async () => {
                                    const result = await sendPersistentNotification();
                                    addLog(result.success ? 'scheduled' : 'error', result.message);
                                }}
                                className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                                style={{ backgroundColor: 'var(--accent)' }}
                            >
                                <Bell size={14} /> Send Persistent Notification
                            </button>
                            <button
                                onClick={async () => {
                                    addLog('action', `Testing session notification (isForegroundAndroid: ${isForegroundAndroid()})`);
                                    try {
                                        await startSessionNotification(
                                            'Session Active DEBUG',
                                            'Interval Training - 15 min'
                                        );
                                        addLog('scheduled', 'startSessionNotification completed - check notification shade!');
                                    } catch (err: any) {
                                        addLog('error', `startSessionNotification failed: ${err?.message || String(err)}`);
                                    }
                                }}
                                className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-purple-600 text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                            >
                                <Smartphone size={14} /> Send SESSION Notification (ForegroundService)
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        await stopSessionNotification();
                                        addLog('action', 'stopSessionNotification called');
                                    } catch (err: any) {
                                        addLog('error', `stopSessionNotification failed: ${err?.message || String(err)}`);
                                    }
                                }}
                                className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-neutral-600 text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                            >
                                <Trash2 size={14} /> Stop SESSION Notification
                            </button>
                            <button
                                onClick={async () => {
                                    await cancelAllTestNotifications();
                                    addLog('action', 'All test notifications cancelled');
                                }}
                                className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 size={14} /> Cancel All Test Notifications
                            </button>
                        </div>

                        {/* Action Log */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] font-bold uppercase text-neutral-400 tracking-widest">
                                    Action Log
                                </label>
                                {notificationLogs.length > 0 && (
                                    <button
                                        onClick={() => setNotificationLogs([])}
                                        className="text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            <div className="bg-neutral-50 dark:bg-neutral-950 rounded-xl p-3 max-h-40 overflow-y-auto font-mono text-[10px]">
                                {notificationLogs.length === 0 ? (
                                    <p className="text-neutral-400 text-center py-2">No actions yet. Send a notification and interact with it.</p>
                                ) : (
                                    <div className="space-y-1">
                                        {notificationLogs.map((log, i) => (
                                            <div key={i} className="flex gap-2">
                                                <span className="text-neutral-400 shrink-0">
                                                    {log.timestamp.toLocaleTimeString()}
                                                </span>
                                                <span className={`shrink-0 ${log.type === 'error' ? 'text-red-500' :
                                                    log.type === 'action' ? 'text-green-500' :
                                                        log.type === 'permission' ? 'text-blue-500' :
                                                            'text-neutral-500'
                                                    }`}>
                                                    [{log.type}]
                                                </span>
                                                <span className="text-neutral-700 dark:text-neutral-300 break-all">
                                                    {log.message}
                                                    {log.data && (
                                                        <span className="text-neutral-400 ml-1">
                                                            {JSON.stringify(log.data)}
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* App Info */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2">
                    <Info size={14} style={{ color: 'var(--accent)' }} />
                    App Info
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    {Object.entries(getAppDiagnostics()).map(([key, value]) => (
                        <div key={key} className="bg-neutral-50 dark:bg-neutral-950 rounded-lg p-3">
                            <div className="text-[10px] font-bold uppercase text-neutral-400 tracking-widest mb-1">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                            </div>
                            <div className="font-mono text-sm text-neutral-900 dark:text-white">
                                {value}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Factory Reset */}
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4">Danger Zone</h3>
                <button
                    onClick={() => {
                        if (window.confirm('This will permanently delete ALL data including programs, sessions, and settings. This cannot be undone. Are you sure?')) {
                            localStorage.clear();
                            window.location.reload();
                        }
                    }}
                    className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                >
                    <Trash2 size={14} /> Factory Reset
                </button>
                <p className="text-[10px] text-neutral-400 text-center mt-2">Clears all data and restarts the app</p>
            </div>
        </div>
    );
};

export default DevToolsSettings;
