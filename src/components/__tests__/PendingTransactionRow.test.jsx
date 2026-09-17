import { render, fireEvent, screen, within } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';

import { PrivacyProvider } from '../../contexts/PrivacyContext';
import PendingTransactionRow from '../PendingTransactionRow';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const baseTransaction = {
  id: 'tx-1',
  accountId: 'acc-1',
  amount: -50,
  category: 'Groceries',
  description: 'Whole Foods',
  date: '2026-02-15',
};

const baseAccount = { currentBalance: 1000 };

const accountOptions = [
  { value: 'acc-1', label: 'Everyday Checking' },
  { value: 'acc-2', label: 'Savings' },
];

const categoryOptions = [
  { value: 'Groceries', label: 'Groceries' },
  { value: 'Transport', label: 'Transport' },
];

const renderRow = (transactionOverrides = {}, props = {}) =>
  render(
    <PrivacyProvider>
      <PendingTransactionRow
        transaction={{ ...baseTransaction, ...transactionOverrides }}
        account={props.account ?? baseAccount}
        projectedBalance={props.projectedBalance ?? 950}
        accountOptions={accountOptions}
        categoryOptions={categoryOptions}
        onUpdateTransaction={props.onUpdateTransaction ?? vi.fn()}
        onComplete={props.onComplete ?? vi.fn()}
        onDelete={props.onDelete ?? vi.fn()}
      />
    </PrivacyProvider>,
  );

describe('PendingTransactionRow', () => {
  test('renders the description, meta fields, and both stat values', () => {
    renderRow();
    expect(screen.getByText('Whole Foods')).toBeInTheDocument();
    expect(screen.getByText('Everyday Checking')).toBeInTheDocument();
    expect(screen.getByText('Groceries')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Projected')).toBeInTheDocument();
    expect(screen.getByText('-$50.00')).toBeInTheDocument();
    expect(screen.getByText('$950.00')).toBeInTheDocument();
  });

  test('each meta field carries an sr-only label distinguishing it', () => {
    const { container } = renderRow();
    expect(container).toHaveTextContent('Account:');
    expect(container).toHaveTextContent('Category:');
    expect(container).toHaveTextContent('Date:');
  });

  test('amount is red when negative, not red when positive', () => {
    const { container, rerender } = render(
      <PrivacyProvider>
        <PendingTransactionRow
          transaction={{ ...baseTransaction, amount: -50 }}
          account={baseAccount}
          projectedBalance={950}
          accountOptions={accountOptions}
          categoryOptions={categoryOptions}
          onUpdateTransaction={vi.fn()}
          onComplete={vi.fn()}
          onDelete={vi.fn()}
        />
      </PrivacyProvider>,
    );
    expect(
      container.querySelector('.glass-row-list-stat-value.text-red-400'),
    ).not.toBeNull();

    rerender(
      <PrivacyProvider>
        <PendingTransactionRow
          transaction={{ ...baseTransaction, amount: 50 }}
          account={baseAccount}
          projectedBalance={950}
          accountOptions={accountOptions}
          categoryOptions={categoryOptions}
          onUpdateTransaction={vi.fn()}
          onComplete={vi.fn()}
          onDelete={vi.fn()}
        />
      </PrivacyProvider>,
    );
    expect(
      container.querySelector('.glass-row-list-stat-value.text-red-400'),
    ).toBeNull();
  });

  test('projected balance turns yellow only when behind the account balance', () => {
    const { container } = renderRow(
      {},
      { projectedBalance: 1500, account: baseAccount },
    );
    expect(container.querySelector('.text-yellow-400')).toBeNull();
  });

  test('projected balance is yellow when behind the account balance', () => {
    const { container } = renderRow(
      {},
      { projectedBalance: 500, account: baseAccount },
    );
    expect(container.querySelector('.text-yellow-400')).not.toBeNull();
  });

  // The always-visible action buttons and the swipe rails now share the
  // same title text by design (both trigger the identical action) - scope
  // each query to its own container to keep testing the right one.
  test('clicking the always-visible Complete button calls onComplete with the transaction id', () => {
    const onComplete = vi.fn();
    const { container } = renderRow({}, { onComplete });
    const actions = container.querySelector('.glass-row-list-actions');
    fireEvent.click(within(actions).getByTitle('Mark as Completed'));
    expect(onComplete).toHaveBeenCalledWith('tx-1');
  });

  test('clicking the always-visible Delete button calls onDelete with the transaction id', () => {
    const onDelete = vi.fn();
    const { container } = renderRow({}, { onDelete });
    const actions = container.querySelector('.glass-row-list-actions');
    fireEvent.click(within(actions).getByTitle('Delete Transaction'));
    expect(onDelete).toHaveBeenCalledWith('tx-1');
  });

  test('clicking the left swipe rail calls onComplete with the transaction id', () => {
    const onComplete = vi.fn();
    const { container } = renderRow({}, { onComplete });
    const rail = container.querySelector(
      '.glass-row-list-item-swipe-rail--left',
    );
    expect(rail).toHaveClass('text-green-400');
    fireEvent.click(rail);
    expect(onComplete).toHaveBeenCalledWith('tx-1');
  });

  test('clicking the right swipe rail calls onDelete with the transaction id', () => {
    const onDelete = vi.fn();
    const { container } = renderRow({}, { onDelete });
    const rail = container.querySelector(
      '.glass-row-list-item-swipe-rail--right',
    );
    expect(rail).toHaveClass('text-red-400');
    fireEvent.click(rail);
    expect(onDelete).toHaveBeenCalledWith('tx-1');
  });

  test('editing the description calls onUpdateTransaction with the new description', () => {
    const onUpdateTransaction = vi.fn();
    renderRow({}, { onUpdateTransaction });

    fireEvent.click(screen.getAllByTitle('Click to edit')[0]);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Trader Joes' },
    });
    fireEvent.click(screen.getByTitle('Save (Enter)'));

    expect(onUpdateTransaction).toHaveBeenCalledWith('tx-1', {
      description: 'Trader Joes',
    });
  });

  // DOM order of the five showEditIcon fields (all titled 'Click to
  // edit' in display mode, matching AccountRow.test.jsx's indexed
  // convention): 0 Description, 1 Account, 2 Category, 3 Date, 4 Amount.

  // Account/Category are select-type InlineEdit fields: showEditIcon
  // still titles their DISPLAY-mode button, but their EDIT-mode
  // Save/Cancel icons carry no title at all (confirmed in InlineEdit
  // .jsx's options-branch, unlike the plain-input/date branch). The
  // select is wired with onBlur={handleSave}, so blurring it after a
  // change is the reliable way to trigger a save in a test.
  test('editing the account calls onUpdateTransaction with the new accountId', () => {
    const onUpdateTransaction = vi.fn();
    renderRow({}, { onUpdateTransaction });

    fireEvent.click(screen.getAllByTitle('Click to edit')[1]);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'acc-2' } });
    fireEvent.blur(select);

    expect(onUpdateTransaction).toHaveBeenCalledWith('tx-1', {
      accountId: 'acc-2',
    });
  });

  test('editing the category calls onUpdateTransaction with the new category', () => {
    const onUpdateTransaction = vi.fn();
    renderRow({}, { onUpdateTransaction });

    fireEvent.click(screen.getAllByTitle('Click to edit')[2]);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Transport' } });
    fireEvent.blur(select);

    expect(onUpdateTransaction).toHaveBeenCalledWith('tx-1', {
      category: 'Transport',
    });
  });

  test('editing the date calls onUpdateTransaction with the new date', () => {
    const onUpdateTransaction = vi.fn();
    const { container } = renderRow({}, { onUpdateTransaction });

    // Starts on 2026-02-15; open the date picker, advance to March, and
    // pick the 1st via its full-date accessible name (not just "1" - the
    // grid also shows trailing/leading days from adjacent months). The
    // trigger itself is opened via a class selector rather than
    // getByRole, since its own "Feb 15, 2026" text collides with a
    // same-named (but closed, off-screen) day cell's aria-label.
    fireEvent.click(screen.getAllByTitle('Click to edit')[3]);
    fireEvent.click(container.querySelector('.date-picker-trigger'));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: /Mar 1, 2026/ }));
    fireEvent.click(screen.getByTitle('Save (Enter)'));

    expect(onUpdateTransaction).toHaveBeenCalledWith('tx-1', {
      date: '2026-03-01',
    });
  });

  test('editing the amount calls onUpdateTransaction with the new amount', () => {
    const onUpdateTransaction = vi.fn();
    renderRow({}, { onUpdateTransaction });

    fireEvent.click(screen.getAllByTitle('Click to edit')[4]);
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '75' },
    });
    fireEvent.click(screen.getByTitle('Save (Enter)'));

    expect(onUpdateTransaction).toHaveBeenCalledWith('tx-1', { amount: 75 });
  });

  test('amount and projected balance are privacy-masked when hidden', () => {
    renderRow();
    expect(screen.queryAllByText('••••••')).toHaveLength(0);

    fireEvent.keyDown(document, { key: 'h', metaKey: true, shiftKey: true });

    expect(screen.queryByText('-$50.00')).not.toBeInTheDocument();
    expect(screen.queryByText('$950.00')).not.toBeInTheDocument();

    // Both mask: Projected is wrapped explicitly here, and Amount's
    // InlineEdit(type='number') wraps its own display value in
    // PrivacyWrapper internally (see InlineEdit.jsx's formatDisplayValue).
    expect(screen.getAllByText('••••••')).toHaveLength(2);
  });
});

