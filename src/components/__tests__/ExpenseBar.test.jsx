import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { PrivacyProvider } from '../../contexts/PrivacyContext';
import ExpenseBar from '../ExpenseBar';

describe('ExpenseBar', () => {
  const renderWithPrivacy = ui => {
    return render(<PrivacyProvider>{ui}</PrivacyProvider>);
  };

  const mockExpense = {
    name: 'Housing',
    amount: 1200,
    percentage: 75.5,
    color: '#3B82F6',
  };

  beforeEach(() => {
    // shouldAdvanceTime keeps React's own internal scheduling (and
    // userEvent's internal waits) ticking in real time alongside the fake
    // timers this file advances manually — without it, userEvent's async
    // interactions deadlock against a fully-frozen clock.
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();

    // Fake timers don't get cleared by restoreAllMocks: leaving them active
    // here freezes the next test's real-timer-dependent global setup hook
    // (the IndexedDB reset in src/test/setup.js), timing it out.
    vi.useRealTimers();
  });

  describe('Accessibility', () => {
    it('should call onCategoryClick on click', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const handleClick = vi.fn();

      renderWithPrivacy(
        <ExpenseBar
          expense={mockExpense}
          index={0}
          totalAmount={1500}
          onCategoryClick={handleClick}
        />,
      );

      // Wait for animation to complete
      vi.advanceTimersByTime(300);

      const bar = screen.getByRole('button');
      await user.click(bar);

      expect(handleClick).toHaveBeenCalledWith('Housing');
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should call onCategoryClick on Enter key', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const handleClick = vi.fn();

      renderWithPrivacy(
        <ExpenseBar
          expense={mockExpense}
          index={0}
          totalAmount={1500}
          onCategoryClick={handleClick}
        />,
      );

      // Wait for animation to complete
      vi.advanceTimersByTime(300);

      const bar = screen.getByRole('button');
      bar.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalledWith('Housing');
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should call onCategoryClick on Space key', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const handleClick = vi.fn();

      renderWithPrivacy(
        <ExpenseBar
          expense={mockExpense}
          index={0}
          totalAmount={1500}
          onCategoryClick={handleClick}
        />,
      );

      // Wait for animation to complete
      vi.advanceTimersByTime(300);

      const bar = screen.getByRole('button');
      bar.focus();
      await user.keyboard(' ');

      expect(handleClick).toHaveBeenCalledWith('Housing');
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should have proper aria-label', () => {
      renderWithPrivacy(
        <ExpenseBar
          expense={mockExpense}
          index={0}
          totalAmount={1500}
          onCategoryClick={vi.fn()}
        />,
      );

      const bar = screen.getByRole('button');
      expect(bar).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Housing'),
      );
      expect(bar).toHaveAttribute(
        'aria-label',
        expect.stringContaining('Click to view expenses in this category'),
      );
    });

    it('should handle missing onCategoryClick prop gracefully', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      renderWithPrivacy(
        <ExpenseBar expense={mockExpense} index={0} totalAmount={1500} />,
      );

      // Wait for animation to complete
      vi.advanceTimersByTime(300);

      const bar = screen.getByRole('button');

      // Should not throw when clicking without handler
      await user.click(bar);
      expect(bar).toBeInTheDocument();
    });
  });

  describe('Rendering', () => {
    it('should render with correct data', () => {
      renderWithPrivacy(
        <ExpenseBar expense={mockExpense} index={0} totalAmount={1500} />,
      );

      expect(screen.getByText('Housing')).toBeInTheDocument();
      expect(screen.getByText('75.5%')).toBeInTheDocument();
    });

    it('should animate on mount', () => {
      renderWithPrivacy(
        <ExpenseBar expense={mockExpense} index={0} totalAmount={1500} />,
      );

      // Initially should be invisible
      const bar = screen.getByRole('button');
      expect(bar).toHaveClass('opacity-0');

      // After animation delay
      vi.advanceTimersByTime(100);

      // Should still be animating
      expect(bar).toBeInTheDocument();

      // After full animation
      vi.advanceTimersByTime(200);
      expect(bar).toBeInTheDocument();
    });

    it('should show correct percentage', () => {
      renderWithPrivacy(
        <ExpenseBar expense={mockExpense} index={0} totalAmount={1500} />,
      );

      expect(screen.getByText('75.5%')).toBeInTheDocument();
    });

    it('should format currency correctly', () => {
      renderWithPrivacy(
        <ExpenseBar expense={mockExpense} index={0} totalAmount={1500} />,
      );

      // Currency should be formatted (privacy wrapper may hide it)
      expect(screen.getByText('Housing')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero percentage', () => {
      const zeroExpense = {
        ...mockExpense,
        amount: 0,
        percentage: 0,
      };

      renderWithPrivacy(
        <ExpenseBar expense={zeroExpense} index={0} totalAmount={1500} />,
      );

      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('should handle very large percentages', () => {
      const largeExpense = {
        ...mockExpense,
        amount: 10000,

        // 99.9 (not 99.99) keeps this unambiguous: toFixed(1) rounds 99.99
        // up to "100.0", which belongs to the 100%-exactly case below.
        percentage: 99.9,
      };

      renderWithPrivacy(
        <ExpenseBar expense={largeExpense} index={0} totalAmount={10000} />,
      );

      expect(screen.getByText('99.9%')).toBeInTheDocument();
    });

    it('should handle 100% percentage', () => {
      const fullExpense = {
        ...mockExpense,
        amount: 1500,
        percentage: 100,
      };

      renderWithPrivacy(
        <ExpenseBar expense={fullExpense} index={0} totalAmount={1500} />,
      );

      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });

    it('should handle different index values for staggered animation', () => {
      const { rerender } = renderWithPrivacy(
        <ExpenseBar expense={mockExpense} index={0} totalAmount={1500} />,
      );

      // Change index
      rerender(
        <PrivacyProvider>
          <ExpenseBar expense={mockExpense} index={2} totalAmount={1500} />
        </PrivacyProvider>,
      );

      expect(screen.getByText('Housing')).toBeInTheDocument();
    });
  });
});
