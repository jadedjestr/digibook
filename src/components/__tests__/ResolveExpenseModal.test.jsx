import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ResolveExpenseModal from '../ResolveExpenseModal';

const mockResolveCycle = vi.fn().mockResolvedValue(undefined);
const mockUpdateExpenseV4 = vi.fn().mockResolvedValue(undefined);

vi.mock('../../hooks/useExpenseOperations', () => ({
  useExpenseOperations: () => ({
    updateExpenseV4: mockUpdateExpenseV4,
    resolveCycle: mockResolveCycle,
  }),
}));

vi.mock('../../db/database-clean', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    dbHelpers: {
      ...actual.dbHelpers,
      getRecurringExpenseTemplate: vi
        .fn()
        .mockResolvedValue({ isVariableAmount: false, name: 'Netflix' }),
    },
  };
});

vi.mock('../../utils/notifications', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const recurringExpense = {
  id: 'e1',
  name: 'Netflix',
  amount: 15.99,
  paidAmount: 0,
  recurringTemplateId: 'tpl-1',
};

const oneOffExpense = {
  id: 'e2',
  name: 'Groceries',
  amount: 50,
  paidAmount: 0,
  recurringTemplateId: null,
};

// Flushes the effect that fetches the template (isVariableAmount/name) so
// assertions about Partial visibility / the forgive follow-up's copy see
// its resolved state rather than the pre-fetch default.
const renderModalAndFlush = async (props = {}) => {
  const utils = render(
    <ResolveExpenseModal
      expense={recurringExpense}
      isOpen
      onClose={vi.fn()}
      {...props}
    />,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return utils;
};

describe('ResolveExpenseModal — Skip / Defer / Forgive', () => {
  beforeEach(() => {
    mockResolveCycle.mockClear();
    mockUpdateExpenseV4.mockClear();
  });
  afterEach(cleanup);

  it('Pay Full resolves immediately, with a single click and no intermediate screen', async () => {
    await renderModalAndFlush();

    fireEvent.click(screen.getByText(/Pay full/));

    expect(mockResolveCycle).toHaveBeenCalledWith('e1', {
      paidAmount: 15.99,
    });
  });

  it('a Partial payment capped at the full amount resolves immediately, no intermediate screen', async () => {
    await renderModalAndFlush();

    fireEvent.click(screen.getByText('Partial payment'));
    const input = screen.getByLabelText('Amount to pay');
    fireEvent.change(input, { target: { value: '100' } }); // over the $15.99 total
    fireEvent.click(screen.getByText('Confirm'));

    expect(mockResolveCycle).toHaveBeenCalledWith('e1', {
      paidAmount: 15.99,
    });
    expect(screen.queryByText(/How do you want to handle/)).toBeNull();
  });

  it('Skip lands on the shortfall-outcome screen without resolving', async () => {
    await renderModalAndFlush();

    fireEvent.click(screen.getByText('Skip'));

    expect(mockResolveCycle).not.toHaveBeenCalled();
    expect(screen.getByText(/How do you want to handle/)).toBeTruthy();
  });

  it('a genuine short Partial also reaches the shortfall-outcome screen', async () => {
    await renderModalAndFlush();

    fireEvent.click(screen.getByText('Partial payment'));
    fireEvent.change(screen.getByLabelText('Amount to pay'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByText('Confirm'));

    expect(mockResolveCycle).not.toHaveBeenCalled();
    expect(screen.getByText(/How do you want to handle/)).toBeTruthy();
  });

  it('choosing "pay after next paycheck" resolves with shortfallOutcome: deferred', async () => {
    await renderModalAndFlush();

    fireEvent.click(screen.getByText('Skip'));
    fireEvent.click(screen.getByText(/pay this after my next paycheck/i));

    expect(mockResolveCycle).toHaveBeenCalledWith('e1', {
      paidAmount: 0,
      shortfallOutcome: 'deferred',
    });
  });

  it('choosing "I don’t owe this" lands on the forgive follow-up without resolving', async () => {
    await renderModalAndFlush();

    fireEvent.click(screen.getByText('Skip'));
    fireEvent.click(screen.getByText(/don.t owe this anymore/i));

    expect(mockResolveCycle).not.toHaveBeenCalled();
    expect(screen.getByText(/Also stop future bills/)).toBeTruthy();
  });

  it('forgive follow-up "Yes, pause it" resolves with forgiven + pauseTemplateOnForgive: true', async () => {
    await renderModalAndFlush();

    fireEvent.click(screen.getByText('Skip'));
    fireEvent.click(screen.getByText(/don.t owe this anymore/i));
    fireEvent.click(screen.getByText('Yes, pause it'));

    expect(mockResolveCycle).toHaveBeenCalledWith('e1', {
      paidAmount: 0,
      shortfallOutcome: 'forgiven',
      pauseTemplateOnForgive: true,
    });
  });

  it('forgive follow-up "No, keep it active" resolves with forgiven + pauseTemplateOnForgive: false', async () => {
    await renderModalAndFlush();

    fireEvent.click(screen.getByText('Skip'));
    fireEvent.click(screen.getByText(/don.t owe this anymore/i));
    fireEvent.click(screen.getByText('No, keep it active'));

    expect(mockResolveCycle).toHaveBeenCalledWith('e1', {
      paidAmount: 0,
      shortfallOutcome: 'forgiven',
      pauseTemplateOnForgive: false,
    });
  });

  it('Back navigates shortfallOutcome -> choose, and forgivenFollowup -> shortfallOutcome', async () => {
    await renderModalAndFlush();

    fireEvent.click(screen.getByText('Skip'));
    fireEvent.click(screen.getByText(/don.t owe this anymore/i));
    expect(screen.getByText(/Also stop future bills/)).toBeTruthy();

    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText(/How do you want to handle/)).toBeTruthy();

    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByText(/Pay full/)).toBeTruthy();
    expect(mockResolveCycle).not.toHaveBeenCalled();
  });

  it('a one-off/Balance Due expense never shows Skip or reaches any new screen (regression)', async () => {
    await renderModalAndFlush({ expense: oneOffExpense });

    expect(screen.queryByText('Skip')).toBeNull();

    fireEvent.click(screen.getByText('Partial payment'));
    fireEvent.change(screen.getByLabelText('Amount to pay'), {
      target: { value: '10' }, // a genuine shortfall against $50
    });
    fireEvent.click(screen.getByText('Confirm'));

    expect(screen.queryByText(/How do you want to handle/)).toBeNull();
    expect(mockUpdateExpenseV4).toHaveBeenCalledWith(
      'e2',
      { paidAmount: 10, status: 'pending' },
      false,
    );
    expect(mockResolveCycle).not.toHaveBeenCalled();
  });
});
