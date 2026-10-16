import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ChooseFundingAccountModal from '../ChooseFundingAccountModal';

// Account ids are UUID strings (since schema V8). The picker used to
// parseInt the chosen one, so "b7e2…" became NaN and "3f1c…" became 3, and
// the card was saved with no valid paying account ("Not set").
const accounts = [
  {
    id: '3f1c9a2b-0000-4000-8000-000000000001',
    name: 'Checking',
    type: 'checking',
    currentBalance: 1000,
  },
  {
    id: 'b7e2c4d1-0000-4000-8000-000000000002',
    name: 'Savings',
    type: 'savings',
    currentBalance: 2000,
  },
];

const renderModal = props => {
  const onConfirm = vi.fn();
  render(
    <ChooseFundingAccountModal
      isOpen
      cardName='Visa'
      cardId='visa'
      accounts={accounts}
      defaultAccountId={accounts[0].id}
      onConfirm={onConfirm}
      onUseDefault={vi.fn()}
      onCancel={vi.fn()}
      {...props}
    />,
  );
  return onConfirm;
};

const pick = id =>
  fireEvent.change(
    screen.getByLabelText('Select account to pay this credit card'),
    {
      target: { value: id },
    },
  );

describe('ChooseFundingAccountModal', () => {
  it('confirms the exact account picked, not a number made from its id', () => {
    const onConfirm = renderModal();
    pick(accounts[1].id);
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledWith(accounts[1].id);
  });

  it('keeps an id that starts with digits intact', () => {
    const onConfirm = renderModal({ defaultAccountId: accounts[1].id });
    pick(accounts[0].id);
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledWith(accounts[0].id);
  });

  it('confirms the preselected account when nothing is changed', () => {
    const onConfirm = renderModal();
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledWith(accounts[0].id);
  });
});