// The wrap-under-edit-mode layout invariant (an expanded date/select
// control dropping to its own line instead of overlapping the row) can't
// be verified here — jsdom has no layout engine. It's pinned as a
// CSS-source assertion instead, matching the pattern already established
// by FixedExpensesLayout.mobileOrder.test.js / AddExpensePanel.layering
// .test.jsx, and verified live in the browser (desktop + mobile).
describe('glass-row-list-item-meta CSS', () => {
  test('flex-wrap: wrap applies unconditionally, not just on mobile', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8');

    const metaBlockMatch = css.match(
      /\.glass-row-list-item-meta\s*\{([^}]*)\}/,
    );
    expect(
      metaBlockMatch,
      '.glass-row-list-item-meta rule not found',
    ).not.toBeNull();
    expect(metaBlockMatch[1]).toMatch(/flex-wrap:\s*wrap/);

    // Confirm this occurrence isn't nested inside an @media block by
    // checking the rule appears before the first @media in the file that
    // could plausibly scope it, i.e. it's declared at the top level of
    // the .glass-row-surface section rather than inside a breakpoint.
    const ruleIndex = css.indexOf(metaBlockMatch[0]);
    const enclosingMediaOpen = css.lastIndexOf('@media', ruleIndex);
    const enclosingMediaClose =
      enclosingMediaOpen === -1
        ? -1
        : css.indexOf('\n  }\n', enclosingMediaOpen);
    const isInsideMedia =
      enclosingMediaOpen !== -1 &&
      enclosingMediaClose !== -1 &&
      enclosingMediaClose > ruleIndex;
    expect(isInsideMedia).toBe(false);
  });
});

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
