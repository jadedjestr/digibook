import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PrivacyProvider } from '../../contexts/PrivacyContext';
import { dbHelpers } from '../../db/database-clean';
import { DateUtils } from '../../utils/dateUtils';
import EnhancedLoanCard from '../EnhancedLoanCard';

vi.mock('../../utils/notifications', () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

const receipt = {
  version: 2,
  status: 'active',
  operationId: 'unique-payment',
  cashAmount: 200,
  previousExpensePaidAmount: 100,
  affectedExpenseId: 'bill-1',
  expenseAfter: { amount: 300 },
  cycle: { resolutionAfter: { id: 'resolution-1' } },
};
const loan = {
  id: 'loan-1',
  name: 'Car Loan',
  balance: 9750,
  principalAmount: 10000,
  interestRate: 6,
  dueDate: '2030-01-01',
  targetPayoffDate: '2031-01-01',
  unpaidInterest: -0.004,
  interestAccruedThrough: DateUtils.today(),
  interestStateVersion: 2,
  lastInterestOperation: receipt,
};
const show = (overrides = {}) =>
  render(
    <PrivacyProvider>
      <EnhancedLoanCard
        loan={{ ...loan, ...overrides }}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    </PrivacyProvider>,
  );
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('loan interest controls', () => {
  it('sends the displayed operation/version and explicit reminder decision', async () => {
    const correct = vi
      .spyOn(dbHelpers, 'correctLatestLoanPayment')
      .mockResolvedValue({ corrected: true });
    show();
    fireEvent.click(screen.getByText('Correct latest payment'));
    const amount = screen.getByLabelText('Corrected payment amount');
    expect(amount).toHaveValue(200);
    fireEvent.change(amount, { target: { value: '150' } });
    fireEvent.change(screen.getByLabelText('Corrected shortfall'), {
      target: { value: 'deferred' },
    });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(correct).toHaveBeenCalledWith('loan-1', 'bill-1', 150, {
        operationId: 'unique-payment',
        expectedVersion: 2,
        requestId: expect.any(String),
        shortfallOutcome: 'deferred',
      }),
    );
  });
  it('sends the displayed version for undo', async () => {
    const undo = vi
      .spyOn(dbHelpers, 'undoLastLoanInterestOperation')
      .mockResolvedValue({ undone: true });
    show();
    fireEvent.click(screen.getByText('Undo last payment'));
    await waitFor(() =>
      expect(undo).toHaveBeenCalledWith('loan-1', 'unique-payment', {
        expectedVersion: 2,
      }),
    );
  });
  it('explains why legacy receipt undo is unavailable', () => {
    show({ lastInterestOperation: { ...receipt, version: undefined } });
    expect(screen.queryByText('Undo last payment')).toBeNull();
    expect(
      screen.getByText(/older payment has no safe undo snapshot/),
    ).toBeInTheDocument();
  });

  it('keeps the originally selected operation when loan props change during correction', async () => {
    const correct = vi
      .spyOn(dbHelpers, 'correctLatestLoanPayment')
      .mockRejectedValue(new Error('STALE_WRITE'));
    const view = show();
    fireEvent.click(screen.getByText('Correct latest payment'));
    view.rerender(
      <PrivacyProvider>
        <EnhancedLoanCard
          loan={{
            ...loan,
            interestStateVersion: 3,
            lastInterestOperation: { ...receipt, operationId: 'new-payment' },
          }}
          onEdit={vi.fn()}
          onDelete={vi.fn()}
        />
      </PrivacyProvider>,
    );
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(correct).toHaveBeenCalledWith(
        'loan-1',
        'bill-1',
        200,
        expect.objectContaining({
          operationId: 'unique-payment',
          expectedVersion: 2,
        }),
      ),
    );
  });
});
