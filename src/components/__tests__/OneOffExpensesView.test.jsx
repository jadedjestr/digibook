import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import OneOffExpensesView from '../OneOffExpensesView';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockNotify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));
vi.mock('../../utils/notifications', () => ({ notify: mockNotify }));

vi.mock('../../db/database-clean', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    dbHelpers: { ...actual.dbHelpers, updateFixedExpenseV4: vi.fn() },
  };
});
vi.mock('../../services/recurringExpenseService', () => ({
  createTemplate: vi.fn(),
}));

// Far-future dates so the "future one-offs" filter doesn't depend on today.
const bill = overrides => ({
  id: 'e1',
  name: 'Temu',
  amount: 100,
  paidAmount: 0,
  dueDate: '2099-06-15',
  accountId: 'acc1',
  creditCardId: null,
  recurringTemplateId: null,
  targetCreditCardId: null,
  targetLoanId: null,
  ...overrides,
});

const paycheckService = { calculateExpenseStatus: () => 'Pending' };

const setup = (expenses, props = {}) => {
  const handlers = {
    onMarkAsPaid: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onUpdateExpense: vi.fn(),
    onReloadExpenses: vi.fn().mockResolvedValue(undefined),
    onEdit: vi.fn(),
    onRequestDelete: vi.fn(),
  };
  render(
    <OneOffExpensesView
      expenses={expenses}
      paycheckService={paycheckService}
      paycheckDates={{}}
      accounts={[{ id: 'acc1', name: 'Checking' }]}
      creditCards={[]}
      loans={[]}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

const selectEveryBill = () => {
  for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box);
};

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mockNotify.success.mockClear();
  mockNotify.error.mockClear();
});

describe('OneOffExpensesView — per-bill Delete', () => {
  it('asks the page to confirm instead of deleting on the spot', () => {
    const expense = bill();
    const { onDelete, onRequestDelete } = setup([expense]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onRequestDelete).toHaveBeenCalledWith(expense);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('hides Delete on a bill that already has a payment', () => {
    // Deleting is a bare soft-delete that reverses no balances, so the money
    // already paid would be left with no bill to explain it.
    setup([bill({ paidAmount: 40 })]);
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('hides Delete on a legacy card payment bill that belongs to a card', () => {
    setup([bill({ targetCreditCardId: 'c1' })]);
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('keeps Delete on a Balance Due', () => {
    setup([bill({ id: 'bd', targetCreditCardId: 'c1' })], {
      balanceDueExpenseIds: new Set(['bd']),
    });
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('shows no Delete when the page gives no way to confirm it', () => {
    setup([bill()], { onRequestDelete: undefined });
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });
});

describe('OneOffExpensesView — Delete Selected', () => {
  it('deletes every selected bill when all are deletable', async () => {
    const { onDelete } = setup([
      bill({ id: 'a', name: 'A' }),
      bill({ id: 'b', name: 'B' }),
    ]);
    selectEveryBill();
    fireEvent.click(screen.getByRole('button', { name: /Delete Selected/ }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(2));
    expect(onDelete).toHaveBeenCalledWith('a');
    expect(onDelete).toHaveBeenCalledWith('b');
  });

  it('keeps a bill with a payment and says so before deleting the rest', async () => {
    const { onDelete } = setup([
      bill({ id: 'a', name: 'A' }),
      bill({ id: 'paid', name: 'Paid', paidAmount: 40 }),
    ]);
    selectEveryBill();
    fireEvent.click(screen.getByRole('button', { name: /Delete Selected/ }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    expect(onDelete).toHaveBeenCalledWith('a');
    expect(onDelete).not.toHaveBeenCalledWith('paid');
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('1 will be kept'),
    );
  });

  it('refuses, without asking, when nothing selected can be deleted', () => {
    const { onDelete } = setup([bill({ id: 'paid', paidAmount: 40 })]);
    selectEveryBill();
    fireEvent.click(screen.getByRole('button', { name: /Delete Selected/ }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
    expect(mockNotify.error).toHaveBeenCalledWith(
      expect.stringContaining('None of the selected bills can be deleted'),
    );
  });
});
