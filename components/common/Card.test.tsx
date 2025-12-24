/**
 * Unit tests for Card component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Card from './Card';

describe('Card Component', () => {
    it('should render children', () => {
        render(<Card>Card content</Card>);
        expect(screen.getByText('Card content')).toBeTruthy();
    });

    it('should apply md size by default', () => {
        const { container } = render(<Card>Content</Card>);
        const card = container.firstChild as HTMLElement;
        expect(card.className).toContain('rounded-2xl');
    });

    it('should apply sm size', () => {
        const { container } = render(<Card size="sm">Small</Card>);
        const card = container.firstChild as HTMLElement;
        expect(card.className).toContain('rounded-xl');
    });

    it('should apply lg size', () => {
        const { container } = render(<Card size="lg">Large</Card>);
        const card = container.firstChild as HTMLElement;
        expect(card.className).toContain('rounded-3xl');
    });

    it('should apply default variant', () => {
        const { container } = render(<Card>Default</Card>);
        const card = container.firstChild as HTMLElement;
        expect(card.className).toContain('border');
        expect(card.className).toContain('bg-white');
    });

    it('should apply elevated variant', () => {
        const { container } = render(<Card variant="elevated">Elevated</Card>);
        const card = container.firstChild as HTMLElement;
        expect(card.className).toContain('shadow-lg');
    });

    it('should apply outlined variant', () => {
        const { container } = render(<Card variant="outlined">Outlined</Card>);
        const card = container.firstChild as HTMLElement;
        expect(card.className).toContain('border-2');
        expect(card.className).toContain('bg-transparent');
    });

    it('should apply filled variant', () => {
        const { container } = render(<Card variant="filled">Filled</Card>);
        const card = container.firstChild as HTMLElement;
        expect(card.className).toContain('bg-neutral-100');
    });

    it('should render header', () => {
        render(<Card header={<span>Header</span>}>Content</Card>);
        expect(screen.getByText('Header')).toBeTruthy();
    });

    it('should render footer', () => {
        render(<Card footer={<span>Footer</span>}>Content</Card>);
        expect(screen.getByText('Footer')).toBeTruthy();
    });

    it('should remove padding when noPadding is true', () => {
        const { container } = render(<Card noPadding>No Padding</Card>);
        // Content div should not have padding classes
        const contentDiv = container.querySelector('div > div') as HTMLElement;
        expect(contentDiv.className).not.toContain('p-');
    });

    it('should apply custom className', () => {
        const { container } = render(<Card className="custom-class">Custom</Card>);
        const card = container.firstChild as HTMLElement;
        expect(card.className).toContain('custom-class');
    });
});
