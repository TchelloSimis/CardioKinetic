/**
 * Accessibility Utilities
 * 
 * Helper functions and constants for accessibility improvements
 */

// ============================================================================
// TOUCH TARGET CONSTANTS
// ============================================================================

/** Minimum touch target size in pixels (per WCAG guidelines) */
export const MIN_TOUCH_TARGET_SIZE = 44;

/** Recommended interactive element sizes */
export const INTERACTIVE_SIZES = {
    button: {
        minWidth: 44,
        minHeight: 44,
        paddingX: 16,
        paddingY: 12,
    },
    iconButton: {
        size: 44,
    },
    listItem: {
        minHeight: 48,
    },
    input: {
        minHeight: 44,
    },
};

// ============================================================================
// ARIA HELPERS
// ============================================================================

/**
 * Generate ARIA props for a button that opens a modal
 */
export function getModalTriggerProps(modalId: string, isOpen: boolean) {
    return {
        'aria-haspopup': 'dialog' as const,
        'aria-expanded': isOpen,
        'aria-controls': isOpen ? modalId : undefined,
    };
}

/**
 * Generate ARIA props for a modal dialog
 */
export function getModalProps(modalId: string, labelledBy: string, describedBy?: string) {
    return {
        id: modalId,
        role: 'dialog' as const,
        'aria-modal': true,
        'aria-labelledby': labelledBy,
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    };
}

/**
 * Generate ARIA props for tabs
 */
export function getTabProps(tabId: string, panelId: string, isSelected: boolean) {
    return {
        id: tabId,
        role: 'tab' as const,
        'aria-selected': isSelected,
        'aria-controls': panelId,
        tabIndex: isSelected ? 0 : -1,
    };
}

/**
 * Generate ARIA props for tab panel
 */
export function getTabPanelProps(panelId: string, tabId: string) {
    return {
        id: panelId,
        role: 'tabpanel' as const,
        'aria-labelledby': tabId,
        tabIndex: 0,
    };
}

/**
 * Generate ARIA props for progress bars
 */
export function getProgressProps(value: number, max: number = 100, label?: string) {
    return {
        role: 'progressbar' as const,
        'aria-valuenow': value,
        'aria-valuemin': 0,
        'aria-valuemax': max,
        ...(label ? { 'aria-label': label } : {}),
    };
}

// ============================================================================
// FOCUS MANAGEMENT
// ============================================================================

/**
 * Focus trap element IDs for modals
 */
export function createFocusTrapId(modalId: string) {
    return {
        start: `${modalId}-focus-start`,
        end: `${modalId}-focus-end`,
    };
}

/**
 * Get first focusable element in container
 */
export function getFirstFocusable(container: HTMLElement): HTMLElement | null {
    const focusable = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    return focusable[0] || null;
}

/**
 * Get last focusable element in container
 */
export function getLastFocusable(container: HTMLElement): HTMLElement | null {
    const focusable = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    return focusable[focusable.length - 1] || null;
}

// ============================================================================
// SCREEN READER HELPERS
// ============================================================================

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
}

/**
 * CSS class for visually hidden but accessible content
 */
export const SR_ONLY_CLASS = 'sr-only';

/**
 * Inline styles for visually hidden content
 */
export const SR_ONLY_STYLES: React.CSSProperties = {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0,
};
