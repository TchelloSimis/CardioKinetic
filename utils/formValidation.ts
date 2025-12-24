/**
 * Form Validation Utilities
 * 
 * Validation helpers for common form fields in the app
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
    isValid: boolean;
    message?: string;
}

export interface ValidationRule<T> {
    validate: (value: T) => boolean;
    message: string;
}

// ============================================================================
// POWER VALIDATION
// ============================================================================

/**
 * Validate base power value (FTP)
 */
export function validateBasePower(watts: number): ValidationResult {
    if (watts < 50) {
        return { isValid: false, message: 'Power must be at least 50W' };
    }
    if (watts > 500) {
        return { isValid: false, message: 'Power cannot exceed 500W' };
    }
    if (!Number.isInteger(watts)) {
        return { isValid: false, message: 'Power must be a whole number' };
    }
    return { isValid: true };
}

/**
 * Validate session power value
 */
export function validateSessionPower(watts: number, basePower: number): ValidationResult {
    const minPower = Math.round(basePower * 0.3);
    const maxPower = Math.round(basePower * 1.5);

    if (watts < minPower) {
        return { isValid: false, message: `Power must be at least ${minPower}W (30% of base)` };
    }
    if (watts > maxPower) {
        return { isValid: false, message: `Power cannot exceed ${maxPower}W (150% of base)` };
    }
    return { isValid: true };
}

// ============================================================================
// RPE VALIDATION
// ============================================================================

/**
 * Validate RPE value (1-10 scale)
 */
export function validateRPE(rpe: number): ValidationResult {
    if (rpe < 1) {
        return { isValid: false, message: 'RPE must be at least 1' };
    }
    if (rpe > 10) {
        return { isValid: false, message: 'RPE cannot exceed 10' };
    }
    return { isValid: true };
}

// ============================================================================
// DURATION VALIDATION
// ============================================================================

/**
 * Validate session duration in minutes
 */
export function validateDuration(minutes: number): ValidationResult {
    if (minutes < 1) {
        return { isValid: false, message: 'Duration must be at least 1 minute' };
    }
    if (minutes > 180) {
        return { isValid: false, message: 'Duration cannot exceed 3 hours' };
    }
    return { isValid: true };
}

/**
 * Validate interval duration in seconds
 */
export function validateIntervalDuration(seconds: number): ValidationResult {
    if (seconds < 5) {
        return { isValid: false, message: 'Interval must be at least 5 seconds' };
    }
    if (seconds > 600) {
        return { isValid: false, message: 'Interval cannot exceed 10 minutes' };
    }
    return { isValid: true };
}

// ============================================================================
// DATE VALIDATION
// ============================================================================

/**
 * Validate date is not in the future
 */
export function validateDateNotFuture(dateStr: string): ValidationResult {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (date > today) {
        return { isValid: false, message: 'Date cannot be in the future' };
    }
    return { isValid: true };
}

/**
 * Validate date is in valid format
 */
export function validateDateFormat(dateStr: string): ValidationResult {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
        return { isValid: false, message: 'Invalid date format (use YYYY-MM-DD)' };
    }

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return { isValid: false, message: 'Invalid date' };
    }

    return { isValid: true };
}

// ============================================================================
// CYCLE/INTERVAL VALIDATION
// ============================================================================

/**
 * Validate number of cycles
 */
export function validateCycles(cycles: number): ValidationResult {
    if (cycles < 1) {
        return { isValid: false, message: 'Must have at least 1 cycle' };
    }
    if (cycles > 100) {
        return { isValid: false, message: 'Cannot exceed 100 cycles' };
    }
    if (!Number.isInteger(cycles)) {
        return { isValid: false, message: 'Cycles must be a whole number' };
    }
    return { isValid: true };
}

// ============================================================================
// TEXT VALIDATION
// ============================================================================

/**
 * Validate required text field
 */
export function validateRequired(value: string, fieldName: string = 'Field'): ValidationResult {
    if (!value || value.trim().length === 0) {
        return { isValid: false, message: `${fieldName} is required` };
    }
    return { isValid: true };
}

/**
 * Validate text length bounds
 */
export function validateLength(
    value: string,
    minLength: number = 0,
    maxLength: number = 255
): ValidationResult {
    if (value.length < minLength) {
        return { isValid: false, message: `Must be at least ${minLength} characters` };
    }
    if (value.length > maxLength) {
        return { isValid: false, message: `Cannot exceed ${maxLength} characters` };
    }
    return { isValid: true };
}
