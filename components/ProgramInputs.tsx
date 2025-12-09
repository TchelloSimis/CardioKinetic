import React, { useState, useEffect, useRef } from 'react';
import {
    FatigueCondition, WeekPosition, FlexibleCondition, ThresholdCondition
} from '../programTemplate';
import { ChevronDown, Check } from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

// Fatigue week position supports:
// - Keywords: 'first', 'last', 'early', 'mid', 'late'
// - Exact percentages: '50%', '33.3333%'
// - Comparison operators: '>5', '<10', '>50%', '<33.3333%'
export type FatigueWeekPosition =
    | 'first' | 'last' | 'early' | 'mid' | 'late'
    | `${number}%`
    | `>${number}` | `<${number}`
    | `>${number}%` | `<${number}%`
    | undefined;

// ============================================================================
// CONSTANTS
// ============================================================================

export const WEEK_POSITION_OPTIONS = ['first', 'last', 'early', 'mid', 'late', '25%', '50%', '75%'] as const;

// ============================================================================
// HOOKS
// ============================================================================

function useOnClickOutside(ref: React.RefObject<HTMLElement>, handler: (event: MouseEvent | TouchEvent) => void) {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            // Do nothing if clicking ref's element or descendent elements
            if (!ref.current || ref.current.contains(event.target as Node)) {
                return;
            }
            handler(event);
        };
        document.addEventListener("mousedown", listener);
        document.addEventListener("touchstart", listener);
        return () => {
            document.removeEventListener("mousedown", listener);
            document.removeEventListener("touchstart", listener);
        };
    }, [ref, handler]);
}

// ============================================================================
// GENERIC INPUTS
// ============================================================================

interface SelectOption<T extends string | number> {
    value: T;
    label: string;
}

interface SelectInputProps<T extends string | number> {
    value: T;
    options: SelectOption<T>[] | readonly T[];
    onChange: (value: T) => void;
    className?: string;
    placeholder?: string;
    label?: string;
}

// Helper to normalize options
const getOptions = <T extends string | number>(options: SelectOption<T>[] | readonly T[]): SelectOption<T>[] => {
    if (options.length === 0) return [];
    if (typeof options[0] === 'object' && 'value' in (options[0] as any)) {
        return options as SelectOption<T>[];
    }
    return (options as readonly T[]).map(o => ({ value: o, label: String(o) }));
};

