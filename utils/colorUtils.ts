/**
 * Color utility functions for HSL/RGB/Hex conversions
 */

/**
 * Parse RGB string and convert to hex
 */
export function rgbToHex(rgb: string): string | null {
    // Parse rgb(r, g, b) or rgba(r, g, b, a) format
    const match = rgb.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (match) {
        const r = parseInt(match[1], 10);
        const g = parseInt(match[2], 10);
        const b = parseInt(match[3], 10);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    return null;
}

/**
 * Convert hex color to HSL values
 */
export function hexToHsl(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return [h * 360, s * 100, l * 100];
}

/**
 * Convert HSL values to hex color
 */
export function hslToHex(h: number, s: number, l: number): string {
    s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return `#${Math.round((r + m) * 255).toString(16).padStart(2, '0')}${Math.round((g + m) * 255).toString(16).padStart(2, '0')}${Math.round((b + m) * 255).toString(16).padStart(2, '0')}`;
}

/**
 * Generate Material You accent color variants from a base color
 */
export function getMaterialYouAccentColors(baseColor: string | null) {
    const color = baseColor || '#0ea5e9'; // Fallback to sky blue
    const [h, s, l] = hexToHsl(color);

    return {
        // Pastel version for readiness (light mode: lighter, dark mode: more saturated)
        light: hslToHex(h, Math.min(s * 0.8, 70), Math.min(l + 10, 65)),
        dark: hslToHex(h, Math.min(s * 1.1, 80), Math.max(l - 5, 50)),
        // Darker/more saturated version for fatigue
        lightAlt: hslToHex(h, Math.min(s * 1.2, 90), Math.max(l - 20, 35)),
        darkAlt: hslToHex(h, Math.min(s * 0.6, 50), Math.max(l - 35, 20)),
        // Display color (vibrant but not too saturated)
        displayLight: hslToHex(h, Math.min(s * 1.1, 85), Math.min(l + 5, 55)),
        displayDark: hslToHex(h, Math.min(s * 1.0, 75), Math.min(l + 10, 60)),
        // Logo colors (very dark for light mode, very bright for dark mode)
        logoLight: hslToHex(h, Math.min(s * 0.8, 60), 10),
        logoDark: hslToHex(h, Math.min(s * 0.5, 40), 90),
    };
}
