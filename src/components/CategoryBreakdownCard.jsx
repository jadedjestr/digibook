import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
} from 'lucide-react';
import PropTypes from 'prop-types';
import { Fragment, useEffect, useMemo, useState } from 'react';

import { dbHelpers } from '../db/database-clean';
import { useCategories } from '../stores/useAppStore';
import {
  formatCurrency,
  getDefaultAccount,
  getProjectedBalance,
} from '../utils/accountUtils';
import {
  buildCategoryBreakdown,
  buildPaycheckForecast,
  getUpcomingPayDates,
  toBillFacts,
} from '../utils/categoryBreakdown';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';

import PrivacyWrapper from './PrivacyWrapper';
import './CategoryBreakdownCard.css';

// Pay periods shown. Four weekly periods reach about a month ahead, which
// is the "this month and next" horizon this card is for.
const PAY_PERIODS = 4;
const FALLBACK_COLORS = 6;

const money = cents => formatCurrency(cents / 100);

const monthBounds = month => ({
  start: DateUtils.formatDate(
    new Date(month.getFullYear(), month.getMonth(), 1),
  ),
  end: DateUtils.formatDate(
    new Date(month.getFullYear(), month.getMonth() + 1, 0),
  ),
});

// A category without its own color gets a fallback picked from its name, so
// it keeps the same color whatever its rank this month.
const colorFor = group => {
  if (!group) return 'var(--category-fallback-6)';
  if (group.rgb) return group.rgb;
  let hash = 0;
  for (const char of group.key)
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return `var(--category-fallback-${(hash % FALLBACK_COLORS) + 1})`;
};

// "Oct 16": the year adds nothing to dates a few weeks out, and the long
// form wrapped each pay period's label onto two lines.
const shortDate = date =>
  DateUtils.parseDate(date)?.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  }) ?? date;

/**
 * Predicted cycles of recurring bills between two dates: the ones with no
 * real row yet (the app only creates a bill's row once it is due). The
 * same Virtual Ledger the calendar reads, but with the template's funding
 * and category id kept, which the forecast and grouping need.
 */
