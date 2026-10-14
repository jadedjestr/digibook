import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CreateAccountModal from '../CreateAccountModal';

const mockAddAccount = vi.hoisted(() => vi.fn());
vi.mock('../../db/database-clean', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    dbHelpers: { ...actual.dbHelpers, addAccount: mockAddAccount },
  };
});

vi.mock('../../utils/notifications', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const setup = () => {
  const onAccountCreated = vi.fn();
  render(
    <CreateAccountModal
      isOpen
      onClose={vi.fn()}
      onAccountCreated={onAccountCreated}
    />,
  );
  return { onAccountCreated };
};

afterEach(() => {
  cleanup();
  mockAddAccount.mockReset();
});

describe('CreateAccountModal — starting balance', () => {
  it('tells the browser to accept cents', () => {
    // A number box with no step only accepts whole numbers, so a real browser
    // marked 1.72 invalid and the .glass-input:invalid style painted the box
    // red. jsdom doesn't enforce the step rule, so check the setting itself.
    setup();
    expect(screen.getByLabelText('Starting Balance')).toHaveAttribute(
      'step',
      '0.01',
    );
  });

  it('saves the amount with its cents', async () => {
    mockAddAccount.mockResolvedValue('acc-1');
    const { onAccountCreated } = setup();
    fireEvent.change(screen.getByLabelText('Account Name'), {
      target: { value: 'Chime Savings' },
    });
    fireEvent.change(screen.getByLabelText('Starting Balance'), {
      target: { value: '1.72' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Account/ }));

    await waitFor(() => expect(mockAddAccount).toHaveBeenCalled());
    expect(mockAddAccount).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Chime Savings', currentBalance: 1.72 }),
    );
    await waitFor(() => expect(onAccountCreated).toHaveBeenCalled());
  });
});
