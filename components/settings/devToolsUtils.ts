/**
 * DevToolsSettings Utilities
 * 
 * Extracted utility functions and constants for dev tools
 */

// ============================================================================
// NOTIFICATION HELPERS
// ============================================================================

/**
 * Format notification log entry for display
 */
export function formatNotificationEntry(entry: { type: string; time: number; message?: string }): string {
    const date = new Date(entry.time);
    const timeStr = date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    return `[${timeStr}] ${entry.type}${entry.message ? `: ${entry.message}` : ''}`;
}

/**
 * Get notification type badge color
 */
export function getNotificationBadgeColor(type: string): { bg: string; text: string } {
    switch (type.toLowerCase()) {
        case 'error':
            return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' };
        case 'warning':
            return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' };
        case 'success':
            return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' };
        default:
            return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' };
    }
}

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * Get week number from dates
 */
export function getWeekNumber(sessionDate: string, programStartDate: string): number {
    const session = new Date(sessionDate);
    const start = new Date(programStartDate);
    const diffTime = session.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
}

/**
 * Format date for display
 */
export function formatDisplayDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

// ============================================================================
// ACCENT COLOR HELPERS
// ============================================================================

/**
 * Parse hex color to RGB components
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// ============================================================================
// SAMPLE DATA GENERATION
// ============================================================================

/**
 * Generate random variance multiplier
 */
export function randomVariance(base: number, variance: number = 0.1): number {
    return base * (1 + (Math.random() * 2 - 1) * variance);
}

/**
 * Generate random RPE within bounds
 */
export function randomRPE(target: number, variance: number = 1): number {
    const value = target + (Math.random() * 2 - 1) * variance;
    return Math.max(1, Math.min(10, Math.round(value)));
}
