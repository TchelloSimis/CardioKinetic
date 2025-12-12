import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { AccentColor, AccentColorConfig, ThemePreference } from '../../presets';

export interface AppearanceSettingsProps {
    themePreference: ThemePreference;
    setThemePreference: (value: ThemePreference) => void;
    isDarkMode: boolean;
    accentColor: AccentColor;
    setAccentColor: (value: AccentColor) => void;
    ACCENT_COLORS: AccentColorConfig[];
    isAndroid: boolean;
    materialYouColor: string | null;
}

const AppearanceSettings: React.FC<AppearanceSettingsProps> = ({
    themePreference,
    setThemePreference,
    isDarkMode,
    accentColor,
    setAccentColor,
    ACCENT_COLORS,
    isAndroid,
    materialYouColor,
}) => {
    return (
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
    );
};

export default AppearanceSettings;
