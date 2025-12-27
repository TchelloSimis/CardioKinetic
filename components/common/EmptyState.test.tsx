/**
 * Unit tests for EmptyState component
 * 
 * Tests empty state display component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import EmptyState from './EmptyState';
import { AlertCircle, Plus, RefreshCw } from 'lucide-react';

// ============================================================================
// EmptyState TESTS
// ============================================================================

describe('EmptyState', () => {
    it('should render with required props', () => {
        render(<EmptyState icon={AlertCircle} title="No items found" />);
        expect(screen.getByText('No items found')).toBeTruthy();
    });

    it('should render with an icon', () => {
        const { container } = render(<EmptyState icon={AlertCircle} title="Test" />);
        // Check that svg (the icon) is rendered
        expect(container.querySelector('svg')).toBeTruthy();
    });

    it('should render description when provided', () => {
        render(
            <EmptyState
                icon={AlertCircle}
                title="No items"
                description="Try adding some items to get started"
            />
        );
        expect(screen.getByText('Try adding some items to get started')).toBeTruthy();
    });

    it('should render action button when provided', () => {
        const handleAction = vi.fn();
        render(
            <EmptyState
                icon={AlertCircle}
                title="No items"
                actionText="Add Item"
                onAction={handleAction}
            />
        );
        const button = screen.getByText('Add Item');
        expect(button).toBeTruthy();
        fireEvent.click(button);
        expect(handleAction).toHaveBeenCalled();
    });

    it('should not render action button when only actionText is provided without onAction', () => {
        render(
            <EmptyState
                icon={AlertCircle}
                title="No items"
                actionText="Add Item"
            />
        );
        expect(screen.queryByText('Add Item')).toBeNull();
    });

    it('should render secondary action button when provided', () => {
        const handleSecondary = vi.fn();
        render(
            <EmptyState
                icon={AlertCircle}
                title="No items"
                secondaryActionText="Learn More"
                onSecondaryAction={handleSecondary}
            />
        );
        const button = screen.getByText('Learn More');
        expect(button).toBeTruthy();
        fireEvent.click(button);
        expect(handleSecondary).toHaveBeenCalled();
    });

    it('should apply custom className', () => {
        const { container } = render(
            <EmptyState
                icon={AlertCircle}
                title="Test"
                className="custom-class"
            />
        );
        expect(container.querySelector('.custom-class')).toBeTruthy();
    });

    it('should render both actions when provided', () => {
        const handlePrimary = vi.fn();
        const handleSecondary = vi.fn();
        render(
            <EmptyState
                icon={Plus}
                title="Empty"
                actionText="Create"
                onAction={handlePrimary}
                secondaryActionText="Cancel"
                onSecondaryAction={handleSecondary}
            />
        );
        expect(screen.getByText('Create')).toBeTruthy();
        expect(screen.getByText('Cancel')).toBeTruthy();
    });
});
