import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getMostRecentImpliedPayDate } from '../constants/payFrequency';
import { dbHelpers } from '../db/database-clean';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { getDismissedKeys, markDismissed } from '../utils/nudgeDismissal';
import { getLastMonthKey, getPayCycleNudge } from '../utils/payCycleNudgeLogic';

/**
 * Hook for pay cycle nudge: returns the single nudge to show and a dismiss callback.
 * Recomputes when inputs or dismissal state change.
 *
 * @param {Object} options
 * @param {Array} options.fixedExpenses
 * @param {Date} options.currentMonth
 * @param {Array} options.currentMonthExpenses
 * @param {Object} options.paycheckDates
 * @param {Object} options.paycheckService
 * @param {Array} [options.creditCards] - Credit cards, for the promo_ended nudge
 * @param {Object} [options.paycheckSettings] - Pay anchor + frequency; scopes
 *   how recently a card's intro APR may have ended to still warrant a nudge
 * @param {Set<string>} [options.resolvedExpenseIds] - Resolved recurring
 *   cycle ids (see getPayCycleNudge); keeps nudges from nagging about
 *   bills the user has already resolved
 * @param {Function} [options.onNudgeShown] - (nudge) => {}
 * @param {Function} [options.onNudgeDismissed] - (nudge, action) => {}
 * @param {Function} [options.onNudgeAction] - (nudge, action) => {}
 * @returns {{ nudge: object|null, dismiss: (dismissKey, dontShowAgainThisMonth?) => void }}
 */
export function usePayCycleNudge({
  fixedExpenses = [],
  currentMonth,
  currentMonthExpenses = [],
  paycheckDates = {},
  paycheckService,
  creditCards = [],
  paycheckSettings = null,
  resolvedExpenseIds,
  onNudgeShown,
  onNudgeDismissed,
  onNudgeAction: _onNudgeAction,
}) {
  const [dismissalVersion, setDismissalVersion] = useState(0);
  const prevNudgeRef = useRef(null);

  // dismissalVersion forces re-read of sessionStorage after dismiss
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: re-run when user dismisses
  const dismissed = useMemo(() => getDismissedKeys(), [dismissalVersion]);

  // Virtual Ledger 'virtual' cycles for last month - cadences a template
  // implies but that never became a real row (e.g. a template whose
  // startDate predates the cycle it first materialized). Async, so it
  // can't live in the synchronous nudge useMemo below; feeds in once
  // resolved.
  const [virtualGapCycles, setVirtualGapCycles] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const lastMonthKey = currentMonth ? getLastMonthKey(currentMonth) : null;
    if (!lastMonthKey) {
      setVirtualGapCycles([]);
      return undefined;
    }

    (async () => {
      try {
        const [y, m] = lastMonthKey.split('-').map(Number);
        const rangeStart = DateUtils.formatDate(new Date(y, m - 1, 1));
        const rangeEnd = DateUtils.formatDate(new Date(y, m, 0));

        const templates = await dbHelpers.getRecurringExpenseTemplates();
        const perTemplate = await Promise.all(
          templates.map(template =>
            dbHelpers.getVirtualLedger(template.id, rangeStart, rangeEnd),
          ),
        );
        if (cancelled) return;

        const gaps = perTemplate
          .flat()
          .filter(entry => entry.state === 'virtual')
          .map(entry => ({
            id: `virtual-${entry.template.id}-${entry.cycleDueDate}`,
            dueDate: entry.cycleDueDate,
            name: entry.template.name,
            amount: entry.estimatedAmount ?? 0,
            paidAmount: 0,
            recurringTemplateId: entry.template.id,
            isVirtual: true,
          }));
        setVirtualGapCycles(gaps);
      } catch (error) {
        logger.warn('Could not compute virtual gap cycles for nudge', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentMonth]);

  const nudge = useMemo(() => {
    // The start of the current pay cycle (most recent implied payday) -
    // scopes how recently a card's intro APR may have ended to still
    // warrant a promo_ended nudge. Null without a pay anchor, which
    // disables that nudge entirely (same stance as the pay-cycle nudges).
    const lastCycleStart = paycheckSettings?.lastPaycheckDate
      ? getMostRecentImpliedPayDate(
          paycheckSettings.lastPaycheckDate,
          paycheckSettings.frequency,
        )
      : null;

    const result = getPayCycleNudge({
      fixedExpenses,
      currentMonth,
      currentMonthExpenses,
      paycheckDates,
      paycheckService,
      today: new Date(),
      dismissed,
      virtualGapCycles,
      creditCards,
      lastCycleStart,
      resolvedExpenseIds,
    });
    return result.nudge;
  }, [
    fixedExpenses,
    currentMonth,
    currentMonthExpenses,
    paycheckDates,
    paycheckService,
    dismissed,
    virtualGapCycles,
    creditCards,
    paycheckSettings,
    resolvedExpenseIds,
  ]);

  useEffect(() => {
    if (nudge && !prevNudgeRef.current) {
      onNudgeShown?.(nudge);
    }
    prevNudgeRef.current = nudge;
  }, [nudge, onNudgeShown]);

  const dismiss = useCallback(
    (dismissKey, dontShowAgainThisMonth = false) => {
      markDismissed(dismissKey, dontShowAgainThisMonth ? 'month' : 'session');
      setDismissalVersion(v => v + 1);
      if (nudge) {
        onNudgeDismissed?.(nudge, 'dismiss');
      }
    },
    [nudge, onNudgeDismissed],
  );

  return { nudge, dismiss };
}
