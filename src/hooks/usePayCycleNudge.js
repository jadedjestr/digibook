import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getDismissedKeys, markDismissed } from '../utils/nudgeDismissal';
import { getPayCycleNudge } from '../utils/payCycleNudgeLogic';

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
  onNudgeShown,
  onNudgeDismissed,
  onNudgeAction: _onNudgeAction,
}) {
  const [dismissalVersion, setDismissalVersion] = useState(0);
  const prevNudgeRef = useRef(null);

  // dismissalVersion forces re-read of sessionStorage after dismiss
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: re-run when user dismisses
  const dismissed = useMemo(() => getDismissedKeys(), [dismissalVersion]);

  const nudge = useMemo(() => {
    const result = getPayCycleNudge({
      fixedExpenses,
      currentMonth,
      currentMonthExpenses,
      paycheckDates,
      paycheckService,
      today: new Date(),
      dismissed,
    });
    return result.nudge;
  }, [
    fixedExpenses,
    currentMonth,
    currentMonthExpenses,
    paycheckDates,
    paycheckService,
    dismissed,
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
