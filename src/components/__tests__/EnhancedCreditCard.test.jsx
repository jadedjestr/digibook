import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PrivacyProvider } from '../../contexts/PrivacyContext';
import EnhancedCreditCard from '../EnhancedCreditCard';

const mockGetCardPaymentPlan = vi.hoisted(() => vi.fn());
vi.mock('../../db/database-clean', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    dbHelpers: {
      ...actual.dbHelpers,
      getCardPaymentPlan: mockGetCardPaymentPlan,
      getCardBehindPaceWarning: vi.fn().mockResolvedValue(null),
    },
  };
});

const card = {
  id: 'card-1',
  name: 'Apple Card',
  balance: 1500,
  creditLimit: 3000,
  interestRate: 20,
  minimumPayment: 35,
  dueDate: '2099-10-30',
  originalBalance: 1500,
  targetPayoffDate: '2100-10-30',
};

const renderCard = () =>
  render(
    <PrivacyProvider>
      <EnhancedCreditCard
        card={card}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        fundingSourceName='Chime'
      />
    </PrivacyProvider>,
  );

beforeEach(() => mockGetCardPaymentPlan.mockReset());
afterEach(cleanup);

describe('EnhancedCreditCard — monthly payment', () => {
  it('shows a custom payment with a Custom badge', async () => {
    mockGetCardPaymentPlan.mockResolvedValue({
      mode: 'custom',
      billAmount: 99,
    });
    renderCard();
    await waitFor(() => expect(screen.getByText('$99.00')).toBeInTheDocument());
    expect(screen.getByText('Monthly payment')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('shows a calculated payment as coming from the payoff goal', async () => {
    mockGetCardPaymentPlan.mockResolvedValue({
      mode: 'calculated',
      billAmount: 138.95,
    });
    renderCard();
    await waitFor(() =>
      expect(screen.getByText('$138.95')).toBeInTheDocument(),
    );
    expect(screen.getByText('From payoff goal')).toBeInTheDocument();
  });

  it('keeps the card’s own minimum payment separate from what is billed', async () => {
    mockGetCardPaymentPlan.mockResolvedValue({
      mode: 'custom',
      billAmount: 99,
    });
    renderCard();
    await waitFor(() => expect(screen.getByText('$99.00')).toBeInTheDocument());
    expect(screen.getByText('Minimum Payment')).toBeInTheDocument();
    expect(screen.getByText('$35.00')).toBeInTheDocument();
  });

  it('shows no payment line rather than a wrong one when there is no plan', async () => {
    mockGetCardPaymentPlan.mockResolvedValue(null);
    renderCard();
    await waitFor(() => expect(mockGetCardPaymentPlan).toHaveBeenCalled());
    expect(screen.queryByText('Monthly payment')).toBeNull();
    expect(screen.getByText('Minimum Payment')).toBeInTheDocument();
  });
});
