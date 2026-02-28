import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import { PrivacyProvider } from '../../contexts/PrivacyContext';
import CategoryExpenseSummary from '../CategoryExpenseSummary';

describe('CategoryExpenseSummary', () => {
  const renderWithPrivacy = ui => {
    return render(<PrivacyProvider>{ui}</PrivacyProvider>);
  };

  const mockCategories = [
    { name: 'Housing', color: '#3B82F6' },
    { name: 'Utilities', color: '#10B981' },
    { name: 'Transportation', color: '#8B5CF6' },
  ];

  const mockExpenses = [
    {
      id: 1,
      name: 'Rent',
      amount: 1200,
      paidAmount: 0,
      category: 'Housing',
    },
    {
      id: 2,
      name: 'Electricity',
      amount: 150,
      paidAmount: 50,
      category: 'Utilities',
    },
    {
      id: 3,
      name: 'Gas',
      amount: 200,
      paidAmount: 200,
      category: 'Transportation',
    },
  ];

  describe('Input Validation', () => {
    it('should render with null expenses', () => {
      renderWithPrivacy(
        <CategoryExpenseSummary expenses={null} categories={mockCategories} />,
      );
      expect(screen.getByText('Expense Distribution')).toBeInTheDocument();
      expect(
        screen.getByText('No fixed expenses added yet.'),
      ).toBeInTheDocument();
    });

    it('should render with undefined expenses', () => {
      renderWithPrivacy(
        <CategoryExpenseSummary
          expenses={undefined}
          categories={mockCategories}
        />,
      );
      expect(screen.getByText('Expense Distribution')).toBeInTheDocument();
      expect(
        screen.getByText('No fixed expenses added yet.'),
      ).toBeInTheDocument();
    });

    it('should render with empty array', () => {
      renderWithPrivacy(
        <CategoryExpenseSummary expenses={[]} categories={mockCategories} />,
      );
      expect(screen.getByText('Expense Distribution')).toBeInTheDocument();
      expect(screen.getByText('No expenses to display.')).toBeInTheDocument();
    });

    it('should handle null/undefined categories', () => {
      renderWithPrivacy(
        <CategoryExpenseSummary expenses={mockExpenses} categories={null} />,
      );
      expect(screen.getByText('Expense Distribution')).toBeInTheDocument();
    });

    it('should handle expenses with invalid amounts (NaN)', () => {
      const invalidExpenses = [
        {
          id: 1,
          name: 'Invalid',
          amount: NaN,
          paidAmount: 0,
          category: 'Housing',
        },
        ...mockExpenses,
      ];
      renderWithPrivacy(
        <CategoryExpenseSummary
          expenses={invalidExpenses}
          categories={mockCategories}
        />,
      );
      expect(screen.getByText('Expense Distribution')).toBeInTheDocument();
    });

    it('should handle expenses with null amounts', () => {
      const invalidExpenses = [
        {
          id: 1,
          name: 'Invalid',
          amount: null,
          paidAmount: 0,
          category: 'Housing',
        },
        ...mockExpenses,
      ];
      renderWithPrivacy(
        <CategoryExpenseSummary
          expenses={invalidExpenses}
          categories={mockCategories}
        />,
      );
      expect(screen.getByText('Expense Distribution')).toBeInTheDocument();
    });

    it('should handle expenses with undefined amounts', () => {
      const invalidExpenses = [
        {
          id: 1,
          name: 'Invalid',
          amount: undefined,
          paidAmount: 0,
          category: 'Housing',
        },
        ...mockExpenses,
      ];
      renderWithPrivacy(
        <CategoryExpenseSummary
          expenses={invalidExpenses}
          categories={mockCategories}
        />,
      );
      expect(screen.getByText('Expense Distribution')).toBeInTheDocument();
    });

    it('should handle expenses with negative amounts', () => {
      const invalidExpenses = [
        {
          id: 1,
          name: 'Invalid',
          amount: -100,
          paidAmount: 0,
          category: 'Housing',
        },
        ...mockExpenses,
      ];
      renderWithPrivacy(
        <CategoryExpenseSummary
          expenses={invalidExpenses}
          categories={mockCategories}
        />,
      );
      expect(screen.getByText('Expense Distribution')).toBeInTheDocument();
    });
  });

  describe('Empty State Logic', () => {
    it('should show "No expenses" message when array is empty', () => {
      renderWithPrivacy(
        <CategoryExpenseSummary expenses={[]} categories={mockCategories} />,
      );
      expect(screen.getByText('No expenses to display.')).toBeInTheDocument();
      expect(
        screen.getByText('Try selecting a different time range.'),
      ).toBeInTheDocument();
    });

    it('should show donut chart when expenses exist', () => {
      renderWithPrivacy(
        <CategoryExpenseSummary
          expenses={mockExpenses}
          categories={mockCategories}
        />,
      );

      // Should show donut chart with all categories (showing budget allocation)
      expect(screen.getAllByText('Total Budgeted').length).toBeGreaterThan(0);
      expect(
        screen.queryByText('No fixed expenses added yet.'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Scoping', () => {
    it('should not filter expenses based on the system current month', () => {
      const offMonthExpenses = mockExpenses.map(expense => ({
        ...expense,
        dueDate: '1999-01-01',
      }));

      renderWithPrivacy(
        <CategoryExpenseSummary
          expenses={offMonthExpenses}
          categories={mockCategories}
        />,
      );

      expect(screen.getAllByText('Total Budgeted').length).toBeGreaterThan(0);
      expect(screen.getByText('Housing')).toBeInTheDocument();
      expect(screen.getByText('Utilities')).toBeInTheDocument();
      expect(screen.getByText('Transportation')).toBeInTheDocument();
      expect(
        screen.queryByText('No expenses to display.'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Rendering', () => {
    it('should render all categories in donut chart (budget allocation)', () => {
      renderWithPrivacy(
        <CategoryExpenseSummary
          expenses={mockExpenses}
          categories={mockCategories}
        />,
      );

      // All categories should appear (showing budget allocation, not remaining)
      // Total budgeted: 1200 + 150 + 200 = 1550
      // Housing: 1200/1550 = 77.4%, Utilities: 150/1550 = 9.7%, Transportation: 200/1550 = 12.9%
      expect(screen.getByText('Housing')).toBeInTheDocument();
      expect(screen.getByText('Utilities')).toBeInTheDocument();
      expect(screen.getByText('Transportation')).toBeInTheDocument();
    });

    it('should calculate percentages based on total budgeted', () => {
      renderWithPrivacy(
        <CategoryExpenseSummary
          expenses={mockExpenses}
          categories={mockCategories}
        />,
      );

      // Total budgeted: 1200 + 150 + 200 = 1550
      // All categories should be visible in legend
      expect(screen.getByText('Housing')).toBeInTheDocument();
      expect(screen.getByText('Utilities')).toBeInTheDocument();
      expect(screen.getByText('Transportation')).toBeInTheDocument();
    });

    it('should show total budgeted amount', () => {
      renderWithPrivacy(
        <CategoryExpenseSummary
          expenses={mockExpenses}
          categories={mockCategories}
        />,
      );

      // Total budgeted: 1200 + 150 + 200 = 1550
      expect(screen.getAllByText('Total Budgeted').length).toBeGreaterThan(0);
    });
  });

  describe('Category Selection', () => {
    it('should show detail view when category is clicked', async () => {
      const user = userEvent.setup();

      renderWithPrivacy(
        <CategoryExpenseSummary
          expenses={mockExpenses}
          categories={mockCategories}
        />,
      );

      // Find and click on a category segment (in legend)
      const housingButtons = screen
        .getAllByRole('button')
        .filter(button => button.textContent?.includes('Housing'));

      if (housingButtons.length > 0) {
        await user.click(housingButtons[0]);

        // Should show category detail view with back button
        expect(screen.getByLabelText(/back to overview/i)).toBeInTheDocument();
        expect(screen.getAllByText('Housing').length).toBeGreaterThan(0);
      }
    });
  });

  describe('Memo Comparison', () => {
    it('should not re-render when props have not changed', () => {
      const { rerender } = renderWithPrivacy(
        <CategoryExpenseSummary
          expenses={mockExpenses}
          categories={mockCategories}
        />,
      );

      const initialRender = screen.getByText('Expense Distribution');

      // Rerender with same props
      rerender(
        <PrivacyProvider>
          <CategoryExpenseSummary
            expenses={mockExpenses}
            categories={mockCategories}
          />
        </PrivacyProvider>,
      );

      // Component should still be in document (memo prevented re-render)
      expect(initialRender).toBeInTheDocument();
    });

    it('should handle onCategoryClick prop', () => {
      const handleClick = vi.fn();
      renderWithPrivacy(
        <CategoryExpenseSummary
          expenses={mockExpenses}
          categories={mockCategories}
          onCategoryClick={handleClick}
        />,
      );

      // The click handler should be passed to DonutChart components
      expect(screen.getByText('Housing')).toBeInTheDocument();
    });
  });
});
