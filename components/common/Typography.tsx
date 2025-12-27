/**
 * Typography Utilities
 * 
 * Consistent typography classes and components
 */

import React from 'react';

// ============================================================================
// HEADING COMPONENT
// ============================================================================

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
    level?: HeadingLevel;
    /** Visual size override */
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

const headingStyles: Record<HeadingLevel, string> = {
    1: 'text-3xl font-bold tracking-tight',
    2: 'text-2xl font-bold tracking-tight',
    3: 'text-xl font-semibold',
    4: 'text-lg font-semibold',
    5: 'text-base font-medium',
    6: 'text-sm font-medium',
};

const sizeOverrides: Record<string, string> = {
    'xs': 'text-xs',
    'sm': 'text-sm',
    'md': 'text-base',
    'lg': 'text-lg',
    'xl': 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
};

export const Heading: React.FC<HeadingProps> = ({
    level = 2,
    size,
    className = '',
    children,
    ...props
}) => {
    const Tag: React.ElementType = `h${level}`;
    const baseStyle = headingStyles[level];
    const sizeStyle = size ? sizeOverrides[size] : '';

    return (
        <Tag
            className={`text-neutral-900 dark:text-white ${baseStyle} ${sizeStyle} ${className}`}
            {...props}
        >
            {children}
        </Tag>
    );
};

// ============================================================================
// TEXT COMPONENT
// ============================================================================

type TextVariant = 'body' | 'small' | 'caption' | 'overline';

interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
    variant?: TextVariant;
    /** Muted color */
    muted?: boolean;
    /** Text alignment */
    align?: 'left' | 'center' | 'right';
}

const textStyles: Record<TextVariant, string> = {
    body: 'text-base',
    small: 'text-sm',
    caption: 'text-xs',
    overline: 'text-[10px] font-bold uppercase tracking-widest',
};

export const Text: React.FC<TextProps> = ({
    variant = 'body',
    muted = false,
    align = 'left',
    className = '',
    children,
    ...props
}) => {
    const colorClass = muted
        ? 'text-neutral-500 dark:text-neutral-400'
        : 'text-neutral-900 dark:text-white';

    const alignClass = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
    }[align];

    return (
        <p
            className={`${textStyles[variant]} ${colorClass} ${alignClass} ${className}`}
            {...props}
        >
            {children}
        </p>
    );
};

// ============================================================================
// TYPOGRAPHY UTILITY CLASSES
// ============================================================================

/**
 * Utility classes for consistent typography
 */
export const typographyClasses = {
    // Headings
    h1: 'text-3xl font-bold tracking-tight text-neutral-900 dark:text-white',
    h2: 'text-2xl font-bold tracking-tight text-neutral-900 dark:text-white',
    h3: 'text-xl font-semibold text-neutral-900 dark:text-white',
    h4: 'text-lg font-semibold text-neutral-900 dark:text-white',
    h5: 'text-base font-medium text-neutral-900 dark:text-white',
    h6: 'text-sm font-medium text-neutral-900 dark:text-white',

    // Body text
    body: 'text-base text-neutral-900 dark:text-white',
    bodyMuted: 'text-base text-neutral-500 dark:text-neutral-400',

    // Small text
    small: 'text-sm text-neutral-600 dark:text-neutral-300',
    smallMuted: 'text-sm text-neutral-500 dark:text-neutral-400',

    // Caption
    caption: 'text-xs text-neutral-500 dark:text-neutral-400',

    // Overline (labels)
    overline: 'text-[10px] font-bold uppercase tracking-widest text-neutral-400',

    // Monospace
    mono: 'font-mono text-sm',
} as const;

export default { Heading, Text, typographyClasses };
