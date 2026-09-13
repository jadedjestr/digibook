import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';

import { PrivacyProvider } from '../../contexts/PrivacyContext';
import ProjectedBalanceCard from '../ProjectedBalanceCard';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const accounts = [
  { id: 'a1', name: 'Checking', currentBalance: 500, isDefault: true },
  { id: 'a2', name: 'Savings', currentBalance: 9000, isDefault: false },
];

const renderCard = props =>
  render(
    <PrivacyProvider>
      <ProjectedBalanceCard accounts={accounts} {...props} />
    </PrivacyProvider>,
  );

describe('ProjectedBalanceCard', () => {
  test('subtracts bills due this week from the balance', () => {
    renderCard({ summaryTotals: { payThisWeekTotal: 200 } });
    expect(screen.getByText('$300.00')).toBeInTheDocument();
  });

  // The point of the income feature: a paycheck arriving before the bills
  // are due should be visible here, or the card answers "can I make it to
  // Friday?" wrongly.
  test('counts an expected paycheck', () => {
    renderCard({
      pendingTransactions: [{ accountId: 'a1', amount: 1200 }],
      summaryTotals: { payThisWeekTotal: 200 },
    });
    expect(screen.getByText('$1,500.00')).toBeInTheDocument();
  });

  test('counts spending that has not cleared yet', () => {
    renderCard({
      pendingTransactions: [{ accountId: 'a1', amount: -125.5 }],
      summaryTotals: { payThisWeekTotal: 200 },
    });
    expect(screen.getByText('$174.50')).toBeInTheDocument();
  });

  test('ignores pending rows belonging to other accounts', () => {
    renderCard({
      pendingTransactions: [{ accountId: 'a2', amount: 5000 }],
      summaryTotals: { payThisWeekTotal: 200 },
    });
    expect(screen.getByText('$300.00')).toBeInTheDocument();
  });

  test('still works with no pending transactions at all', () => {
    renderCard({ summaryTotals: { payThisWeekTotal: 0 } });
    expect(screen.getByText('$500.00')).toBeInTheDocument();
  });
});
