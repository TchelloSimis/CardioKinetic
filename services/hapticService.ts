/**
 * Haptic Feedback Service
 * 
 * Provides haptic feedback on Android devices using Capacitor
 */

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// ============================================================================
// TYPES
// ============================================================================

export type HapticFeedbackType =
    | 'light'      // Subtle tap
    | 'medium'     // Standard interaction
    | 'heavy'      // Strong feedback
    | 'success'    // Positive completion
    | 'warning'    // Caution/attention
    | 'error'      // Failure/problem
    | 'selection'; // Selection change

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Check if haptics are available on the device
 */
export function isHapticsAvailable(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Trigger haptic feedback
 */
export async function triggerHaptic(type: HapticFeedbackType): Promise<void> {
    if (!isHapticsAvailable()) {
        return;
    }

    try {
        switch (type) {
            case 'light':
                await Haptics.impact({ style: ImpactStyle.Light });
                break;
            case 'medium':
                await Haptics.impact({ style: ImpactStyle.Medium });
                break;
            case 'heavy':
                await Haptics.impact({ style: ImpactStyle.Heavy });
                break;
            case 'success':
                await Haptics.notification({ type: NotificationType.Success });
                break;
            case 'warning':
                await Haptics.notification({ type: NotificationType.Warning });
                break;
            case 'error':
                await Haptics.notification({ type: NotificationType.Error });
                break;
            case 'selection':
                await Haptics.selectionChanged();
                break;
        }
    } catch (error) {
        // Silently fail - haptics are not critical
        console.debug('Haptic feedback failed:', error);
    }
}

// ============================================================================
// CONVENIENCE WRAPPERS
// ============================================================================

/** Light tap for subtle interactions */
export const hapticTap = () => triggerHaptic('light');

/** Medium impact for button presses */
export const hapticPress = () => triggerHaptic('medium');

/** Heavy impact for important actions */
export const hapticImpact = () => triggerHaptic('heavy');

/** Success feedback for completed actions */
export const hapticSuccess = () => triggerHaptic('success');

/** Warning feedback for caution states */
export const hapticWarning = () => triggerHaptic('warning');

/** Error feedback for failures */
export const hapticError = () => triggerHaptic('error');

/** Selection change feedback */
export const hapticSelection = () => triggerHaptic('selection');

// ============================================================================
// SESSION-SPECIFIC HAPTICS
// ============================================================================

/** Haptic for phase change (work -> rest or rest -> work) */
export const hapticPhaseChange = () => triggerHaptic('heavy');

/** Haptic for interval completion */
export const hapticIntervalComplete = () => triggerHaptic('medium');

/** Haptic for session start */
export const hapticSessionStart = () => triggerHaptic('success');

/** Haptic for session complete */
export const hapticSessionComplete = () => triggerHaptic('success');

/** Haptic for countdown warning (3, 2, 1) */
export const hapticCountdown = () => triggerHaptic('light');

export default {
    isAvailable: isHapticsAvailable,
    trigger: triggerHaptic,
    tap: hapticTap,
    press: hapticPress,
    impact: hapticImpact,
    success: hapticSuccess,
    warning: hapticWarning,
    error: hapticError,
    selection: hapticSelection,
    phaseChange: hapticPhaseChange,
    intervalComplete: hapticIntervalComplete,
    sessionStart: hapticSessionStart,
    sessionComplete: hapticSessionComplete,
    countdown: hapticCountdown,
};
