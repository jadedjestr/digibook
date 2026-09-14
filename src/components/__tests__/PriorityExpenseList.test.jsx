import { render, screen, within, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';

import { PrivacyProvider } from '../../contexts/PrivacyContext';
import { PaycheckService } from '../../services/paycheckService';
import PriorityExpenseList from '../PriorityExpenseList';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const paycheckService = new PaycheckService({
  lastPaycheckDate: '2026-09-01',
  frequency: 'bi-weekly',
});

// Matches the fixed window used by src/services/__tests__/paycheckService.test.js.
const paycheckDates = {
  nextPayDate: '2026-09-24',
  followingPayDate: '2026-10-08',
};

const accounts = [{ id: 'acc1', name: 'Everyday Checking', isDefault: true }];
const creditCards = [];

const expense = overrides => ({
  id: 'e1',
  name: 'Unnamed expense',
  amount: 100,
  paidAmount: 0,
  dueDate: '2026-09-20',
  accountId: 'acc1',
  ...overrides,
});

const renderList = (expenses, onPayNow = vi.fn()) =>
  render(
    <PrivacyProvider>
      <PriorityExpenseList
        expenses={expenses}
        paycheckService={paycheckService}
        paycheckDates={paycheckDates}
        accounts={accounts}
        creditCards={creditCards}
        onPayNow={onPayNow}
      />
    </PrivacyProvider>,
  );

describe('PriorityExpenseList — section placement', () => {
  test('an overdue, unpaid expense lands in Overdue', () => {
    renderList([
      expense({ id: 'a', name: 'Overdue Unpaid', dueDate: '2026-09-01' }),
    ]);
    const section = screen.getByText('Overdue').closest('section');
    expect(within(section).getByText('Overdue Unpaid')).toBeInTheDocument();
  });

  test('an overdue, partially-paid expense also lands in Overdue, not nowhere', () => {
    // The exact bug this project fixed: a partially-paid expense used to
    // vanish from every bucket because 'Partially Paid' was never a case in
    // the old switch. This pins that it now appears, and in the right place.
    renderList([
      expense({
        id: 'a',
        name: 'Overdue Partial',
        dueDate: '2026-09-01',
        paidAmount: 40,
      }),
    ]);
    const section = screen.getByText('Overdue').closest('section');
    expect(within(section).getByText('Overdue Partial')).toBeInTheDocument();
  });

  test('due on or before the next paycheck lands in This week', () => {
    renderList([
      expense({ id: 'a', name: 'This Week Bill', dueDate: '2026-09-24' }),
    ]);
    const header = screen.getByText('This week');
    const section = header.closest('section');
    expect(within(section).getByText('This Week Bill')).toBeInTheDocument();
  });

  test('a partially-paid, not-yet-overdue expense still lands in This week', () => {
    // The case that actually distinguishes reading getTimingBucket() from
    // reading calculateExpenseStatus(): that display string still says
    // 'Partially Paid' here by design (it's not overdue, so the combined
    // status has no way to also say "due this week"). Bucketing off that
    // string instead of the raw timing fact would silently drop this
    // expense from every section — present in the data, shown nowhere.
    renderList([
      expense({
        id: 'a',
        name: 'Partial This Week',
        dueDate: '2026-09-24',
        paidAmount: 40,
      }),
    ]);
    const header = screen.getByText('This week');
    const section = header.closest('section');
    expect(within(section).getByText('Partial This Week')).toBeInTheDocument();
  });

  test('due between the next and following paycheck lands in Later', () => {
    renderList([
      expense({ id: 'a', name: 'Next Check Bill', dueDate: '2026-09-25' }),
    ]);
    const header = screen.getByText('Later');
    const section = header.closest('section');
    expect(within(section).getByText('Next Check Bill')).toBeInTheDocument();
  });

  test('due after the following paycheck also lands in Later, on purpose', () => {
    // Deliberately merged with Next Check here even though
    // calculateSummaryTotals() excludes Following-Check dollars from the
    // money total — the list shows what exists, the hero shows what's owed.
    renderList([
      expense({ id: 'a', name: 'Far Future Bill', dueDate: '2026-10-09' }),
    ]);
    const header = screen.getByText('Later');
    const section = header.closest('section');
    expect(within(section).getByText('Far Future Bill')).toBeInTheDocument();
  });

  test('a fully-paid expense appears nowhere', () => {
    renderList([expense({ id: 'a', name: 'All Paid Up', paidAmount: 100 })]);
    expect(screen.queryByText('All Paid Up')).not.toBeInTheDocument();
  });

  test('an unparseable due date is excluded rather than misplaced', () => {
    renderList([
      expense({ id: 'a', name: 'Bad Date Bill', dueDate: 'not-a-date' }),
    ]);
    expect(screen.queryByText('Bad Date Bill')).not.toBeInTheDocument();
  });

  test('the Overdue section is absent from the DOM entirely when nothing is overdue', () => {
    renderList([
      expense({ id: 'a', name: 'This Week Bill', dueDate: '2026-09-24' }),
    ]);
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
  });

  test('This week and Later show an empty state rather than disappearing', () => {
    renderList([]);
    expect(screen.getByText('Nothing due this week.')).toBeInTheDocument();
    expect(screen.getByText('Nothing else scheduled.')).toBeInTheDocument();
  });

  test('sections sort ascending by due date', () => {
    renderList([
      expense({ id: 'a', name: 'Later Bill', dueDate: '2026-09-22' }),
      expense({ id: 'b', name: 'Sooner Bill', dueDate: '2026-09-21' }),
    ]);
    const section = screen.getByText('This week').closest('section');
    const names = within(section)
      .getAllByText(/Bill$/)
      .map(el => el.textContent);
    expect(names).toEqual(['Sooner Bill', 'Later Bill']);
  });
});

describe('PriorityExpenseList — Pay Now wiring', () => {
  test('clicking Pay Now calls onPayNow with the exact expense', () => {
    const onPayNow = vi.fn();
    const target = expense({
      id: 'target',
      name: 'Click Me',
      dueDate: '2026-09-24',
    });
    renderList([target], onPayNow);

    fireEvent.click(screen.getByRole('button', { name: 'Pay now' }));

    expect(onPayNow).toHaveBeenCalledTimes(1);
    expect(onPayNow).toHaveBeenCalledWith(target);
  });
});

describe('PriorityExpenseList — privacy masking', () => {
  test('amounts are replaced when privacy mode is toggled on', () => {
    renderList([
      expense({
        id: 'a',
        name: 'Masked Bill',
        amount: 142.38,
        dueDate: '2026-09-24',
      }),
    ]);

    expect(screen.getByText('$142.38')).toBeInTheDocument();

    // The only way PrivacyContext actually flips — there is no prop.
    fireEvent.keyDown(document, { key: 'h', metaKey: true, shiftKey: true });

    expect(screen.queryByText('$142.38')).not.toBeInTheDocument();
    expect(screen.getByText('••••••')).toBeInTheDocument();
  });
});
