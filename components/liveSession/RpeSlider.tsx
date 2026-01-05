import React from 'react';
import { RPE_DESCRIPTIONS } from '../modals/sessionSetupUtils';

interface RpeSliderProps {
    value: number;
    onChange: (rpe: number) => void;
    accentColor?: string;
    /** Base phase color (green for work, blue for rest) */
    phaseColor?: string;
}

/**
 * Create lighter/darker variants of a color
 */
const adjustColorBrightness = (hex: string, amount: number): string => {
    try {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        const adjust = (c: number) => Math.max(0, Math.min(255, Math.round(c + (255 - c) * amount)));
        const darken = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 + amount))));

        if (amount > 0) {
            // Lighten
            return `rgb(${adjust(r)}, ${adjust(g)}, ${adjust(b)})`;
        } else {
            // Darken
            return `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
        }
    } catch {
        return hex;
    }
};

/**
 * Compact, always-visible RPE slider with live descriptions
 * Used during active sessions to log perceived exertion
 */
const RpeSlider: React.FC<RpeSliderProps> = ({
    value,
    onChange,
    phaseColor = '#22c55e' // Default to green (work phase)
}) => {
    // Snap to nearest 0.5 for display
    const snappedValue = Math.round(value * 2) / 2;
    const description = RPE_DESCRIPTIONS[snappedValue] || RPE_DESCRIPTIONS[Math.floor(snappedValue)];

    // Extract just the description part (after the dash)
    const shortDescription = description?.split(' - ')[1] || description;

    // Create light→dark gradient based on phase color
    const lightVariant = adjustColorBrightness(phaseColor, 0.4);  // 40% lighter
    const darkVariant = adjustColorBrightness(phaseColor, -0.3); // 30% darker
    const gradientStyle = `linear-gradient(to right, ${lightVariant}, ${darkVariant})`;

    // Calculate thumb color based on slider position (1-10 mapped to light→dark)
    const thumbPosition = (value - 1) / 9; // 0 to 1
    const thumbColor = adjustColorBrightness(phaseColor, 0.4 - (thumbPosition * 0.7)); // From light to dark

    return (
        <div className="w-full max-w-md bg-white/10 rounded-xl px-3 py-2">
            {/* Main row: label + slider + value */}
            <div className="flex items-center gap-3">
                <span className="text-[10px] text-white/60 uppercase tracking-widest font-bold shrink-0">
                    RPE
                </span>

                <div className="flex-1 relative">
                    <style>{`
                        .rpe-slider::-webkit-slider-thumb { background-color: ${thumbColor}; }
                        .rpe-slider::-moz-range-thumb { background-color: ${thumbColor}; }
                    `}</style>
                    <input
                        type="range"
                        min="1"
                        max="10"
                        step="0.5"
                        value={value}
                        onChange={(e) => onChange(parseFloat(e.target.value))}
                        className="rpe-slider w-full h-2 rounded-full appearance-none cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/50
                            [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white/50"
                        style={{
                            background: gradientStyle,
                        }}
                    />
                </div>

                <span className="text-lg font-bold text-white w-8 text-right shrink-0">
                    {snappedValue.toFixed(1)}
                </span>
            </div>

            {/* Description - compact single line */}
            <div className="text-[10px] text-white/50 text-center mt-1 truncate">
                {shortDescription}
            </div>
        </div>
    );
};

export default RpeSlider;

