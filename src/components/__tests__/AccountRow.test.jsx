import { render, fireEvent, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';

import { PrivacyProvider } from '../../contexts/PrivacyContext';
import AccountRow from '../AccountRow';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const baseAccount = {
  id: 'acc-1',
  name: 'Chase Checking',
  currentBalance: 1000,
  isDefault: false,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const renderRow = (accountOverrides = {}, props = {}) =>
  render(
    <PrivacyProvider>
      <AccountRow
        account={{ ...baseAccount, ...accountOverrides }}
        projectedBalance={props.projectedBalance ?? 1000}
        onUpdateAccount={props.onUpdateAccount ?? vi.fn()}
        onSetDefault={props.onSetDefault ?? vi.fn()}
        onDelete={props.onDelete ?? vi.fn()}
      />
    </PrivacyProvider>,
  );

describe('AccountRow', () => {
  test('renders the account name and both stat values', () => {
    renderRow({}, { projectedBalance: 850 });
    expect(screen.getByText('Chase Checking')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Projected')).toBeInTheDocument();
    expect(screen.getByText('$1,000.00')).toBeInTheDocument();
    expect(screen.getByText('$850.00')).toBeInTheDocument();
  });

  test('does not show the Default badge when isDefault is false', () => {
    renderRow({ isDefault: false });
    expect(screen.queryByText('Default')).not.toBeInTheDocument();
  });

  test('shows the Default badge and accent styling when isDefault is true', () => {
    const { container } = renderRow({ isDefault: true });
    expect(screen.getByText('Default')).toBeInTheDocument();
    expect(
      container.querySelector('.glass-row-list-item--accent'),
    ).not.toBeNull();
  });

  test('projected balance turns yellow only when behind the current balance', () => {
    const { rerender, container } = render(
      <PrivacyProvider>
        <AccountRow
          account={baseAccount}
          projectedBalance={1000}
          onUpdateAccount={vi.fn()}
          onSetDefault={vi.fn()}
          onDelete={vi.fn()}
        />
      </PrivacyProvider>,
    );
    expect(container.querySelector('.text-yellow-400')).toBeNull();

    rerender(
      <PrivacyProvider>
        <AccountRow
          account={baseAccount}
          projectedBalance={400}
          onUpdateAccount={vi.fn()}
          onSetDefault={vi.fn()}
          onDelete={vi.fn()}
        />
      </PrivacyProvider>,
    );
    expect(container.querySelector('.text-yellow-400')).not.toBeNull();
  });

  test('clicking the star calls onSetDefault with the account id', () => {
    const onSetDefault = vi.fn();
    renderRow({}, { onSetDefault });
    fireEvent.click(screen.getByTitle('Set as Default'));
    expect(onSetDefault).toHaveBeenCalledTimes(1);
    expect(onSetDefault).toHaveBeenCalledWith('acc-1');
  });

  test('clicking the trash calls onDelete with the account id', () => {
    const onDelete = vi.fn();
    renderRow({}, { onDelete });
    fireEvent.click(screen.getByTitle('Delete Account'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('acc-1');
  });

  test('the star shows the default title/fill state when isDefault is true', () => {
    renderRow({ isDefault: true });
    expect(screen.getByTitle('Default Account')).toBeInTheDocument();
  });

  test('editing the name calls onUpdateAccount with the new name', () => {
    const onUpdateAccount = vi.fn();
    renderRow({}, { onUpdateAccount });

    fireEvent.click(screen.getAllByTitle('Click to edit')[0]);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Renamed Account' },
    });
    fireEvent.click(screen.getByTitle('Save (Enter)'));

    expect(onUpdateAccount).toHaveBeenCalledWith(
      'acc-1',
      { name: 'Renamed Account' },
      '2026-01-01T00:00:00.000Z',
    );
  });

  test('editing the current balance calls onUpdateAccount with the new balance', () => {
    const onUpdateAccount = vi.fn();
    renderRow({}, { onUpdateAccount });

    fireEvent.click(screen.getAllByTitle('Click to edit')[1]);
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '250' },
    });
    fireEvent.click(screen.getByTitle('Save (Enter)'));

    expect(onUpdateAccount).toHaveBeenCalledWith(
      'acc-1',
      { currentBalance: 250 },
      '2026-01-01T00:00:00.000Z',
    );
  });

  test('both stat values are privacy-masked when hidden', () => {
    renderRow({}, { projectedBalance: 850 });

    expect(screen.queryAllByText('••••••')).toHaveLength(0);

    fireEvent.keyDown(document, { key: 'h', metaKey: true, shiftKey: true });

    expect(screen.queryByText('$1,000.00')).not.toBeInTheDocument();
    expect(screen.queryByText('$850.00')).not.toBeInTheDocument();
    expect(screen.getAllByText('••••••')).toHaveLength(2);
  });
});
