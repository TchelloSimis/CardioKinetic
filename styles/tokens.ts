/**
 * Design Tokens
 * 
 * Centralized design system tokens for consistent styling across the app
 */

// ============================================================================
// COLORS
// ============================================================================

/**
 * Semantic colors following a consistent naming convention
 */
export const colors = {
    // Primary accent (comes from CSS variable --accent)
    accent: 'var(--accent)',
    accentAlt: 'var(--accent-alt)',

    // Status colors
    success: {
        50: '#ecfdf5',
        100: '#d1fae5',
        500: '#10b981',
        600: '#059669',
        700: '#047857',
    },
    error: {
        50: '#fef2f2',
        100: '#fee2e2',
        500: '#ef4444',
        600: '#dc2626',
        700: '#b91c1c',
    },
    warning: {
        50: '#fffbeb',
        100: '#fef3c7',
        500: '#f59e0b',
        600: '#d97706',
        700: '#b45309',
    },
    info: {
        50: '#eff6ff',
        100: '#dbeafe',
        500: '#3b82f6',
        600: '#2563eb',
        700: '#1d4ed8',
    },

    // Neutral palette
    neutral: {
        0: '#ffffff',
        50: '#fafafa',
        100: '#f5f5f5',
        200: '#e5e5e5',
        300: '#d4d4d4',
        400: '#a3a3a3',
        500: '#737373',
        600: '#525252',
        700: '#404040',
        800: '#262626',
        900: '#171717',
        950: '#0a0a0a',
    },
} as const;

// ============================================================================
// SPACING
// ============================================================================

/**
 * Spacing scale (in pixels, use as rem for responsiveness)
 */
export const spacing = {
    0: '0',
    0.5: '0.125rem',   // 2px
    1: '0.25rem',      // 4px
    1.5: '0.375rem',   // 6px
    2: '0.5rem',       // 8px
    2.5: '0.625rem',   // 10px
    3: '0.75rem',      // 12px
    3.5: '0.875rem',   // 14px
    4: '1rem',         // 16px
    5: '1.25rem',      // 20px
    6: '1.5rem',       // 24px
    8: '2rem',         // 32px
    10: '2.5rem',      // 40px
    12: '3rem',        // 48px
    16: '4rem',        // 64px
    20: '5rem',        // 80px
    24: '6rem',        // 96px
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const typography = {
    // Font families
    fontFamily: {
        sans: 'Inter, system-ui, sans-serif',
        mono: 'Inconsolata, monospace',
    },

    // Font sizes
    fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],      // 12px
        sm: ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
        base: ['1rem', { lineHeight: '1.5rem' }],     // 16px
        lg: ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
        xl: ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],    // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }], // 36px
    },

    // Font weights
    fontWeight: {
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
    },

    // Letter spacing
    letterSpacing: {
        tighter: '-0.05em',
        tight: '-0.025em',
        normal: '0',
        wide: '0.025em',
        wider: '0.05em',
        widest: '0.1em',
    },
} as const;

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const borderRadius = {
    none: '0',
    sm: '0.25rem',     // 4px
    md: '0.5rem',      // 8px
    lg: '0.75rem',     // 12px
    xl: '1rem',        // 16px
    '2xl': '1.5rem',   // 24px - Cards
    '3xl': '2rem',     // 32px - Large cards
    full: '9999px',    // Pills, avatars
} as const;

// ============================================================================
// SHADOWS
// ============================================================================

export const shadows = {
    none: 'none',
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    accent: '0 10px 40px -10px var(--accent)',
} as const;

// ============================================================================
// Z-INDEX
// ============================================================================

export const zIndex = {
    hide: -1,
    base: 0,
    docked: 10,
    dropdown: 1000,
    sticky: 1100,
    banner: 1200,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    toast: 1600,
    tooltip: 1700,
} as const;

// ============================================================================
// ICON SIZES
// ============================================================================

export const iconSizes = {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
    '2xl': 48,
} as const;

// ============================================================================
// TRANSITIONS
// ============================================================================

export const transitions = {
    fast: '150ms ease-in-out',
    normal: '200ms ease-in-out',
    slow: '300ms ease-in-out',
    slower: '500ms ease-in-out',
} as const;

// ============================================================================
// COMPONENT TOKENS
// ============================================================================

export const components = {
    button: {
        minHeight: 44, // Touch target
        paddingX: spacing[4],
        paddingY: spacing[3],
        borderRadius: borderRadius.xl,
        fontSize: typography.fontSize.sm,
        fontWeight: typography.fontWeight.bold,
    },
    card: {
        padding: spacing[6],
        borderRadius: borderRadius['3xl'],
        borderWidth: '1px',
    },
    input: {
        minHeight: 44,
        paddingX: spacing[4],
        paddingY: spacing[3],
        borderRadius: borderRadius.xl,
        fontSize: typography.fontSize.sm,
    },
    modal: {
        borderRadius: borderRadius['3xl'],
        padding: spacing[6],
    },
    label: {
        fontSize: '0.625rem', // 10px
        fontWeight: typography.fontWeight.bold,
        letterSpacing: typography.letterSpacing.widest,
        textTransform: 'uppercase' as const,
    },
} as const;

// ============================================================================
// EXPORTS
// ============================================================================

export const theme = {
    colors,
    spacing,
    typography,
    borderRadius,
    shadows,
    zIndex,
    iconSizes,
    transitions,
    components,
} as const;

export default theme;
