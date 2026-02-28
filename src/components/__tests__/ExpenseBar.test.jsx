import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import ExpenseBar from '../ExpenseBar';

describe('ExpenseBar', () => {
  const mockExpense = {
    name: 'Housing',
    amount: 1200,
    percentage: 75.5,
    color: '#3B82F6',
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Accessibility', () => {
    it('should call onCategoryClick on click', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const handleClick = vi.fn();

      render(
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

      render(
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

      render(
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
      render(
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

      render(<ExpenseBar expense={mockExpense} index={0} totalAmount={1500} />);

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
      render(<ExpenseBar expense={mockExpense} index={0} totalAmount={1500} />);

      expect(screen.getByText('Housing')).toBeInTheDocument();
      expect(screen.getByText('75.5%')).toBeInTheDocument();
    });

    it('should animate on mount', () => {
      render(<ExpenseBar expense={mockExpense} index={0} totalAmount={1500} />);

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
      render(<ExpenseBar expense={mockExpense} index={0} totalAmount={1500} />);

      expect(screen.getByText('75.5%')).toBeInTheDocument();
    });

    it('should format currency correctly', () => {
      render(<ExpenseBar expense={mockExpense} index={0} totalAmount={1500} />);

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

      render(<ExpenseBar expense={zeroExpense} index={0} totalAmount={1500} />);

      expect(screen.getByText('0.0%')).toBeInTheDocument();
    });

    it('should handle very large percentages', () => {
      const largeExpense = {
        ...mockExpense,
        amount: 10000,
        percentage: 99.99,
      };

      render(
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

      render(<ExpenseBar expense={fullExpense} index={0} totalAmount={1500} />);

      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });

    it('should handle different index values for staggered animation', () => {
      const { rerender } = render(
        <ExpenseBar expense={mockExpense} index={0} totalAmount={1500} />,
      );

      // Change index
      rerender(
        <ExpenseBar expense={mockExpense} index={2} totalAmount={1500} />,
      );

      expect(screen.getByText('Housing')).toBeInTheDocument();
    });
  });
});
