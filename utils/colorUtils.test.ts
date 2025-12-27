/**
 * Unit tests for colorUtils.ts
 * 
 * Tests color conversion and Material You accent generation.
 */

import { describe, it, expect } from 'vitest';
import {
    rgbToHex,
    hexToHsl,
    hslToHex,
    getMaterialYouAccentColors
} from './colorUtils';

// ============================================================================
// rgbToHex TESTS
// ============================================================================

describe('rgbToHex', () => {
    it('should convert rgb() format to hex', () => {
        expect(rgbToHex('rgb(255, 0, 0)')).toBe('#ff0000');
        expect(rgbToHex('rgb(0, 255, 0)')).toBe('#00ff00');
        expect(rgbToHex('rgb(0, 0, 255)')).toBe('#0000ff');
    });

    it('should convert rgba() format to hex', () => {
        expect(rgbToHex('rgba(255, 128, 64, 0.5)')).toBe('#ff8040');
    });

    it('should handle rgb with no spaces', () => {
        expect(rgbToHex('rgb(128,128,128)')).toBe('#808080');
    });

    it('should return null for invalid format', () => {
        expect(rgbToHex('invalid')).toBeNull();
        expect(rgbToHex('#ff0000')).toBeNull();
        expect(rgbToHex('')).toBeNull();
    });

    it('should pad single-digit hex values', () => {
        expect(rgbToHex('rgb(0, 0, 0)')).toBe('#000000');
        expect(rgbToHex('rgb(15, 15, 15)')).toBe('#0f0f0f');
    });
});

// ============================================================================
// hexToHsl TESTS
// ============================================================================

describe('hexToHsl', () => {
    it('should convert pure red', () => {
        const [h, s, l] = hexToHsl('#ff0000');
        expect(h).toBeCloseTo(0, 0);
        expect(s).toBeCloseTo(100, 0);
        expect(l).toBeCloseTo(50, 0);
    });

    it('should convert pure green', () => {
        const [h, s, l] = hexToHsl('#00ff00');
        expect(h).toBeCloseTo(120, 0);
        expect(s).toBeCloseTo(100, 0);
        expect(l).toBeCloseTo(50, 0);
    });

    it('should convert pure blue', () => {
        const [h, s, l] = hexToHsl('#0000ff');
        expect(h).toBeCloseTo(240, 0);
        expect(s).toBeCloseTo(100, 0);
        expect(l).toBeCloseTo(50, 0);
    });

    it('should convert white', () => {
        const [h, s, l] = hexToHsl('#ffffff');
        expect(s).toBe(0);
        expect(l).toBe(100);
    });

    it('should convert black', () => {
        const [h, s, l] = hexToHsl('#000000');
        expect(s).toBe(0);
        expect(l).toBe(0);
    });

    it('should convert gray', () => {
        const [h, s, l] = hexToHsl('#808080');
        expect(s).toBe(0);
        expect(l).toBeCloseTo(50, 0);
    });
});

// ============================================================================
// hslToHex TESTS
// ============================================================================

describe('hslToHex', () => {
    it('should convert red HSL values', () => {
        expect(hslToHex(0, 100, 50)).toBe('#ff0000');
    });

    it('should convert green HSL values', () => {
        expect(hslToHex(120, 100, 50)).toBe('#00ff00');
    });

    it('should convert blue HSL values', () => {
        expect(hslToHex(240, 100, 50)).toBe('#0000ff');
    });

    it('should convert white', () => {
        expect(hslToHex(0, 0, 100)).toBe('#ffffff');
    });

    it('should convert black', () => {
        expect(hslToHex(0, 0, 0)).toBe('#000000');
    });

    it('should handle cyan', () => {
        const result = hslToHex(180, 100, 50);
        expect(result).toBe('#00ffff');
    });

    it('should handle magenta', () => {
        const result = hslToHex(300, 100, 50);
        expect(result).toBe('#ff00ff');
    });

    it('should handle yellow', () => {
        const result = hslToHex(60, 100, 50);
        expect(result).toBe('#ffff00');
    });
});

// ============================================================================
// getMaterialYouAccentColors TESTS
// ============================================================================

describe('getMaterialYouAccentColors', () => {
    it('should return all color variants', () => {
        const result = getMaterialYouAccentColors('#0ea5e9');

        expect(result).toHaveProperty('light');
        expect(result).toHaveProperty('dark');
        expect(result).toHaveProperty('lightAlt');
        expect(result).toHaveProperty('darkAlt');
        expect(result).toHaveProperty('displayLight');
        expect(result).toHaveProperty('displayDark');
        expect(result).toHaveProperty('logoLight');
        expect(result).toHaveProperty('logoDark');
    });

    it('should return valid hex colors', () => {
        const result = getMaterialYouAccentColors('#0ea5e9');

        const hexPattern = /^#[0-9a-f]{6}$/i;
        expect(result.light).toMatch(hexPattern);
        expect(result.dark).toMatch(hexPattern);
        expect(result.lightAlt).toMatch(hexPattern);
        expect(result.darkAlt).toMatch(hexPattern);
    });

    it('should use fallback for null input', () => {
        const result = getMaterialYouAccentColors(null);

        // Should not throw and should return valid colors
        expect(result.light).toBeDefined();
        expect(result.dark).toBeDefined();
    });

    it('should produce lighter variants for light mode', () => {
        const base = '#0ea5e9';
        const result = getMaterialYouAccentColors(base);

        // Light variant should have higher lightness
        const [, , baseLightness] = hexToHsl(base);
        const [, , lightLightness] = hexToHsl(result.light);

        expect(lightLightness).toBeGreaterThan(baseLightness);
    });

    it('should produce very dark logo color for light mode', () => {
        const result = getMaterialYouAccentColors('#0ea5e9');

        const [, , lightness] = hexToHsl(result.logoLight);
        expect(lightness).toBeLessThanOrEqual(15);
    });

    it('should produce very light logo color for dark mode', () => {
        const result = getMaterialYouAccentColors('#0ea5e9');

        const [, , lightness] = hexToHsl(result.logoDark);
        expect(lightness).toBeGreaterThanOrEqual(85);
    });
});