const useForecastBills = (rangeStart, rangeEnd, fixedExpenses) => {
  const [forecasts, setForecasts] = useState([]);

  useEffect(() => {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      setForecasts([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const templates = await dbHelpers.getRecurringExpenseTemplates();
        const perTemplate = await Promise.all(
          templates.map(template =>
            dbHelpers.getVirtualLedger(template.id, rangeStart, rangeEnd),
          ),
        );
        if (cancelled) return;
        setForecasts(
          perTemplate
            .flat()
            .filter(entry => entry.state === 'virtual')
            .map(({ template, cycleDueDate, estimatedAmount }) => ({
              templateId: template.id,
              name: template.name,
              dueDate: cycleDueDate,
              amount: estimatedAmount ?? 0,
              category: template.category,
              categoryId: template.categoryId ?? null,
              accountId: template.accountId ?? null,
              creditCardId: template.creditCardId ?? null,
              isVariableAmount: Boolean(template.isVariableAmount),
            })),
        );
      } catch (error) {
        logger.warn('Could not forecast recurring bills', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rangeStart, rangeEnd, fixedExpenses]);

  return forecasts;
};

/**
 * The expected paycheck: what has actually been arriving lately when there
 * is enough history, else the user's own figure - the same order
 * generateDueIncome uses. Re-read when pending transactions change, since
 * confirming a paycheck changes that history.
 */
const useExpectedPaycheck = pendingTransactions => {
  const [paycheck, setPaycheck] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const source = await dbHelpers.getPrimaryIncomeSource();
        if (!source) {
          if (!cancelled) setPaycheck(null);
          return;
        }
        const learned = await dbHelpers.getLearnedIncomeAmount(source.id);
        const amount = learned ?? Math.abs(Number(source.expectedAmount) || 0);
        if (!cancelled) {
          setPaycheck(
            amount > 0 ? { amount, accountId: source.accountId } : null,
          );
        }
      } catch (error) {
        logger.warn('Could not read the expected paycheck', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pendingTransactions]);

  return paycheck;
};

const Donut = ({ breakdown, selectedKey, onSelect }) => {
  const size = 180;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = breakdown.groups.length > 1 ? 3 : 0;

  let offset = 0;
  const segments = [];
  breakdown.groups.forEach(group => {
    const length = (group.totalCents / breakdown.totalCents) * circumference;
    const visible = Math.max(length - gap, 1);
    const paid =
      (Math.min(group.paidCents, group.totalCents) / group.totalCents) *
      visible;
    const dimmed = selectedKey && selectedKey !== group.key;
    [
      { part: 'paid', start: offset, length: paid },
      { part: 'coming', start: offset + paid, length: visible - paid },
    ].forEach(piece => {
      if (piece.length <= 0) return;
      segments.push(
        <circle
          key={`${group.key}-${piece.part}`}
          className={`category-donut-segment category-donut-segment--${piece.part}${
            dimmed ? ' is-dimmed' : ''
          }`}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeDasharray={`${piece.length} ${circumference - piece.length}`}
          strokeDashoffset={-piece.start}
          style={{ '--segment-rgb': colorFor(group) }}
          onClick={() => onSelect(group.key)}
        />,
      );
    });
    offset += length;
  });

  const top = breakdown.groups[0];
  return (
    <div className='category-donut'>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role='img'
        aria-label={`Bills by category. Largest is ${top.name} at ${Math.round(
          (top.totalCents / breakdown.totalCents) * 100,
        )} percent.`}
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>{segments}</g>
      </svg>
      <div className='category-donut-center'>
        <span className='category-donut-label'>This month</span>
        <span className='category-donut-total'>
          <PrivacyWrapper>{money(breakdown.totalCents)}</PrivacyWrapper>
        </span>
      </div>
    </div>
  );
};

Donut.propTypes = {
  breakdown: PropTypes.object.isRequired,
  selectedKey: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};

// Each note is [key, content]: the paid note holds an amount, which has to
// go through PrivacyWrapper, so notes are elements rather than one string.
const BillNote = ({ bill, accountsById, defaultAccountId }) => {
  const notes = [];
  if (bill.isResolved && bill.paidCents === 0)
    notes.push(['skipped', 'skipped']);
  else if (bill.paidCents > 0 && bill.paidCents >= bill.totalCents) {
    notes.push(['paid', 'paid']);
  } else if (bill.paidCents > 0) {
    notes.push([
      'part-paid',
      <>
        <PrivacyWrapper>{money(bill.paidCents)}</PrivacyWrapper> paid
      </>,
    ]);
  }
  if (bill.isForecast) notes.push(['expected', 'expected']);
  if (bill.isVariableAmount && bill.owedCents > 0) {
    notes.push(['estimate', 'estimate']);
  }
  if (bill.creditCardId) notes.push(['card', 'on a card']);
  else if (bill.accountId && bill.accountId !== defaultAccountId) {
    notes.push([
      'account',
      `from ${accountsById.get(bill.accountId)?.name ?? 'another account'}`,
    ]);
  }
  if (notes.length === 0) return null;
  return (
    <span className='category-bill-note'>
      {notes.map(([key, note], index) => (
        <Fragment key={key}>
          {index > 0 && ' · '}
          {note}
        </Fragment>
      ))}
    </span>
  );
};

BillNote.propTypes = {
  bill: PropTypes.object.isRequired,
  accountsById: PropTypes.instanceOf(Map).isRequired,
  defaultAccountId: PropTypes.string,
};

const BillList = ({ bills, amountOf, accountsById, defaultAccountId }) => (
  <ul className='category-bill-list'>
    {bills.map(bill => (
      <li key={bill.id} className='category-bill'>
        <span className='category-bill-name'>
          {bill.name}
          <BillNote
            bill={bill}
            accountsById={accountsById}
            defaultAccountId={defaultAccountId}
          />
        </span>
        <span className='category-bill-date'>{shortDate(bill.dueDate)}</span>
        <span className='category-bill-amount'>
          <PrivacyWrapper>{money(amountOf(bill))}</PrivacyWrapper>
        </span>
      </li>
    ))}
  </ul>
);

BillList.propTypes = {
  bills: PropTypes.arrayOf(PropTypes.object).isRequired,
  amountOf: PropTypes.func.isRequired,
  accountsById: PropTypes.instanceOf(Map).isRequired,
  defaultAccountId: PropTypes.string,
};

/**
 * "Where your bills go": the month's bills by category as a donut, then what
 * is left in the default account after each upcoming paycheck.
 *
 * The month is the page's (shared with Month View's calendar, moved by the
 * arrows in this card's header); the paycheck rows always start from
 * today, because they answer "how am I doing now", not "how was the month
 * I'm looking at". The math lives in utils/categoryBreakdown.js.
 */
const CategoryBreakdownCard = ({
  currentMonth,
  fixedExpenses,
  resolvedByExpenseId,
  accounts,
  pendingTransactions,
  paycheckSettings,
  paycheckDates,
  onPreviousMonth,
  onNextMonth,
  onToday,
}) => {
  const categories = useCategories();
  const [selectedKey, setSelectedKey] = useState(null);
  const [openRow, setOpenRow] = useState(null);

  const today = DateUtils.today();
  const month = monthBounds(currentMonth);
  const payDates = useMemo(
    () =>
      getUpcomingPayDates(
        paycheckDates?.nextPayDate,
        paycheckSettings?.frequency,
        PAY_PERIODS,
      ),
    [paycheckDates?.nextPayDate, paycheckSettings?.frequency],
  );

  // Forecasts are only ever from today on: a cycle before today that never
  // got a row is a gap in the records, not a bill that's coming.
  const lastPayDate = payDates[payDates.length - 1] ?? '';
  const forecastEnd = month.end > lastPayDate ? month.end : lastPayDate;
  const forecasts = useForecastBills(today, forecastEnd, fixedExpenses);
  const paycheck = useExpectedPaycheck(pendingTransactions);

  const bills = useMemo(
    () =>
      toBillFacts({ expenses: fixedExpenses, forecasts, resolvedByExpenseId }),
    [fixedExpenses, forecasts, resolvedByExpenseId],
  );

  const breakdown = useMemo(
    () =>
      buildCategoryBreakdown(
        bills.filter(
          bill => bill.dueDate >= month.start && bill.dueDate <= month.end,
        ),
        categories,
      ),
    [bills, categories, month.start, month.end],
  );

  const defaultAccount = getDefaultAccount(accounts);
  const accountsById = useMemo(
    () => new Map((accounts ?? []).map(account => [account.id, account])),
    [accounts],
  );
  const forecast = useMemo(
    () =>
      buildPaycheckForecast({
        bills,
        payDates,
        today,
        startingBalance: getProjectedBalance(
          defaultAccount,
          pendingTransactions,
        ),
        accountId: defaultAccount?.id ?? null,
        paycheck,
      }),
    [bills, payDates, today, defaultAccount, pendingTransactions, paycheck],
  );

  // Rows color their bills by the same category colors as the donut, even
  // a category that isn't in the month being viewed. Grouping every bill
  // covers every row bill: a bill still owed always has a total above $0.
  const groupOf = useMemo(() => {
    const lookup = new Map();
    buildCategoryBreakdown(bills, categories).groups.forEach(group =>
      group.bills.forEach(bill => lookup.set(bill.id, group)),
    );
    return lookup;
  }, [bills, categories]);

  const selected = breakdown.groups.find(group => group.key === selectedKey);
  const toggleCategory = key =>
    setSelectedKey(current => (current === key ? null : key));
  const widest = Math.max(1, ...forecast.rows.map(row => row.billsCents));
  const monthLabel = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const billCount = breakdown.groups.reduce(
    (sum, group) => sum + group.bills.length,
    0,
  );

  return (
    <section
      className='glass-card category-breakdown'
      aria-labelledby='category-breakdown-title'
    >
      <header className='category-breakdown-header'>
        <div>
          <h2
            id='category-breakdown-title'
            className='category-breakdown-title'
          >
            Where your bills go
          </h2>
          <p className='category-breakdown-sub'>
            {monthLabel}
            {billCount > 0 &&
              ` · ${billCount} ${billCount === 1 ? 'bill' : 'bills'}`}
          </p>
        </div>
        {/* Same controls as the calendar's header; they move the same month. */}
        <div className='category-breakdown-nav'>
          <button
            type='button'
            onClick={onPreviousMonth}
            className='calendar-nav-button glass-button glass-button--sm'
            aria-label='Previous month'
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type='button'
            onClick={onNextMonth}
            className='calendar-nav-button glass-button glass-button--sm'
            aria-label='Next month'
          >
            <ChevronRight size={16} />
          </button>
          <button
            type='button'
            onClick={onToday}
            className='calendar-today-button glass-button glass-button--sm glass-button--primary'
            aria-label='Go to this month'
          >
            Today
          </button>
        </div>
      </header>

      {breakdown.groups.length === 0 ? (
        <p className='category-breakdown-empty'>No bills in {monthLabel}.</p>
      ) : (
        <div className='category-breakdown-body'>
          <Donut
            breakdown={breakdown}
            selectedKey={selectedKey}
            onSelect={toggleCategory}
          />
          <div className='category-legend'>
            <p className='category-legend-key'>
              Solid is paid, faded is still coming. Tap a category to see its
              bills.
            </p>
            {breakdown.groups.map(group => {
              const isOpen = group.key === selectedKey;
              return (
                <Fragment key={group.key}>
                  <button
                    type='button'
                    className={`category-legend-row${isOpen ? ' is-open' : ''}`}
                    aria-expanded={isOpen}
                    onClick={() => toggleCategory(group.key)}
                  >
                    <span
                      className='category-legend-swatch'
                      style={{ '--segment-rgb': colorFor(group) }}
                      aria-hidden='true'
                    />
                    <span className='category-legend-name'>
                      <span aria-hidden='true'>{group.icon}</span> {group.name}
                    </span>
                    <span className='category-legend-share'>
                      {Math.round(
                        (group.totalCents / breakdown.totalCents) * 100,
                      )}
                      %
                    </span>
                    <span className='category-legend-amount'>
                      <PrivacyWrapper>{money(group.totalCents)}</PrivacyWrapper>
                    </span>
                    <span className='category-legend-progress'>
                      {group.comingCents === 0 && 'All paid'}
                      {group.comingCents > 0 && group.paidCents === 0 && (
                        <>
                          <PrivacyWrapper>
                            {money(group.comingCents)}
                          </PrivacyWrapper>{' '}
                          still coming
                        </>
                      )}
                      {group.comingCents > 0 && group.paidCents > 0 && (
                        <>
                          <PrivacyWrapper>
                            {money(group.paidCents)}
                          </PrivacyWrapper>{' '}
                          paid ·{' '}
                          <PrivacyWrapper>
                            {money(group.comingCents)}
                          </PrivacyWrapper>{' '}
                          still coming
                        </>
                      )}
                    </span>
                  </button>
                  {isOpen && selected && (
                    <BillList
                      bills={selected.bills}
                      amountOf={b => b.totalCents}
                      accountsById={accountsById}
                      defaultAccountId={defaultAccount?.id}
                    />
                  )}
                </Fragment>
              );
            })}
          </div>
        </div>
      )}

      <div className='paycheck-forecast'>
        <h3 className='paycheck-forecast-title'>
          By paycheck
          {paycheckSettings?.frequency && (
            <span className='paycheck-forecast-sub'>
              {' '}
              · {defaultAccount?.name ?? 'your account'}
            </span>
          )}
        </h3>

        {payDates.length === 0 ? (
          <p className='category-breakdown-empty'>
            Set your pay schedule in Settings to see your bills by paycheck.
          </p>
        ) : (
          <>
            {!forecast.paycheckCounts && (
              <p className='paycheck-forecast-note'>
                {paycheck
                  ? 'Your paycheck goes to a different account, so it is not added here.'
                  : 'Add your expected paycheck in Settings to see it added on each payday.'}
              </p>
            )}
            <ol className='paycheck-rows'>
              {forecast.rows.map((row, index) => {
                const isOpen = openRow === index;
                const label =
                  row.startDate === null
                    ? `Now → ${shortDate(row.endDate)}`
                    : `${shortDate(row.startDate)} → ${shortDate(row.endDate)}`;
                return (
                  <li key={row.endDate} className='paycheck-row-item'>
                    <button
                      type='button'
                      className='paycheck-row'
                      aria-expanded={isOpen}
                      onClick={() => setOpenRow(isOpen ? null : index)}
                    >
                      <span className='paycheck-row-when'>
                        <span className='paycheck-row-label'>{label}</span>
                        <span className='paycheck-row-detail'>
                          {row.incomeCents > 0 && (
                            <>
                              +
                              <PrivacyWrapper>
                                {money(row.incomeCents)}
                              </PrivacyWrapper>{' '}
                              pay ·{' '}
                            </>
                          )}
                          {row.billsCents > 0 ? (
                            <>
                              <PrivacyWrapper>
                                {money(row.billsCents)}
                              </PrivacyWrapper>{' '}
                              in bills
                              {row.fromAccountCents < row.billsCents && (
                                <>
                                  ,{' '}
                                  <PrivacyWrapper>
                                    {money(row.fromAccountCents)}
                                  </PrivacyWrapper>{' '}
                                  from {defaultAccount?.name ?? 'this account'}
                                </>
                              )}
                            </>
                          ) : (
                            'No bills'
                          )}
                          {row.overdueCount > 0 &&
                            ` · ${row.overdueCount} overdue`}
                        </span>
                      </span>
                      <span className='paycheck-row-bar' aria-hidden='true'>
                        {row.bills.map(bill => (
                          <span
                            key={bill.id}
                            className={`paycheck-row-segment${
                              bill.creditCardId ? ' is-on-card' : ''
                            }`}
                            style={{
                              width: `${(bill.owedCents / widest) * 100}%`,
                              '--segment-rgb': colorFor(groupOf.get(bill.id)),
                            }}
                          />
                        ))}
                      </span>
                      <span className='paycheck-row-left'>
                        <span className='paycheck-row-left-label'>left</span>
                        <span
                          className={`paycheck-row-left-amount${
                            row.leftCents < 0 ? ' is-short' : ''
                          }`}
                        >
                          <PrivacyWrapper>
                            {money(row.leftCents)}
                          </PrivacyWrapper>
                        </span>
                      </span>
                      <ChevronDown
                        size={16}
                        className='paycheck-row-chevron'
                        aria-hidden='true'
                      />
                    </button>
                    {isOpen &&
                      (row.bills.length > 0 ? (
                        <BillList
                          bills={row.bills}
                          amountOf={b => b.owedCents}
                          accountsById={accountsById}
                          defaultAccountId={defaultAccount?.id}
                        />
                      ) : (
                        <p className='paycheck-row-none'>Nothing due.</p>
                      ))}
                  </li>
                );
              })}
            </ol>
            {forecast.rows.some(row =>
              row.bills.some(bill => bill.creditCardId),
            ) && (
              <p className='paycheck-forecast-note'>
                <CreditCard size={12} aria-hidden='true' /> Striped bills are
                charged to a card, so they don&apos;t lower what&apos;s left
                until you pay the card.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
};

CategoryBreakdownCard.propTypes = {
  currentMonth: PropTypes.instanceOf(Date).isRequired,
  fixedExpenses: PropTypes.arrayOf(PropTypes.object).isRequired,
  resolvedByExpenseId: PropTypes.instanceOf(Map).isRequired,
  accounts: PropTypes.arrayOf(PropTypes.object),
  pendingTransactions: PropTypes.arrayOf(PropTypes.object),
  paycheckSettings: PropTypes.object,
  paycheckDates: PropTypes.object,
  onPreviousMonth: PropTypes.func.isRequired,
  onNextMonth: PropTypes.func.isRequired,
  onToday: PropTypes.func.isRequired,
};

export default CategoryBreakdownCard;