export const SelectInput = <T extends string | number>({
    value,
    options,
    onChange,
    className = "",
    placeholder = "Select...",
    label
}: SelectInputProps<T>) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const normalizedOptions = getOptions(options);

    useOnClickOutside(ref, () => setIsOpen(false));

    const selectedOption = normalizedOptions.find(o => o.value === value);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between text-left ${className}`}
            >
                <span className={`block truncate ${!selectedOption ? 'text-neutral-400' : ''}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown size={14} className={`flex-shrink-0 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-100 dark:border-neutral-700 max-h-60 overflow-auto focus:outline-none py-1 custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                    {normalizedOptions.map((option) => {
                        const isSelected = option.value === value;
                        return (
                            <button
                                key={String(option.value)}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`
                                    relative w-full cursor-pointer select-none py-2 pl-3 pr-9 text-xs font-medium text-left outline-none
                                    ${isSelected ? 'bg-neutral-50 dark:bg-neutral-700/50 text-neutral-900 dark:text-neutral-100' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/50'}
                                `}
                            >
                                <span className={`block truncate ${isSelected ? 'font-bold' : 'font-normal'}`}>
                                    {option.label}
                                </span>

                                {isSelected && (
                                    <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-emerald-500">
                                        <Check size={12} />
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ============================================================================
// NUMBER INPUT
// ============================================================================

export const NumberInput: React.FC<{
    value: number | undefined;
    onChange: (value: number | undefined) => void;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    className?: string;
}> = ({ value, onChange, min, max, step = 1, placeholder, className }) => {
    const [localValue, setLocalValue] = useState(value !== undefined ? String(value) : '');

    React.useEffect(() => {
        setLocalValue(value !== undefined ? String(value) : '');
    }, [value]);

    return (
        <input
            type="text"
            inputMode="decimal"
            value={localValue}
            onChange={(e) => {
                const newValue = e.target.value;
                setLocalValue(newValue);
                // Only update parent for valid numbers (not on empty - wait for blur)
                if (newValue !== '' && newValue !== '-') {
                    const num = parseFloat(newValue);
                    if (!isNaN(num)) {
                        const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, num));
                        onChange(clamped);
                    }
                }
            }}
            onBlur={() => {
                // On blur: if empty, restore previous valid value
                if (localValue === '' || localValue === '-') {
                    if (value !== undefined) {
                        setLocalValue(String(value));
                    }
                } else {
                    // Validate and clamp final value
                    const num = parseFloat(localValue);
                    if (!isNaN(num)) {
                        const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, num));
                        if (clamped !== value) {
                            onChange(clamped);
                        }
                        setLocalValue(String(clamped));
                    } else if (value !== undefined) {
                        setLocalValue(String(value));
                    }
                }
            }}
            placeholder={placeholder}
            className={className || "w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1.5 text-xs outline-none font-mono"}
        />
    );
};

// ============================================================================
// WEEK POSITION INPUT
// ============================================================================

export const WeekPositionInput: React.FC<{
    value: WeekPosition;
    onChange: (value: WeekPosition) => void;
}> = ({ value, onChange }) => {
    const posStr = String(value);
    const [localValue, setLocalValue] = useState(posStr);
    const [error, setError] = useState<string | null>(null);

    // Sync localValue when external value changes
    React.useEffect(() => {
        setLocalValue(String(value));
        setError(null);
    }, [value]);

    const validatePosition = (inputValue: string): { valid: boolean; parsed: WeekPosition | null; error?: string } => {
        const trimmed = inputValue.trim().toLowerCase();
        if (trimmed === 'first') return { valid: true, parsed: 'first' };
        if (trimmed === 'last') return { valid: true, parsed: 'last' };

        // Check for percentage format (supports decimals for arbitrary precision)
        const percentMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*%$/);
        if (percentMatch) {
            const num = parseFloat(percentMatch[1]);
            if (num >= 0 && num <= 100) {
                return { valid: true, parsed: `${num}%` as WeekPosition };
            }
            return { valid: false, parsed: null, error: 'Percentage must be 0-100' };
        }

        // Check for integer
        const intMatch = trimmed.match(/^(\d+)$/);
        if (intMatch) {
            const num = parseInt(intMatch[1]);
            if (num >= 1 && num <= 52) {
                return { valid: true, parsed: num };
            }
            return { valid: false, parsed: null, error: 'Week number must be 1-52' };
        }

        return { valid: false, parsed: null, error: 'Use: 1-52, 0-100%, first, last' };
    };

    return (
        <div>
            <input
                type="text"
                value={localValue}
                onChange={(e) => {
                    const newValue = e.target.value;
                    setLocalValue(newValue);
                    const result = validatePosition(newValue);
                    if (result.valid && result.parsed !== null) {
                        setError(null);
                        onChange(result.parsed);
                    } else {
                        setError(result.error || 'Invalid');
                    }
                }}
                onBlur={() => {
                    const result = validatePosition(localValue);
                    if (!result.valid) {
                        setLocalValue(posStr);
                        setError(null);
                    }
                }}
                placeholder="1, 50%, first, last"
                className={`w-full bg-white dark:bg-neutral-900 border rounded px-2 py-1.5 text-xs outline-none font-mono ${error ? 'border-red-400 dark:border-red-600' : 'border-neutral-200 dark:border-neutral-700'
                    }`}
            />
            {error && (
                <p className="text-[9px] text-red-500 mt-0.5 truncate" title={error}>{error}</p>
            )}
        </div>
    );
};

// ============================================================================
// DURATION INPUT
// ============================================================================

export const DurationInput: React.FC<{
    value: number | string | undefined; // number = absolute minutes, string ending with % = percentage
    defaultMinutes: number;
    onChange: (value: number | string) => void;
}> = ({ value, defaultMinutes, onChange }) => {
    const displayValue = value !== undefined ? String(value) : String(defaultMinutes);
    const [localValue, setLocalValue] = useState(displayValue);
    const [error, setError] = useState<string | null>(null);

    React.useEffect(() => {
        setLocalValue(value !== undefined ? String(value) : String(defaultMinutes));
        setError(null);
    }, [value, defaultMinutes]);

    const validateDuration = (inputValue: string): { valid: boolean; parsed: number | string | null; error?: string } => {
        const trimmed = inputValue.trim();

        // Check for percentage format (e.g., "110%", "90%")
        const percentMatch = trimmed.match(/^(\d+)\s*%$/);
        if (percentMatch) {
            const num = parseInt(percentMatch[1]);
            if (num >= 10 && num <= 500) {
                return { valid: true, parsed: `${num}%` };
            }
            return { valid: false, parsed: null, error: 'Percentage must be 10-500%' };
        }

        // Check for number (minutes)
        const num = parseFloat(trimmed);
        if (!isNaN(num) && num >= 5 && num <= 180) {
            return { valid: true, parsed: Math.round(num) };
        }

        if (!isNaN(num)) {
            return { valid: false, parsed: null, error: 'Duration must be 5-180 min' };
        }

        return { valid: false, parsed: null, error: 'Enter minutes (5-180) or % (10-500%)' };
    };


    return (
        <div>
            <input
                type="text"
                value={localValue}
                onChange={(e) => {
                    const newValue = e.target.value;
                    setLocalValue(newValue);
                    const result = validateDuration(newValue);
                    if (result.valid && result.parsed !== null) {
                        setError(null);
                        onChange(result.parsed);
                    } else {
                        setError(result.error || 'Invalid');
                    }
                }}
                onBlur={() => {
                    const result = validateDuration(localValue);
                    if (!result.valid) {
                        setLocalValue(displayValue);
                        setError(null);
                    }
                }}
                placeholder="15, 110%"
                className={`w-full bg-white dark:bg-neutral-900 border rounded px-2 py-1.5 text-xs outline-none font-mono ${error ? 'border-red-400 dark:border-red-600' : 'border-neutral-200 dark:border-neutral-700'
                    }`}
            />
            {error && (
                <p className="text-[9px] text-red-500 mt-0.5 truncate" title={error}>{error}</p>
            )}
        </div>
    );
};

// ============================================================================
// FATIGUE WEEK POSITION INPUT
// ============================================================================

export const FatigueWeekPositionInput: React.FC<{
    value: FatigueWeekPosition;
    onChange: (value: FatigueWeekPosition) => void;
}> = ({ value, onChange }) => {
    const displayValue = value === undefined ? 'any' : String(value);
    const [localValue, setLocalValue] = useState(displayValue);
    const [error, setError] = useState<string | null>(null);

    React.useEffect(() => {
        setLocalValue(value === undefined ? 'any' : String(value));
        setError(null);
    }, [value]);

    const validatePosition = (inputValue: string): { valid: boolean; parsed: FatigueWeekPosition; error?: string } => {
        const trimmed = inputValue.trim().toLowerCase();
        if (trimmed === 'any' || trimmed === '') return { valid: true, parsed: undefined };
        if (trimmed === 'first') return { valid: true, parsed: 'first' };
        if (trimmed === 'last') return { valid: true, parsed: 'last' };
        if (trimmed === 'early') return { valid: true, parsed: 'early' };
        if (trimmed === 'mid') return { valid: true, parsed: 'mid' };
        if (trimmed === 'late') return { valid: true, parsed: 'late' };

        // Check for comparison operator with percentage (e.g., ">50%", "<33.3333%")
        const compPercentMatch = trimmed.match(/^([><])\s*(\d+(?:\.\d+)?)\s*%$/);
        if (compPercentMatch) {
            const op = compPercentMatch[1];
            const num = parseFloat(compPercentMatch[2]);
            if (num >= 0 && num <= 100) {
                return { valid: true, parsed: `${op}${num}%` as FatigueWeekPosition };
            }
            return { valid: false, parsed: undefined, error: 'Percentage must be 0-100' };
        }

        // Check for comparison operator with week number (e.g., ">5", "<10")
        const compWeekMatch = trimmed.match(/^([><])\s*(\d+)$/);
        if (compWeekMatch) {
            const op = compWeekMatch[1];
            const num = parseInt(compWeekMatch[2]);
            if (num >= 1 && num <= 52) {
                return { valid: true, parsed: `${op}${num}` as FatigueWeekPosition };
            }
            return { valid: false, parsed: undefined, error: 'Week number must be 1-52' };
        }

        // Check for exact percentage format (supports decimals for arbitrary precision)
        const percentMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*%$/);
        if (percentMatch) {
            const num = parseFloat(percentMatch[1]);
            if (num >= 0 && num <= 100) {
                return { valid: true, parsed: `${num}%` as FatigueWeekPosition };
            }
            return { valid: false, parsed: undefined, error: 'Percentage must be 0-100' };
        }

        return { valid: false, parsed: undefined, error: 'Use: any, first, last, early, mid, late, 50%, >5, <50%' };
    };

    return (
        <div>
            <input
                type="text"
                value={localValue}
                onChange={(e) => {
                    const newValue = e.target.value;
                    setLocalValue(newValue);
                    const result = validatePosition(newValue);
                    if (result.valid) {
                        setError(null);
                        onChange(result.parsed);
                    } else {
                        setError(result.error || 'Invalid');
                    }
                }}
                onBlur={() => {
                    const result = validatePosition(localValue);
                    if (!result.valid) {
                        setLocalValue(displayValue);
                        setError(null);
                    }
                }}
                placeholder="any, first, last, 50%"
                className={`w-full bg-white dark:bg-neutral-900 border rounded px-2 py-1.5 text-xs outline-none font-mono ${error ? 'border-red-400 dark:border-red-600' : 'border-neutral-200 dark:border-neutral-700'
                    }`}
            />
            {error && (
                <p className="text-[9px] text-red-500 mt-0.5 truncate" title={error}>{error}</p>
            )}
        </div>
    );
};

// ============================================================================
// THRESHOLD INPUT
// ============================================================================

export const ThresholdInput: React.FC<{
    label: string;
    value: ThresholdCondition | undefined;
    onChange: (value: ThresholdCondition | undefined) => void;
    placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => {
    const [localValue, setLocalValue] = useState(value || '');
    const [error, setError] = useState<string | null>(null);

    React.useEffect(() => {
        setLocalValue(value || '');
        setError(null);
    }, [value]);

    const validateThreshold = (input: string): { valid: boolean; parsed: ThresholdCondition | undefined; error?: string } => {
        const trimmed = input.trim();
        if (trimmed === '' || trimmed === 'any') return { valid: true, parsed: undefined };

        // Match patterns like ">30", "<80", ">=50", "<=70"
        const match = trimmed.match(/^(>=|<=|>|<)\s*(\d+)$/);
        if (match) {
            const op = match[1] as '>' | '<' | '>=' | '<=';
            const num = parseInt(match[2]);
            if (num >= 0 && num <= 100) {
                return { valid: true, parsed: `${op}${num}` as ThresholdCondition };
            }
            return { valid: false, parsed: undefined, error: 'Value must be 0-100' };
        }

        return { valid: false, parsed: undefined, error: 'Use: >30, <80, >=50, <=70' };
    };

    return (
        <div>
            <label className="text-[10px] font-medium text-neutral-400 mb-1 block">{label}</label>
            <input
                type="text"
                value={localValue}
                onChange={(e) => {
                    const newValue = e.target.value;
                    setLocalValue(newValue);
                    const result = validateThreshold(newValue);
                    if (result.valid) {
                        setError(null);
                        onChange(result.parsed);
                    } else {
                        setError(result.error || 'Invalid');
                    }
                }}
                onBlur={() => {
                    const result = validateThreshold(localValue);
                    if (!result.valid) {
                        setLocalValue(value || '');
                        setError(null);
                    }
                }}
                placeholder={placeholder || ">30, <80"}
                className={`w-full bg-white dark:bg-neutral-900 border rounded px-2 py-1.5 text-xs outline-none font-mono ${error ? 'border-red-400 dark:border-red-600' : 'border-neutral-200 dark:border-neutral-700'
                    }`}
            />
            {error && (
                <p className="text-[9px] text-red-500 mt-0.5 truncate" title={error}>{error}</p>
            )}
        </div>
    );
};

// ============================================================================
// FATIGUE CONDITION INPUT
// ============================================================================

export const FatigueConditionInput: React.FC<{
    value: FatigueCondition;
    onChange: (value: FatigueCondition) => void;
}> = ({ value, onChange }) => {
    // Convert legacy preset to flexible format for editing
    const isFlexible = typeof value === 'object' && value !== null;
    const condition: FlexibleCondition = isFlexible
        ? value as FlexibleCondition
        : { logic: 'and' }; // Default for legacy presets

    const handleChange = (updates: Partial<FlexibleCondition>) => {
        const newCondition: FlexibleCondition = {
            ...condition,
            ...updates
        };
        // If both thresholds are undefined, keep as is (empty condition)
        onChange(newCondition);
    };

    return (
        <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
                <ThresholdInput
                    label="Fatigue"
                    value={condition.fatigue}
                    onChange={(val) => handleChange({ fatigue: val })}
                    placeholder=">30"
                />
                <ThresholdInput
                    label="Readiness"
                    value={condition.readiness}
                    onChange={(val) => handleChange({ readiness: val })}
                    placeholder="<50"
                />
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-neutral-400">Logic:</span>
                <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
                    <button
                        type="button"
                        onClick={() => handleChange({ logic: 'and' })}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${condition.logic === 'and'
                            ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                            }`}
                    >
                        AND
                    </button>
                    <button
                        type="button"
                        onClick={() => handleChange({ logic: 'or' })}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${condition.logic === 'or'
                            ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                            }`}
                    >
                        OR
                    </button>
                </div>
                <span className="text-[10px] text-neutral-400 ml-2">
                    {condition.logic === 'and'
                        ? 'Both conditions must be true'
                        : 'Either condition can be true'}
                </span>
            </div>
        </div>
    );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const formatCondition = (condition: FatigueCondition): string => {
    if (typeof condition === 'string') {
        // Legacy preset
        return condition.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    // Flexible condition
    const parts: string[] = [];
    if (condition.fatigue) parts.push(`Fatigue ${condition.fatigue}`);
    if (condition.readiness) parts.push(`Readiness ${condition.readiness}`);
    if (parts.length === 0) return 'Any';
    return parts.join(condition.logic === 'and' ? ' AND ' : ' OR ');
};
