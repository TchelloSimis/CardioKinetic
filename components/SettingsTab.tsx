import React, { useState, useEffect, useCallback } from 'react';
import { Moon, Sun, Monitor, Pencil, Trash2, RotateCcw, ChevronDown, ChevronUp, ArrowUp, ArrowDown, ChevronRight, Palette, Database, ListTodo, Wrench, Calendar, CheckSquare, Bell, Info, Smartphone } from 'lucide-react';
import { ProgramPreset, ProgramRecord, Session } from '../types';
import { AccentColor, AccentColorConfig, ThemePreference, DEFAULT_PRESETS, AccentModifierState, ColorRole, ThemeVariant, ModifierParams } from '../presets';
import { presetToTemplate, templateToPreset, importTemplateFromJson, exportTemplateToJson } from '../utils/templateUtils';
import { getMaterialYouAccentColors, hexToHsl, hslToHex } from '../utils/colorUtils';
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
} from '../utils/NotificationService';
import {
    startSessionNotification,
    stopSessionNotification,
    isAndroid as isForegroundAndroid,
} from '../utils/foregroundService';

interface SettingsTabProps {
    // Theme
    themePreference: ThemePreference;
    setThemePreference: (value: ThemePreference) => void;
    isDarkMode: boolean;

    // Accent color
    accentColor: AccentColor;
    setAccentColor: (value: AccentColor) => void;
    accentModifiers: AccentModifierState;
    setAccentModifiers: React.Dispatch<React.SetStateAction<AccentModifierState>>;
    ACCENT_COLORS: AccentColorConfig[];
    isAndroid: boolean;
    materialYouColor: string | null;

    // Programs
    activeProgram: ProgramRecord | undefined;
    programs: ProgramRecord[];
    sessions: Session[];
    setPrograms: (programs: ProgramRecord[]) => void;
    setSessions: (sessions: Session[]) => void;
    handleFinishProgram: () => void;
    setActiveTab: (tab: 'dashboard' | 'plan' | 'chart' | 'settings') => void;

    // Templates
    activePresets: ProgramPreset[];
    customTemplates: ProgramPreset[];
    setCustomTemplates: React.Dispatch<React.SetStateAction<ProgramPreset[]>>;
    modifiedDefaults: Record<string, Partial<ProgramPreset>>;
    setModifiedDefaults: React.Dispatch<React.SetStateAction<Record<string, Partial<ProgramPreset>>>>;
    deletedDefaultIds: string[];
    setDeletedDefaultIds: React.Dispatch<React.SetStateAction<string[]>>;
    templateListExpanded: boolean;
    setTemplateListExpanded: (value: boolean) => void;
    editingTemplateId: string | null;
    setEditingTemplateId: (value: string | null) => void;
    editingTemplateName: string;
    setEditingTemplateName: (value: string) => void;
    isDefaultPreset: (id: string) => boolean;
    isDefaultModified: (id: string) => boolean;
    moveTemplate: (presetId: string, direction: 'up' | 'down') => void;
    PRESETS: ProgramPreset[];

    // Navigation state (lifted from internal state for back button handling)
    activeCategory: SettingsCategory;
    setActiveCategory: (category: SettingsCategory) => void;

    // Developer Tools props
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
    // Global Color Props
    // Global Color Props - DEPRECATED / REMOVED in favor of accentModifiers
    // colorBrightness: number;
    // setColorBrightness: (val: number) => void;
    // colorSaturation: number;
    // setColorSaturation: (val: number) => void;
}

export type SettingsCategory = 'main' | 'appearance' | 'programming' | 'data' | 'devtools';

