import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// After a payment the app reloads accounts and expenses. Started together, the
// expenses read (every bill, ever) queues ahead of the accounts reload's many
// small reads: measured at ten years of data, the accounts reload took 85 ms
// instead of 3 ms. So they run one after the other.

const order = [];
const reloadAccounts = vi.fn(async () => {
  order.push('accounts:start');
  await new Promise(resolve => setTimeout(resolve, 5));
  order.push('accounts:end');
});
const reloadExpenses = vi.fn(async () => {
  order.push('expenses:start');
  await new Promise(resolve => setTimeout(resolve, 5));
  order.push('expenses:end');
});

vi.mock('../../stores/useAppStore', () => ({
  useAccounts: () => [],
  useLoans: () => [],
  useCreditCards: () => [],
  useFixedExpenses: () => [{ id: 'e1', amount: 100, paidAmount: 0 }],
  useAddExpense: () => vi.fn(),
  useRemoveExpense: () => vi.fn(),
  useUpdateExpense: () => vi.fn(),
  useRefreshTemplates: () => vi.fn(),
  useReloadAccounts: () => reloadAccounts,
  useReloadExpenses: () => reloadExpenses,
}));

vi.mock('../../db/database-clean', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    dbHelpers: { ...actual.dbHelpers, resolveCycle: vi.fn() },
  };
});

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../utils/notifications', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { dbHelpers } from '../../db/database-clean';
import { useExpenseOperations } from '../useExpenseOperations';

const BOTH_IN_ORDER = [
  'accounts:start',
  'accounts:end',
  'expenses:start',
  'expenses:end',
];

describe('reloading after a payment', () => {
  beforeEach(() => {
    order.length = 0;
    vi.clearAllMocks();
    reloadAccounts.mockImplementation(async () => {
      order.push('accounts:start');
      await new Promise(resolve => setTimeout(resolve, 5));
      order.push('accounts:end');
    });
    dbHelpers.resolveCycle.mockResolvedValue({});
  });

  it('reloads accounts, and only then expenses', async () => {
    const { result } = renderHook(() => useExpenseOperations());

    await act(async () => {
      await result.current.resolveCycle('e1', { paidAmount: 100 });
    });

    expect(order).toEqual(BOTH_IN_ORDER);
  });

  it('still reloads both, in order, when the payment fails', async () => {
    dbHelpers.resolveCycle.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useExpenseOperations());

    await act(async () => {
      await expect(
        result.current.resolveCycle('e1', { paidAmount: 100 }),
      ).rejects.toThrow('boom');
    });

    expect(order).toEqual(BOTH_IN_ORDER);
  });

  it('still reloads expenses when the accounts reload itself fails', async () => {
    reloadAccounts.mockRejectedValue(new Error('accounts failed'));
    const { result } = renderHook(() => useExpenseOperations());

    await act(async () => {
      await expect(
        result.current.resolveCycle('e1', { paidAmount: 100 }),
      ).rejects.toThrow();
    });

    expect(reloadExpenses).toHaveBeenCalled();
  });
});
