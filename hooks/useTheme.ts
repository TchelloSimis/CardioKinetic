import React, { useState, useEffect, useMemo } from 'react';
import { ThemePreference, AccentColor, ACCENT_COLORS, AccentModifierState, ModifierParams } from '../presets';
import { rgbToHex, getMaterialYouAccentColors, hexToHsl, hslToHex } from '../utils/colorUtils';

export interface ThemeReturn {
    isDarkMode: boolean;
    themePreference: ThemePreference;
    setThemePreference: React.Dispatch<React.SetStateAction<ThemePreference>>;
    materialYouColor: string | null;
    isAndroid: boolean;
    currentAccent: typeof ACCENT_COLORS[0] | ReturnType<typeof getMaterialYouAccent>;
    accentValue: string;
    accentAltValue: string;
}

function getMaterialYouAccent(materialYouColor: string | null): typeof ACCENT_COLORS[0] {
    const colors = getMaterialYouAccentColors(materialYouColor);
    return {
        id: 'material' as AccentColor,
        name: 'Material You',
        ...colors,
    };
}

function applyModifier(hex: string, modifier?: ModifierParams): string {
    if (!modifier) return hex;
    const { saturation, brightness } = modifier;

    // Get the hue from the base color, but use the absolute saturation and brightness values
    const [h] = hexToHsl(hex);
    const newS = Math.max(0, Math.min(100, saturation));
    const newL = Math.max(0, Math.min(100, brightness));

    return hslToHex(h, newS, newL);
}

export function useTheme(accentColor: AccentColor, accentModifiers: AccentModifierState): ThemeReturn {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [themePreference, setThemePreference] = useState<ThemePreference>('system');
    const [materialYouColor, setMaterialYouColor] = useState<string | null>(null);

    // Detect Android for Material You support
    const isAndroid = /android/i.test(navigator.userAgent);

    // Try to get Material You color from Android system
    useEffect(() => {
        if (isAndroid) {
            const tryGetMaterialColor = () => {
                const root = document.documentElement;

                // Method 1: Try CSS custom property (e.g., set by Capacitor or custom bridge)
                const accentPrimary = getComputedStyle(root).getPropertyValue('--material-accent-primary').trim();
                if (accentPrimary && accentPrimary !== '') {
                    setMaterialYouColor(accentPrimary.startsWith('#') ? accentPrimary : rgbToHex(accentPrimary) || accentPrimary);
                    return;
                }

                // Method 2: Check for Android-specific CSS vars that Capacitor might set
                const capAccent = getComputedStyle(root).getPropertyValue('--ion-color-primary').trim();
                if (capAccent && capAccent !== '') {
                    setMaterialYouColor(capAccent.startsWith('#') ? capAccent : rgbToHex(capAccent) || capAccent);
                    return;
                }

                // Method 3: Try the accent-color CSS property
                const tempEl = document.createElement('input');
                tempEl.type = 'checkbox';
                tempEl.style.accentColor = 'auto';
                tempEl.style.position = 'absolute';
                tempEl.style.opacity = '0';
                document.body.appendChild(tempEl);
                const computed = getComputedStyle(tempEl).accentColor;
                document.body.removeChild(tempEl);

                if (computed && computed !== 'auto' && computed !== '' && computed !== 'rgb(0, 0, 0)') {
                    const hexColor = rgbToHex(computed);
                    if (hexColor) {
                        setMaterialYouColor(hexColor);
                        return;
                    }
                }

                // Method 4: Check if Android exposed color via window object (custom bridge)
                const win = window as any;
                if (win.AndroidBridge?.getMaterialYouColor) {
                    const color = win.AndroidBridge.getMaterialYouColor();
                    if (color) {
                        setMaterialYouColor(color);
                        return;
                    }
                }

                // If no color detected, leave as null (will use fallback sky blue)
            };

            tryGetMaterialColor();
            // Also listen for theme changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', tryGetMaterialColor);
        }
    }, [isAndroid]);

    // Handle system theme preference
    useEffect(() => {
        const updateTheme = () => {
            if (themePreference === 'system') {
                // Check using matchMedia
                const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
                setIsDarkMode(mediaQuery.matches);
            } else if (themePreference === 'dark') {
                setIsDarkMode(true);
            } else if (themePreference === 'light') {
                setIsDarkMode(false);
            }
        };

        // Initial update
        updateTheme();

        if (themePreference === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

            // Use a named function for the listener
            const handleChange = () => {
                setIsDarkMode(mediaQuery.matches);
            };

            // Add listener - use both methods for broader compatibility
            if (mediaQuery.addEventListener) {
                mediaQuery.addEventListener('change', handleChange);
            } else {
                // Fallback for older browsers/WebViews
                (mediaQuery as any).addListener(handleChange);
            }

            // Also poll periodically on Android as a fallback (some WebViews don't fire events)
            let pollInterval: ReturnType<typeof setInterval> | null = null;
            if (/android/i.test(navigator.userAgent)) {
                let lastValue = mediaQuery.matches;
                pollInterval = setInterval(() => {
                    const current = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    if (current !== lastValue) {
                        lastValue = current;
                        setIsDarkMode(current);
                    }
                }, 1000); // Check every second
            }

            return () => {
                if (mediaQuery.removeEventListener) {
                    mediaQuery.removeEventListener('change', handleChange);
                } else {
                    (mediaQuery as any).removeListener(handleChange);
                }
                if (pollInterval) {
                    clearInterval(pollInterval);
                }
            };
        }
    }, [themePreference]);

    // Apply dark mode class to document
    useEffect(() => {
        if (isDarkMode) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
    }, [isDarkMode]);

    const baseAccent = accentColor === 'material'
        ? getMaterialYouAccent(materialYouColor)
        : (ACCENT_COLORS.find(c => c.id === accentColor) || ACCENT_COLORS[0]);

    // Apply modifiers if they exist for this color
    const modifiers = accentModifiers[accentColor];

    const currentAccent = useMemo(() => {
        if (!modifiers) return baseAccent;

        return {
            ...baseAccent,
            // Light Mode Variants
            light: applyModifier(baseAccent.light, modifiers.light?.primary),
            lightAlt: applyModifier(baseAccent.lightAlt, modifiers.light?.secondary),
            displayLight: applyModifier(baseAccent.displayLight, modifiers.light?.ui),
            logoLight: applyModifier(baseAccent.logoLight, modifiers.light?.logo),

            // Dark Mode Variants
            dark: applyModifier(baseAccent.dark, modifiers.dark?.primary),
            darkAlt: applyModifier(baseAccent.darkAlt, modifiers.dark?.secondary),
            displayDark: applyModifier(baseAccent.displayDark, modifiers.dark?.ui),
            logoDark: applyModifier(baseAccent.logoDark, modifiers.dark?.logo),
        };
    }, [baseAccent, modifiers]);

    const accentValue = isDarkMode ? currentAccent.dark : currentAccent.light;
    const accentAltValue = isDarkMode ? currentAccent.darkAlt : currentAccent.lightAlt;

    // Set accent color as CSS variable for global access
    useEffect(() => {
        document.documentElement.style.setProperty('--accent', accentValue);
        document.documentElement.style.setProperty('--accent-alt', accentAltValue);
    }, [accentValue, accentAltValue]);

    return {
        isDarkMode,
        themePreference,
        setThemePreference,
        materialYouColor,
        isAndroid,
        currentAccent,
        accentValue,
        accentAltValue,
    };
}