const SettingsTab: React.FC<SettingsTabProps> = ({
    themePreference, setThemePreference, isDarkMode,
    accentColor, setAccentColor, ACCENT_COLORS, isAndroid, materialYouColor,
    activeProgram, programs, sessions, setPrograms, setSessions, handleFinishProgram, setActiveTab,
    activePresets, customTemplates, setCustomTemplates, modifiedDefaults, setModifiedDefaults,
    deletedDefaultIds, setDeletedDefaultIds, templateListExpanded, setTemplateListExpanded,
    editingTemplateId, setEditingTemplateId, editingTemplateName, setEditingTemplateName,
    isDefaultPreset, isDefaultModified, moveTemplate, PRESETS,
    activeCategory, setActiveCategory,
    sampleWeeks, setSampleWeeks, programLength, simulatedCurrentDate, setSimulatedCurrentDate,
    autoUpdateSimDate, setAutoUpdateSimDate, jumpToLastSession, generateSampleData, clearSessions,
    accentModifiers, setAccentModifiers
}) => {
    // Notification diagnostics state
    const [notificationPermission, setNotificationPermission] = useState<string>('unknown');
    const [notificationLogs, setNotificationLogs] = useState<NotificationLogEntry[]>([]);
    const [isLoadingPermission, setIsLoadingPermission] = useState(false);

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

    // Category navigation items
    const categories = [
        { id: 'appearance' as const, name: 'Appearance', description: 'Theme and accent color', icon: Palette },
        { id: 'programming' as const, name: 'Programming', description: 'Manage program and templates', icon: ListTodo },
        { id: 'data' as const, name: 'Data', description: 'Import and export data', icon: Database },
        { id: 'devtools' as const, name: 'Developer Tools', description: 'Testing and simulation', icon: Wrench },
    ];

    return (
        <div className="h-full animate-in fade-in duration-500 pb-16 md:pb-4">
            {/* Header with back button when in a category */}
            {activeCategory === 'main' ? (
                <>
                    <h2 className="text-3xl font-light text-neutral-900 dark:text-white tracking-tight mb-2">Settings</h2>
                    <p className="text-neutral-500 text-sm mb-8">App preferences and actions</p>
                </>
            ) : (
                <button
                    onClick={() => setActiveCategory('main')}
                    className="flex items-center gap-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white mb-6 transition-colors"
                >
                    <ChevronRight size={16} className="rotate-180" />
                    <span className="text-sm font-medium">Back to Settings</span>
                </button>
            )}

            {/* Main category selection */}
            {activeCategory === 'main' && (
                <div className="space-y-3">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className="w-full bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 flex items-center justify-between hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="p-2">
                                    <cat.icon size={24} strokeWidth={2.5} style={{ color: 'var(--accent)' }} />
                                </div>
                                <div className="text-left">
                                    <div className="font-medium text-neutral-900 dark:text-white">{cat.name}</div>
                                    <div className="text-xs text-neutral-500">{cat.description}</div>
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-neutral-300 transition-colors" />
                        </button>
                    ))}
                </div>
            )}

            {/* Appearance Category */}
            {activeCategory === 'appearance' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-light text-neutral-900 dark:text-white tracking-tight">Appearance</h2>
                    {/* Theme Preference */}
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4">Appearance</h3>
                        <div className="grid grid-cols-3 gap-3">
                            <button
                                onClick={() => setThemePreference('light')}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors focus:outline-none ${themePreference === 'light' ? 'bg-neutral-100 dark:bg-neutral-800 border-neutral-400 dark:border-neutral-500' : 'border-neutral-200 dark:border-neutral-700'}`}
                            >
                                <Sun size={24} className={themePreference === 'light' ? 'text-neutral-900 dark:text-white' : 'text-neutral-400'} />
                                <span className={`text-xs font-medium ${themePreference === 'light' ? 'text-neutral-900 dark:text-white' : 'text-neutral-500'}`}>Light</span>
                            </button>
                            <button
                                onClick={() => setThemePreference('dark')}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors focus:outline-none ${themePreference === 'dark' ? 'bg-neutral-100 dark:bg-neutral-800 border-neutral-400 dark:border-neutral-500' : 'border-neutral-200 dark:border-neutral-700'}`}
                            >
                                <Moon size={24} className={themePreference === 'dark' ? 'text-neutral-900 dark:text-white' : 'text-neutral-400'} />
                                <span className={`text-xs font-medium ${themePreference === 'dark' ? 'text-neutral-900 dark:text-white' : 'text-neutral-500'}`}>Dark</span>
                            </button>
                            <button
                                onClick={() => setThemePreference('system')}
                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors focus:outline-none ${themePreference === 'system' ? 'bg-neutral-100 dark:bg-neutral-800 border-neutral-400 dark:border-neutral-500' : 'border-neutral-200 dark:border-neutral-700'}`}
                            >
                                <Monitor size={24} className={themePreference === 'system' ? 'text-neutral-900 dark:text-white' : 'text-neutral-400'} />
                                <span className={`text-xs font-medium ${themePreference === 'system' ? 'text-neutral-900 dark:text-white' : 'text-neutral-500'}`}>System</span>
                            </button>
                        </div>
                    </div>

                    {/* Accent Color */}
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4">Accent Color</h3>
                        <div className={`grid gap-2 ${isAndroid ? 'grid-cols-4' : 'grid-cols-7'}`}>
                            {ACCENT_COLORS.map(color => (
                                <button
                                    key={color.id}
                                    onClick={() => setAccentColor(color.id)}
                                    className={`aspect-square rounded-xl border-2 transition-all focus:outline-none ${accentColor === color.id ? 'border-neutral-900 dark:border-white scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: isDarkMode ? color.displayDark : color.displayLight }}
                                    title={color.name}
                                />
                            ))}
                            {isAndroid && (
                                <button
                                    onClick={() => setAccentColor('material')}
                                    className={`aspect-square rounded-xl border-2 transition-all focus:outline-none overflow-hidden ${accentColor === 'material' ? 'border-neutral-900 dark:border-white scale-110' : 'border-transparent'}`}
                                    style={{ background: `linear-gradient(135deg, ${materialYouColor || '#0ea5e9'}, ${materialYouColor || '#8b5cf6'})` }}
                                    title="Material You"
                                />
                            )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-3">
                            {accentColor === 'material' ? 'Material You' : ACCENT_COLORS.find(c => c.id === accentColor)?.name}
                        </p>
                    </div>
                </div>
            )}

            {/* Programming Category */}
            {activeCategory === 'programming' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-light text-neutral-900 dark:text-white tracking-tight">Programming</h2>

                    {/* Program Templates Section */}
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4">Program Templates</h3>

                        {/* Import/Export buttons */}
                        <div className="flex gap-3 mb-4">
                            <button
                                onClick={() => {
                                    if (!activeProgram) {
                                        alert('No active program to export.');
                                        return;
                                    }
                                    const preset = PRESETS.find(p => p.id === activeProgram.presetId);
                                    if (!preset) {
                                        alert('Cannot export custom-modified programs as templates yet.');
                                        return;
                                    }
                                    const template = presetToTemplate(preset, activeProgram.basePower);
                                    const json = exportTemplateToJson(template);
                                    const blob = new Blob([json], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `template-${template.id}-${new Date().toISOString().split('T')[0]}.json`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 active:bg-neutral-200 dark:active:bg-neutral-700 transition-colors focus:outline-none"
                            >
                                Export Current
                            </button>
                            <button
                                onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = '.json';
                                    input.onchange = (e) => {
                                        const file = (e.target as HTMLInputElement).files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (event) => {
                                                try {
                                                    const jsonStr = event.target?.result as string;
                                                    const result = importTemplateFromJson(jsonStr);
                                                    if (result.valid && result.template) {
                                                        const newPreset = templateToPreset(result.template);
                                                        if (PRESETS.find(p => p.id === newPreset.id)) {
                                                            if (!window.confirm(`A template with ID "${newPreset.id}" already exists. Replace it?`)) return;
                                                            setCustomTemplates(prev => prev.filter(p => p.id !== newPreset.id).concat(newPreset));
                                                        } else {
                                                            setCustomTemplates(prev => [...prev, newPreset]);
                                                        }
                                                        alert(`Template "${newPreset.name}" imported successfully!`);
                                                    } else {
                                                        const errorMsg = result.errors?.map(e => `${e.field}: ${e.message}`).join('\n') || 'Unknown error';
                                                        alert(`Invalid template file format:\n${errorMsg}`);
                                                    }
                                                } catch (err) {
                                                    alert('Failed to parse template file.');
                                                }
                                            };
                                            reader.readAsText(file);
                                        }
                                    };
                                    input.click();
                                }}
                                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 active:bg-neutral-200 dark:active:bg-neutral-700 transition-colors focus:outline-none"
                            >
                                Import Template
                            </button>
                        </div>

                        {/* Template List Toggle */}
                        <button
                            onClick={() => setTemplateListExpanded(!templateListExpanded)}
                            className="w-full flex items-center justify-between py-3 px-4 rounded-xl bg-neutral-50 dark:bg-neutral-950 text-sm font-medium text-neutral-600 dark:text-neutral-400 active:bg-neutral-100 dark:active:bg-neutral-900 transition-colors"
                        >
                            <span>Manage Templates ({activePresets.length})</span>
                            {templateListExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>

                        {/* Template List (Expanded) */}
                        {templateListExpanded && (
                            <div className="space-y-2 max-h-80 overflow-y-auto mt-4">
                                {activePresets.map(preset => {
                                    const isDefault = isDefaultPreset(preset.id);
                                    const isModified = isDefault && isDefaultModified(preset.id);
                                    const originalName = DEFAULT_PRESETS.find(p => p.id === preset.id)?.name;

                                    return (
                                        <div key={preset.id} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                                            {editingTemplateId === preset.id ? (
                                                /* Rename Mode */
                                                <div className="flex items-center gap-2 w-full">
                                                    <input
                                                        type="text"
                                                        value={editingTemplateName}
                                                        onChange={(e) => setEditingTemplateName(e.target.value)}
                                                        className="flex-1 min-w-0 bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-500"
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            if (editingTemplateName.trim()) {
                                                                if (isDefault) {
                                                                    setModifiedDefaults(prev => ({
                                                                        ...prev,
                                                                        [preset.id]: { ...prev[preset.id], name: editingTemplateName.trim() }
                                                                    }));
                                                                } else {
                                                                    setCustomTemplates(prev => prev.map(p =>
                                                                        p.id === preset.id ? { ...p, name: editingTemplateName.trim() } : p
                                                                    ));
                                                                }
                                                            }
                                                            setEditingTemplateId(null);
                                                        }}
                                                        className="shrink-0 px-3 py-2 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-black text-sm font-medium"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingTemplateId(null)}
                                                        className="shrink-0 px-3 py-2 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-sm font-medium"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                /* Display Mode */
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-neutral-900 dark:text-white truncate">
                                                            {preset.name}
                                                            {isModified && originalName !== preset.name && (
                                                                <span className="text-[9px] text-neutral-400 ml-2">(was: {originalName})</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-neutral-400 truncate">
                                                            {preset.weekCount || 12} weeks • {isDefault ? (isModified ? 'Modified' : 'Built-in') : 'Custom'}
                                                        </div>
                                                    </div>

                                                    {/* Reorder buttons */}
                                                    <div className="flex flex-col gap-0.5 mr-1">
                                                        <button
                                                            onClick={() => moveTemplate(preset.id, 'up')}
                                                            className="p-1 rounded text-neutral-400 active:text-neutral-900 dark:active:text-white active:bg-neutral-200 dark:active:bg-neutral-700"
                                                            title="Move Up"
                                                        >
                                                            <ArrowUp size={12} />
                                                        </button>
                                                        <button
                                                            onClick={() => moveTemplate(preset.id, 'down')}
                                                            className="p-1 rounded text-neutral-400 active:text-neutral-900 dark:active:text-white active:bg-neutral-200 dark:active:bg-neutral-700"
                                                            title="Move Down"
                                                        >
                                                            <ArrowDown size={12} />
                                                        </button>
                                                    </div>

                                                    {/* Reset button for modified defaults */}
                                                    {isModified && (
                                                        <button
                                                            onClick={() => {
                                                                setModifiedDefaults(prev => {
                                                                    const next = { ...prev };
                                                                    delete next[preset.id];
                                                                    return next;
                                                                });
                                                                setDeletedDefaultIds(prev => prev.filter(id => id !== preset.id));
                                                            }}
                                                            className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 active:bg-blue-200 dark:active:bg-blue-900/50"
                                                            title="Reset to Default"
                                                        >
                                                            <RotateCcw size={14} />
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => {
                                                            setEditingTemplateId(preset.id);
                                                            setEditingTemplateName(preset.name);
                                                        }}
                                                        className="p-2 rounded-lg bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 active:bg-neutral-300 dark:active:bg-neutral-700"
                                                        title="Rename"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const confirmMsg = isDefault
                                                                ? `Hide "${preset.name}" from presets? You can restore it with Reset All.`
                                                                : `Delete template "${preset.name}"?`;
                                                            if (window.confirm(confirmMsg)) {
                                                                if (isDefault) {
                                                                    setDeletedDefaultIds(prev => [...prev, preset.id]);
                                                                } else {
                                                                    setCustomTemplates(prev => prev.filter(p => p.id !== preset.id));
                                                                }
                                                            }
                                                        }}
                                                        className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 active:bg-red-200 dark:active:bg-red-900/50"
                                                        title={isDefault ? "Hide" : "Delete"}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {activePresets.length === 0 && (
                                    <p className="text-xs text-neutral-400 text-center py-4">No templates available.</p>
                                )}
                            </div>
                        )}

                        {/* Reset Actions */}
                        {templateListExpanded && (customTemplates.length > 0 || Object.keys(modifiedDefaults).length > 0 || deletedDefaultIds.length > 0) && (
                            <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                                <button
                                    onClick={() => {
                                        if (window.confirm('Reset ALL templates to original defaults? This will remove custom templates and restore all built-in presets.')) {
                                            setCustomTemplates([]);
                                            setModifiedDefaults({});
                                            setDeletedDefaultIds([]);
                                        }
                                    }}
                                    className="w-full py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 active:bg-red-200 dark:active:bg-red-900/40 transition-colors focus:outline-none flex items-center justify-center gap-2"
                                >
                                    <RotateCcw size={14} />
                                    Reset All to Defaults
                                </button>
                                <p className="text-[10px] text-neutral-400 text-center mt-2">Removes all changes and restores original presets.</p>
                            </div>
                        )}

                        <p className="text-[10px] text-neutral-400 mt-4">See TEMPLATE_DOCUMENTATION.md for schema details.</p>
                    </div>
                </div>
            )}

            {/* Data Category */}
            {activeCategory === 'data' && (
                <div className="space-y-6">
                    <h2 className="text-2xl font-light text-neutral-900 dark:text-white tracking-tight">Data</h2>

                    {/* Data Management */}
                    <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-6">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-4">Backup & Restore</h3>
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    const data = {
                                        programs,
                                        sessions,
                                        accentColor,
                                        exportedAt: new Date().toISOString(),
                                    };
                                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `cardiokinetic-backup-${new Date().toISOString().split('T')[0]}.json`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors focus:outline-none"
                            >
                                Export
                            </button>
                            <button
                                onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = '.json';
                                    input.onchange = (e) => {
                                        const file = (e.target as HTMLInputElement).files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (event) => {
                                                try {
                                                    const data = JSON.parse(event.target?.result as string);
                                                    if (data.programs && data.sessions) {
                                                        if (window.confirm('This will replace all your current data. Continue?')) {
                                                            setPrograms(data.programs);
                                                            setSessions(data.sessions);
                                                            if (data.accentColor) setAccentColor(data.accentColor);
                                                            alert('Data imported successfully!');
                                                        }
                                                    } else {
                                                        alert('Invalid backup file format.');
                                                    }
                                                } catch (err) {
                                                    alert('Failed to parse backup file.');
                                                }
                                            };
                                            reader.readAsText(file);
                                        }
                                    };
                                    input.click();
                                }}
                                className="flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors focus:outline-none"
                            >
                                Import
                            </button>
                        </div>
                        <p className="text-xs text-neutral-500 mt-3">Backup or restore your programs and sessions</p>
                    </div>
                </div>
            )}

            {/* Developer Tools Category */}
            {activeCategory === 'devtools' && (
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
                            {(() => {
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
                                );
                            })()}
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
            )}
        </div>
    );
};

export default SettingsTab;
