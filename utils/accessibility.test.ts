/**
 * Unit tests for Accessibility utilities
 */

import { describe, it, expect } from 'vitest';
import {
    MIN_TOUCH_TARGET_SIZE,
    INTERACTIVE_SIZES,
    getModalTriggerProps,
    getModalProps,
    getTabProps,
    getTabPanelProps,
    getProgressProps,
    createFocusTrapId,
    SR_ONLY_STYLES,
} from './accessibility';

describe('Accessibility Utilities', () => {
    describe('Constants', () => {
        it('should have correct min touch target size', () => {
            expect(MIN_TOUCH_TARGET_SIZE).toBe(44);
        });

        it('should have button interactive sizes', () => {
            expect(INTERACTIVE_SIZES.button.minWidth).toBe(44);
            expect(INTERACTIVE_SIZES.button.minHeight).toBe(44);
        });

        it('should have iconButton size', () => {
            expect(INTERACTIVE_SIZES.iconButton.size).toBe(44);
        });
    });

    describe('getModalTriggerProps', () => {
        it('should return props for closed modal', () => {
            const props = getModalTriggerProps('test-modal', false);

            expect(props['aria-haspopup']).toBe('dialog');
            expect(props['aria-expanded']).toBe(false);
            expect(props['aria-controls']).toBeUndefined();
        });

        it('should return props for open modal', () => {
            const props = getModalTriggerProps('test-modal', true);

            expect(props['aria-haspopup']).toBe('dialog');
            expect(props['aria-expanded']).toBe(true);
            expect(props['aria-controls']).toBe('test-modal');
        });
    });

    describe('getModalProps', () => {
        it('should return modal props without describedBy', () => {
            const props = getModalProps('modal-1', 'modal-title');

            expect(props.id).toBe('modal-1');
            expect(props.role).toBe('dialog');
            expect(props['aria-modal']).toBe(true);
            expect(props['aria-labelledby']).toBe('modal-title');
            expect(props['aria-describedby']).toBeUndefined();
        });

        it('should include describedBy when provided', () => {
            const props = getModalProps('modal-1', 'modal-title', 'modal-description');

            expect(props['aria-describedby']).toBe('modal-description');
        });
    });

    describe('getTabProps', () => {
        it('should return props for selected tab', () => {
            const props = getTabProps('tab-1', 'panel-1', true);

            expect(props.id).toBe('tab-1');
            expect(props.role).toBe('tab');
            expect(props['aria-selected']).toBe(true);
            expect(props['aria-controls']).toBe('panel-1');
            expect(props.tabIndex).toBe(0);
        });

        it('should return props for unselected tab', () => {
            const props = getTabProps('tab-2', 'panel-2', false);

            expect(props['aria-selected']).toBe(false);
            expect(props.tabIndex).toBe(-1);
        });
    });

    describe('getTabPanelProps', () => {
        it('should return tab panel props', () => {
            const props = getTabPanelProps('panel-1', 'tab-1');

            expect(props.id).toBe('panel-1');
            expect(props.role).toBe('tabpanel');
            expect(props['aria-labelledby']).toBe('tab-1');
            expect(props.tabIndex).toBe(0);
        });
    });

    describe('getProgressProps', () => {
        it('should return progress props', () => {
            const props = getProgressProps(50);

            expect(props.role).toBe('progressbar');
            expect(props['aria-valuenow']).toBe(50);
            expect(props['aria-valuemin']).toBe(0);
            expect(props['aria-valuemax']).toBe(100);
        });

        it('should include label when provided', () => {
            const props = getProgressProps(75, 100, 'Loading progress');

            expect(props['aria-label']).toBe('Loading progress');
        });

        it('should use custom max value', () => {
            const props = getProgressProps(5, 10);

            expect(props['aria-valuemax']).toBe(10);
        });
    });

    describe('createFocusTrapId', () => {
        it('should create focus trap IDs', () => {
            const ids = createFocusTrapId('modal-1');

            expect(ids.start).toBe('modal-1-focus-start');
            expect(ids.end).toBe('modal-1-focus-end');
        });
    });

    describe('SR_ONLY_STYLES', () => {
        it('should have hidden styles', () => {
            expect(SR_ONLY_STYLES.position).toBe('absolute');
            expect(SR_ONLY_STYLES.width).toBe(1);
            expect(SR_ONLY_STYLES.height).toBe(1);
            expect(SR_ONLY_STYLES.overflow).toBe('hidden');
        });
    });
});
