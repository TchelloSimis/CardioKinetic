/**
 * Unit tests for Form Validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
    validateBasePower,
    validateSessionPower,
    validateRPE,
    validateDuration,
    validateIntervalDuration,
    validateDateNotFuture,
    validateDateFormat,
    validateCycles,
    validateRequired,
    validateLength,
} from './formValidation';

describe('Form Validation Utilities', () => {
    describe('validateBasePower', () => {
        it('should accept valid power values', () => {
            expect(validateBasePower(100).isValid).toBe(true);
            expect(validateBasePower(200).isValid).toBe(true);
            expect(validateBasePower(50).isValid).toBe(true);
            expect(validateBasePower(500).isValid).toBe(true);
        });

        it('should reject power below 50W', () => {
            const result = validateBasePower(49);
            expect(result.isValid).toBe(false);
            expect(result.message).toContain('50W');
        });

        it('should reject power above 500W', () => {
            const result = validateBasePower(501);
            expect(result.isValid).toBe(false);
            expect(result.message).toContain('500W');
        });

        it('should reject non-integer values', () => {
            const result = validateBasePower(150.5);
            expect(result.isValid).toBe(false);
            expect(result.message).toContain('whole number');
        });
    });

    describe('validateSessionPower', () => {
        const basePower = 200;

        it('should accept power within valid range', () => {
            expect(validateSessionPower(100, basePower).isValid).toBe(true);
            expect(validateSessionPower(200, basePower).isValid).toBe(true);
            expect(validateSessionPower(300, basePower).isValid).toBe(true);
        });

        it('should reject power below 30% of base', () => {
            const result = validateSessionPower(50, basePower);
            expect(result.isValid).toBe(false);
            expect(result.message).toContain('30%');
        });

        it('should reject power above 150% of base', () => {
            const result = validateSessionPower(350, basePower);
            expect(result.isValid).toBe(false);
            expect(result.message).toContain('150%');
        });
    });

    describe('validateRPE', () => {
        it('should accept RPE 1-10', () => {
            for (let i = 1; i <= 10; i++) {
                expect(validateRPE(i).isValid).toBe(true);
            }
        });

        it('should reject RPE below 1', () => {
            const result = validateRPE(0);
            expect(result.isValid).toBe(false);
        });

        it('should reject RPE above 10', () => {
            const result = validateRPE(11);
            expect(result.isValid).toBe(false);
        });
    });

    describe('validateDuration', () => {
        it('should accept valid durations', () => {
            expect(validateDuration(1).isValid).toBe(true);
            expect(validateDuration(30).isValid).toBe(true);
            expect(validateDuration(180).isValid).toBe(true);
        });

        it('should reject duration below 1 minute', () => {
            const result = validateDuration(0);
            expect(result.isValid).toBe(false);
        });

        it('should reject duration above 180 minutes', () => {
            const result = validateDuration(181);
            expect(result.isValid).toBe(false);
        });
    });

    describe('validateIntervalDuration', () => {
        it('should accept valid interval durations', () => {
            expect(validateIntervalDuration(5).isValid).toBe(true);
            expect(validateIntervalDuration(30).isValid).toBe(true);
            expect(validateIntervalDuration(600).isValid).toBe(true);
        });

        it('should reject interval below 5 seconds', () => {
            const result = validateIntervalDuration(4);
            expect(result.isValid).toBe(false);
        });

        it('should reject interval above 600 seconds', () => {
            const result = validateIntervalDuration(601);
            expect(result.isValid).toBe(false);
        });
    });

    describe('validateDateFormat', () => {
        it('should accept valid date format', () => {
            expect(validateDateFormat('2024-01-15').isValid).toBe(true);
            expect(validateDateFormat('2023-12-31').isValid).toBe(true);
        });

        it('should reject invalid format', () => {
            expect(validateDateFormat('01-15-2024').isValid).toBe(false);
            expect(validateDateFormat('2024/01/15').isValid).toBe(false);
            expect(validateDateFormat('invalid').isValid).toBe(false);
        });
    });

    describe('validateDateNotFuture', () => {
        it('should accept past dates', () => {
            expect(validateDateNotFuture('2020-01-01').isValid).toBe(true);
        });

        it('should reject future dates', () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);
            const futureDateStr = futureDate.toISOString().split('T')[0];

            const result = validateDateNotFuture(futureDateStr);
            expect(result.isValid).toBe(false);
            expect(result.message).toContain('future');
        });
    });

    describe('validateCycles', () => {
        it('should accept valid cycle counts', () => {
            expect(validateCycles(1).isValid).toBe(true);
            expect(validateCycles(10).isValid).toBe(true);
            expect(validateCycles(100).isValid).toBe(true);
        });

        it('should reject cycles below 1', () => {
            expect(validateCycles(0).isValid).toBe(false);
        });

        it('should reject cycles above 100', () => {
            expect(validateCycles(101).isValid).toBe(false);
        });

        it('should reject non-integer cycles', () => {
            expect(validateCycles(5.5).isValid).toBe(false);
        });
    });

    describe('validateRequired', () => {
        it('should accept non-empty strings', () => {
            expect(validateRequired('hello').isValid).toBe(true);
            expect(validateRequired('  text  ').isValid).toBe(true);
        });

        it('should reject empty strings', () => {
            expect(validateRequired('').isValid).toBe(false);
            expect(validateRequired('   ').isValid).toBe(false);
        });

        it('should include field name in message', () => {
            const result = validateRequired('', 'Username');
            expect(result.message).toContain('Username');
        });
    });

    describe('validateLength', () => {
        it('should accept strings within bounds', () => {
            expect(validateLength('hello', 1, 10).isValid).toBe(true);
        });

        it('should reject strings too short', () => {
            const result = validateLength('ab', 3, 10);
            expect(result.isValid).toBe(false);
            expect(result.message).toContain('3');
        });

        it('should reject strings too long', () => {
            const result = validateLength('hello world', 1, 5);
            expect(result.isValid).toBe(false);
            expect(result.message).toContain('5');
        });
    });
});
