import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import EditExpenseModal from '../EditExpenseModal';

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
  {
    id: 'acc1',
    name: 'Everyday Checking',
    type: 'checking',
    currentBalance: 500,
  },
  { id: 'acc2', name: 'Savings', type: 'savings', currentBalance: 900 },
];

const oneOff = overrides => ({
  id: 'e1',
  name: 'Temu',
  amount: 100,
  paidAmount: 0,
  dueDate: '2026-10-20',
  accountId: 'acc1',
  creditCardId: null,
  recurringTemplateId: null,
  targetCreditCardId: null,
  targetLoanId: null,
  ...overrides,
});

const setup = (expense, props = {}) => {
  const handlers = {
    onClose: vi.fn(),
    onSave: vi.fn().mockResolvedValue(undefined),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onSkipOrStop: vi.fn(),
  };
  render(
    <EditExpenseModal
      expense={expense}
      isOpen
      accounts={accounts}
      creditCards={[]}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

const type = (label, value) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const save = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

afterEach(cleanup);

describe('EditExpenseModal — seeding', () => {
  it('seeds the amount from the bill total, not the remaining balance', () => {
    // The priority row shows amount - paidAmount. Seeding from that would save
    // the remaining balance back as the total.
    setup(oneOff({ amount: 100, paidAmount: 40 }));
    expect(screen.getByLabelText('Amount')).toHaveValue('100');
    expect(screen.getByText(/Paid so far \$40\.00/)).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    setup(oneOff(), { isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('EditExpenseModal — saving', () => {
  it('sends only the keys that changed', async () => {
    const { onSave, onClose } = setup(oneOff());
    type('Name', 'Temu order');
    save();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith('e1', { name: 'Temu order' });
    expect(onClose).toHaveBeenCalled();
  });

  it('closes without writing when nothing changed', () => {
    const { onSave, onClose } = setup(oneOff());
    save();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('parses a typed amount at the edge, accepting $ and commas', async () => {
    const { onSave } = setup(oneOff());
    type('Amount', '$1,200.50');
    save();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith('e1', { amount: 1200.5 });
  });

  it('rejects an unreadable amount instead of substituting a number', () => {
    const { onSave } = setup(oneOff());
    type('Amount', 'abc');
    save();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid amount');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('rejects a blank name', () => {
    const { onSave } = setup(oneOff());
    type('Name', '   ');
    save();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('rejects an amount at or below what is already paid', () => {
    // The database accepts these and leaves a bill that is neither owed nor paid.
    const { onSave } = setup(oneOff({ amount: 100, paidAmount: 40 }));
    for (const value of ['40', '10']) {
      type('Amount', value);
      save();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Enter more than the $40.00 already paid',
      );
    }
    expect(onSave).not.toHaveBeenCalled();
  });

  it('accepts an amount just above what is paid', async () => {
    const { onSave } = setup(oneOff({ amount: 100, paidAmount: 40 }));
    type('Amount', '40.01');
    save();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith('e1', { amount: 40.01 });
  });

  it('rejects zero on an unpaid bill', () => {
    const { onSave } = setup(oneOff());
    type('Amount', '0');
    save();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter an amount above $0.00',
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it('lets a legacy bill already at its paid amount still be renamed', async () => {
    const { onSave } = setup(oneOff({ amount: 40, paidAmount: 40 }));
    type('Name', 'Renamed');
    save();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith('e1', { name: 'Renamed' });
  });

  it('stays open when the write fails, so edits are not lost', async () => {
    const { onSave, onClose } = setup(oneOff());
    onSave.mockRejectedValueOnce(new Error('nope'));
    type('Name', 'Changed');
    save();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Save changes' }),
      ).toBeEnabled(),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Name')).toHaveValue('Changed');
  });
});

describe('EditExpenseModal — locked fields', () => {
  const cardBill = oneOff({
    name: 'Apple Card Payment',
    amount: 1374.34,
    recurringTemplateId: 't1',
    targetCreditCardId: 'c1',
  });

  it('disables the amount of a card payment and explains where to change it', () => {
    setup(cardBill);
    expect(screen.getByLabelText('Amount')).toBeDisabled();
    expect(screen.getByText(/Priced from your card/)).toBeInTheDocument();
    expect(screen.getByLabelText('Due date')).toBeDisabled();
  });

  it('saving a rename on a locked bill sends only the name', async () => {
    const { onSave } = setup(cardBill);
    type('Name', 'Apple Card');
    save();
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith('e1', { name: 'Apple Card' });
  });

  it('explains why a repeating bill’s date is locked', () => {
    setup(oneOff({ recurringTemplateId: 't1' }));
    expect(screen.getByLabelText('Due date')).toBeDisabled();
    expect(screen.getByText(/after my next paycheck/)).toBeInTheDocument();
  });

  it('leaves the date editable on a one-off', () => {
    setup(oneOff());
    expect(screen.getByLabelText('Due date')).toBeEnabled();
  });
});

describe('EditExpenseModal — removing a bill', () => {
  it('deletes a one-off only after a confirm step', async () => {
    const { onDelete, onClose } = setup(oneOff());
    fireEvent.click(screen.getByRole('button', { name: 'Delete bill' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('This can’t be undone.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete bill' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('e1'));
    expect(onClose).toHaveBeenCalled();
  });

  it('can back out of the delete confirm', () => {
    const { onDelete } = setup(oneOff());
    fireEvent.click(screen.getByRole('button', { name: 'Delete bill' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Edit bill')).toBeInTheDocument();
  });

  it('says what deleting a Balance Due means', () => {
    setup(oneOff({ name: 'MME (Balance Due)' }), { isBalanceDue: true });
    fireEvent.click(screen.getByRole('button', { name: 'Delete bill' }));
    expect(screen.getByText(/still show it as deferred/)).toBeInTheDocument();
  });

  it('offers skip-or-stop, not delete, for a repeating bill', () => {
    const expense = oneOff({ recurringTemplateId: 't1' });
    const { onSkipOrStop, onDelete } = setup(expense);
    expect(
      screen.queryByRole('button', { name: 'Delete bill' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Skip or stop this bill' }),
    );
    expect(onSkipOrStop).toHaveBeenCalledWith(expense);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('offers no way to delete a bill that already has a payment', () => {
    setup(oneOff({ paidAmount: 40 }));
    expect(
      screen.queryByRole('button', { name: 'Delete bill' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/A payment is already recorded/),
    ).toBeInTheDocument();
  });
});

describe('EditExpenseModal — opened straight to the delete confirm', () => {
  it('starts on the confirm step', () => {
    setup(oneOff(), { initialStep: 'confirmDelete' });
    expect(screen.getByText('Delete this bill?')).toBeInTheDocument();
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });

  it('Cancel closes the modal instead of dropping into the edit form', () => {
    const { onClose, onDelete } = setup(oneOff(), {
      initialStep: 'confirmDelete',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('confirming deletes the bill', async () => {
    const { onDelete, onClose } = setup(oneOff(), {
      initialStep: 'confirmDelete',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete bill' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('e1'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('EditExpenseModal — keyboard', () => {
  it('closes on Escape', () => {
    const { onClose } = setup(oneOff());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
