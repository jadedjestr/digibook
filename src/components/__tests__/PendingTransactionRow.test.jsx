import { render, fireEvent, screen } from '@testing-library/react';
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

  test('clicking Complete calls onComplete with the transaction id', () => {
    const onComplete = vi.fn();
    renderRow({}, { onComplete });
    fireEvent.click(screen.getByTitle('Mark as Completed'));
    expect(onComplete).toHaveBeenCalledWith('tx-1');
  });

  test('clicking Delete calls onDelete with the transaction id', () => {
    const onDelete = vi.fn();
    renderRow({}, { onDelete });
    fireEvent.click(screen.getByTitle('Delete Transaction'));
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

    fireEvent.click(screen.getAllByTitle('Click to edit')[3]);
    const dateInput = container.querySelector('input[type="date"]');
    fireEvent.change(dateInput, { target: { value: '2026-03-01' } });
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
