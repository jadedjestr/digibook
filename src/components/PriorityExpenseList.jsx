import PropTypes from 'prop-types';
import { useMemo } from 'react';

import { DateUtils } from '../utils/dateUtils';

import PriorityExpenseRow from './PriorityExpenseRow';

/**
 * The page's primary content: every unpaid or partially-paid expense,
 * sectioned Overdue → This week → Later.
 *
 * Bucketing reads `getPaymentProgress()`/`getTimingBucket()` directly —
 * never `calculateExpenseStatus()`'s combined display string, and never raw
 * date math of its own. Those two functions are the one place this project
 * now trusts for "how much is owed" and "when is it due"; recomputing either
 * here would reopen exactly the defect class that made `calculateSummaryTotals()`
 * silently drop partially-paid bills before this session's fix.
 *
 * `expenses` is meant to be the full, unfiltered fixedExpenses array — not
 * scoped to whatever month a calendar happens to be showing. See
 * FixedExpenses.jsx for why that scoping was removed from the money side of
 * this page.
 */
const PriorityExpenseList = ({
  expenses,
  paycheckService,
  paycheckDates,
  accounts,
  creditCards,
  onPayNow,
}) => {
  const { overdue, thisWeek, later } = useMemo(() => {
    const sections = { overdue: [], thisWeek: [], later: [] };

    for (const expense of expenses) {
      if (paycheckService.getPaymentProgress(expense) === 'Paid') continue;

      const timing = paycheckService.getTimingBucket(expense, paycheckDates);

      // 'Next Check' and 'Following Check' both read as "later" here — the
      // list is showing what exists, not what's owed right now, which is
      // why it deliberately includes Following-Check items even though
      // calculateSummaryTotals() excludes their dollars from the money
      // total. That's not an inconsistency to "fix"; the list and the hero
      // number are answering different questions on purpose. timing ===
      // null (unparseable due date) is excluded — there is no honest
      // bucket for it, matching calculateSummaryTotals()'s own guard.
      if (timing === 'Overdue') sections.overdue.push(expense);
      else if (timing === 'This Week') sections.thisWeek.push(expense);
      else if (timing === 'Next Check' || timing === 'Following Check') {
        sections.later.push(expense);
      }
    }

    const byDueDate = (a, b) =>
      (DateUtils.parseDate(a.dueDate) ?? 0) -
      (DateUtils.parseDate(b.dueDate) ?? 0);

    sections.overdue.sort(byDueDate);
    sections.thisWeek.sort(byDueDate);
    sections.later.sort(byDueDate);

    return {
      overdue: sections.overdue,
      thisWeek: sections.thisWeek,
      later: sections.later,
    };
  }, [expenses, paycheckService, paycheckDates]);

  const renderRow = expense => (
    <PriorityExpenseRow
      key={expense.id}
      expense={expense}
      accounts={accounts}
      creditCards={creditCards}
      onPayNow={onPayNow}
    />
  );

  return (
    <div className='priority-list'>
      {overdue.length > 0 && (
        <section className='priority-list-section priority-list-section--overdue'>
          <h3 className='priority-list-section-header priority-list-section-header--overdue'>
            Overdue
          </h3>
          <div className='priority-list-section-items'>
            {overdue.map(renderRow)}
          </div>
        </section>
      )}

      <section className='priority-list-section'>
        <h3 className='priority-list-section-header'>This week</h3>
        {thisWeek.length > 0 ? (
          <div className='priority-list-section-items'>
            {thisWeek.map(renderRow)}
          </div>
        ) : (
          <p className='priority-list-empty'>Nothing due this week.</p>
        )}
      </section>

      <section className='priority-list-section'>
        <h3 className='priority-list-section-header'>Later</h3>
        {later.length > 0 ? (
          <div className='priority-list-section-items'>
            {later.map(renderRow)}
          </div>
        ) : (
          <p className='priority-list-empty'>Nothing else scheduled.</p>
        )}
      </section>
    </div>
  );
};

PriorityExpenseList.propTypes = {
  expenses: PropTypes.arrayOf(PropTypes.object).isRequired,
  paycheckService: PropTypes.shape({
    getPaymentProgress: PropTypes.func.isRequired,
    getTimingBucket: PropTypes.func.isRequired,
  }).isRequired,
  paycheckDates: PropTypes.object.isRequired,
  accounts: PropTypes.arrayOf(PropTypes.object).isRequired,
  creditCards: PropTypes.arrayOf(PropTypes.object).isRequired,
  onPayNow: PropTypes.func.isRequired,
};

export default PriorityExpenseList;
