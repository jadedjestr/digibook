import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';

import { PrivacyProvider } from '../../contexts/PrivacyContext';
import ProjectedBalanceCard from '../ProjectedBalanceCard';

// The card only displays the forecast's first pay period; the math behind
// it (bills, overdue, card-charged bills, paychecks) is tested in
// utils/__tests__/categoryBreakdown.test.js and the starting balance in
// utils/__tests__/accountUtils.test.js.
const renderCard = props =>
  render(
    <PrivacyProvider>
      <ProjectedBalanceCard startingCents={50000} {...props} />
    </PrivacyProvider>,
  );

describe('ProjectedBalanceCard', () => {
  test('shows the money left after the first pay period', () => {
    renderCard({
      firstPeriod: { leftCents: 31000, overdueFromAccountCents: 0 },
    });
    expect(screen.getByText('$310.00')).toBeInTheDocument();
    expect(screen.queryByText(/overdue/)).not.toBeInTheDocument();
  });

  test('says how much of the drop is overdue bills', () => {
    renderCard({
      firstPeriod: { leftCents: 31000, overdueFromAccountCents: 6000 },
    });
    expect(screen.getByText(/Includes/)).toHaveTextContent(
      'Includes $60.00 overdue',
    );
  });

  test('shows a shortfall as a negative amount', () => {
    renderCard({ firstPeriod: { leftCents: -12050 } });
    expect(screen.getByText('-$120.50')).toBeInTheDocument();
  });

  test('without a pay schedule, shows the starting balance and says why', () => {
    renderCard({ firstPeriod: null, showAccountName: false });
    expect(screen.getByText('$500.00')).toBeInTheDocument();
    expect(
      screen.getByText('Set your pay schedule to subtract bills'),
    ).toBeInTheDocument();
  });

  test('names the account when asked to', () => {
    renderCard({
      firstPeriod: { leftCents: 100 },
      accountName: 'Checking',
      showAccountName: true,
    });
    expect(
      screen.getByText('Checking • After bills & pending'),
    ).toBeInTheDocument();
  });
});
