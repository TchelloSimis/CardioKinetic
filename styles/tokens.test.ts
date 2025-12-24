/**
 * Unit tests for Design Tokens
 */

import { describe, it, expect } from 'vitest';
import {
    colors,
    spacing,
    typography,
    borderRadius,
    iconSizes,
    components,
    theme,
} from './tokens';

describe('Design Tokens', () => {
    describe('colors', () => {
        it('should have accent colors as CSS variables', () => {
            expect(colors.accent).toBe('var(--accent)');
            expect(colors.accentAlt).toBe('var(--accent-alt)');
        });

        it('should have complete status colors', () => {
            expect(colors.success[500]).toBeDefined();
            expect(colors.error[500]).toBeDefined();
            expect(colors.warning[500]).toBeDefined();
            expect(colors.info[500]).toBeDefined();
        });

        it('should have neutral scale', () => {
            expect(colors.neutral[0]).toBe('#ffffff');
            expect(colors.neutral[950]).toBe('#0a0a0a');
        });
    });

    describe('spacing', () => {
        it('should have base spacing values', () => {
            expect(spacing[0]).toBe('0');
            expect(spacing[4]).toBe('1rem');
            expect(spacing[8]).toBe('2rem');
        });

        it('should have fractional spacing', () => {
            expect(spacing[0.5]).toBe('0.125rem');
            expect(spacing[1.5]).toBe('0.375rem');
        });
    });

    describe('typography', () => {
        it('should have font families', () => {
            expect(typography.fontFamily.sans).toContain('Inter');
            expect(typography.fontFamily.mono).toContain('Inconsolata');
        });

        it('should have font sizes with line heights', () => {
            expect(typography.fontSize.base[0]).toBe('1rem');
            expect(typography.fontSize.base[1].lineHeight).toBe('1.5rem');
        });

        it('should have font weights', () => {
            expect(typography.fontWeight.normal).toBe('400');
            expect(typography.fontWeight.bold).toBe('700');
        });
    });

    describe('borderRadius', () => {
        it('should have standard radii', () => {
            expect(borderRadius.none).toBe('0');
            expect(borderRadius.md).toBe('0.5rem');
            expect(borderRadius['3xl']).toBe('2rem');
            expect(borderRadius.full).toBe('9999px');
        });
    });

    describe('iconSizes', () => {
        it('should have icon size scale', () => {
            expect(iconSizes.sm).toBe(16);
            expect(iconSizes.md).toBe(20);
            expect(iconSizes.lg).toBe(24);
        });
    });

    describe('components', () => {
        it('should have button tokens', () => {
            expect(components.button.minHeight).toBe(44);
            expect(components.button.borderRadius).toBe(borderRadius.xl);
        });

        it('should have card tokens', () => {
            expect(components.card.borderRadius).toBe(borderRadius['3xl']);
        });

        it('should have input tokens', () => {
            expect(components.input.minHeight).toBe(44);
        });

        it('should have label tokens', () => {
            expect(components.label.textTransform).toBe('uppercase');
            expect(components.label.letterSpacing).toBe(typography.letterSpacing.widest);
        });
    });

    describe('theme', () => {
        it('should export complete theme object', () => {
            expect(theme.colors).toBe(colors);
            expect(theme.spacing).toBe(spacing);
            expect(theme.typography).toBe(typography);
            expect(theme.borderRadius).toBe(borderRadius);
            expect(theme.components).toBe(components);
        });
    });
});
