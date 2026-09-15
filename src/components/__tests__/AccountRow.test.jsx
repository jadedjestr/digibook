import { render, fireEvent, screen, within } from '@testing-library/react';
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
    // Scoped to .glass-row-list-stat-value specifically - the swipe rail's
    // Set Default icon is unconditionally text-yellow-400 (see "clicking
    // the left rail" below), so a bare '.text-yellow-400' query would match
    // it regardless of this test's projectedBalance and always pass.
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
    expect(
      container.querySelector('.glass-row-list-stat-value.text-yellow-400'),
    ).toBeNull();

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
    expect(
      container.querySelector('.glass-row-list-stat-value.text-yellow-400'),
    ).not.toBeNull();
  });

  // The always-visible action buttons and the swipe rails now share the
  // same title text by design (both trigger the identical action) - scope
  // each query to its own container to keep testing the right one.
  test('clicking the always-visible star calls onSetDefault with the account id', () => {
    const onSetDefault = vi.fn();
    const { container } = renderRow({}, { onSetDefault });
    const actions = container.querySelector('.glass-row-list-actions');
    fireEvent.click(within(actions).getByTitle('Set as Default'));
    expect(onSetDefault).toHaveBeenCalledTimes(1);
    expect(onSetDefault).toHaveBeenCalledWith('acc-1');
  });

  test('clicking the always-visible trash calls onDelete with the account id', () => {
    const onDelete = vi.fn();
    const { container } = renderRow({}, { onDelete });
    const actions = container.querySelector('.glass-row-list-actions');
    fireEvent.click(within(actions).getByTitle('Delete Account'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('acc-1');
  });

  test('clicking the left swipe rail calls onSetDefault with the account id', () => {
    const onSetDefault = vi.fn();
    const { container } = renderRow({}, { onSetDefault });
    const rail = container.querySelector(
      '.glass-row-list-item-swipe-rail--left',
    );
    expect(rail).toHaveClass('text-yellow-400');
    fireEvent.click(rail);
    expect(onSetDefault).toHaveBeenCalledTimes(1);
    expect(onSetDefault).toHaveBeenCalledWith('acc-1');
  });

  test('clicking the right swipe rail calls onDelete with the account id', () => {
    const onDelete = vi.fn();
    const { container } = renderRow({}, { onDelete });
    const rail = container.querySelector(
      '.glass-row-list-item-swipe-rail--right',
    );
    expect(rail).toHaveClass('text-red-400');
    fireEvent.click(rail);
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

// jsdom has no layout engine and can't verify that the sliding content
// visually occludes the rails at rest or that a drag doesn't overlap
// neighboring content - those are verified live (see the swipe-to-reveal
// plan). What CAN be pinned here is that the CSS rules the visual behavior
// depends on actually exist with the right shape.
describe('glass-row-list-item--swipeable CSS', () => {
  test('the swipeable modifier clips content and positions the rails', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8');

    const swipeableMatch = css.match(
      /\.glass-row-list-item--swipeable\s*\{([^}]*)\}/,
    );
    expect(
      swipeableMatch,
      '.glass-row-list-item--swipeable rule not found',
    ).not.toBeNull();
    expect(swipeableMatch[1]).toMatch(/position:\s*relative/);
    expect(swipeableMatch[1]).toMatch(/overflow:\s*hidden/);
  });

  test('the track does not shrink below its overflow-sized basis', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8');

    const trackMatch = css.match(/\.glass-row-list-item-track\s*\{([^}]*)\}/);
    expect(
      trackMatch,
      '.glass-row-list-item-track rule not found',
    ).not.toBeNull();

    // flex: 0 0 <basis> - flex-shrink must be pinned to 0, or the
    // flexbox algorithm silently shrinks this lone overflowing child
    // back down to fit, defeating the whole spatial-occlusion technique.
    expect(trackMatch[1]).toMatch(/flex:\s*0\s+0\s+/);
  });

  test('the mobile flex-wrap rule targets the content wrapper, not the outer item', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8');

    const mobileBlock = css.match(
      /@media \(max-width: 768px\) \{([\s\S]*?)\n {2}\}\n/,
    );
    expect(mobileBlock, 'the 768px mobile block was not found').not.toBeNull();
    expect(mobileBlock[1]).toMatch(
      /\.glass-row-list-item-content\s*\{\s*flex-wrap:\s*wrap;\s*\}/,
    );
    expect(mobileBlock[1]).not.toMatch(
      /\.glass-row-list-item\s*\{\s*flex-wrap:\s*wrap;\s*\}/,
    );
  });
});
