import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAppStore } from '../../stores/useAppStore';
import { CategoryChip, CategoryTag } from '../CategoryIndicator';

const categories = [
  { id: 'c-subs', name: 'Subscriptions', icon: '📱', color: '#EC4899' },
];

const bill = overrides => ({
  id: 'e1',
  category: 'Subscriptions',
  categoryId: null,
  ...overrides,
});

const seed = list => act(() => useAppStore.setState({ categories: list }));

beforeEach(() => seed(categories));
afterEach(() => {
  cleanup();
  seed([]);
});

describe('CategoryChip', () => {
  it('shows the category’s picture and names it for screen readers', () => {
    render(<CategoryChip expense={bill()} />);
    const chip = screen.getByRole('img', { name: 'Category: Subscriptions' });
    expect(chip).toHaveTextContent('📱');
  });

  it('tints itself with the category’s own color', () => {
    render(<CategoryChip expense={bill()} />);
    expect(
      screen.getByRole('img').style.getPropertyValue('--category-rgb'),
    ).toBe('236, 72, 153');
  });

  it('uses the built-in card icon for a card payment bill', () => {
    render(
      <CategoryChip expense={bill({ category: 'Credit Card Payment' })} />,
    );
    expect(
      screen.getByRole('img', { name: 'Category: Card payment' }),
    ).toHaveTextContent('💳');
  });

  it('follows a renamed category, since it matches on the id first', () => {
    seed([{ ...categories[0], name: 'Streaming' }]);
    render(
      <CategoryChip
        expense={bill({ categoryId: 'c-subs', category: 'Subscriptions' })}
      />,
    );
    expect(
      screen.getByRole('img', { name: 'Category: Streaming' }),
    ).toBeInTheDocument();
  });

  it('is neutral and says "No category" for a bill without one', () => {
    render(<CategoryChip expense={bill({ category: '' })} />);
    const chip = screen.getByRole('img', { name: 'Category: No category' });
    expect(chip.style.getPropertyValue('--category-rgb')).toBe('162, 169, 180');
  });
});

describe('CategoryTag', () => {
  it('shows the category word, with the full name on hover', () => {
    render(<CategoryTag expense={bill()} />);
    const tag = screen.getByText('Subscriptions');
    expect(tag).toHaveAttribute('title', 'Subscriptions');
    expect(tag.style.getPropertyValue('--category-rgb')).toBe('236, 72, 153');
  });

  it('is hidden from screen readers, because the chip already names the category', () => {
    render(<CategoryTag expense={bill()} />);
    expect(screen.getByText('Subscriptions')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('shows a category the bill names that is not in the table', () => {
    render(<CategoryTag expense={bill({ category: 'Shopping' })} />);
    expect(screen.getByText('Shopping')).toBeInTheDocument();
  });
});
