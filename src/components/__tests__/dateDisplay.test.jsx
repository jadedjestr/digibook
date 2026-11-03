import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PrivacyProvider } from '../../contexts/PrivacyContext';
import { DateUtils } from '../../utils/dateUtils';
import { getPayCycleNudge } from '../../utils/payCycleNudgeLogic';
import CreditCardDebtTable from '../CreditCardDebtTable';

// A YYYY-MM-DD string is a calendar day. `new Date('2026-11-05')` is midnight
// UTC, which prints as Nov 4 west of Greenwich. Pin a zone there so these
// fail anywhere.
process.env.TZ = 'America/Los_Angeles';

describe('dates shown on screen', () => {
  it('runs in a zone west of UTC, or this suite proves nothing', () => {
    expect(new Date('2026-11-05').getDate()).toBe(4);
  });

  it('shows a card’s due date as the day it is', () => {
    render(
      <PrivacyProvider>
        <CreditCardDebtTable
          creditCards={[
            {
              id: 'visa',
              name: 'Visa',
              balance: 900,
              creditLimit: 5000,
              interestRate: 20,
              dueDate: '2026-11-05',
            },
          ]}
        />
      </PrivacyProvider>,
    );
    expect(screen.getByText('Nov 5')).toBeTruthy();
    expect(screen.queryByText('Nov 4')).toBeNull();
  });

  it('names last month correctly in the unpaid-last-month nudge', () => {
    const { nudge } = getPayCycleNudge({
      fixedExpenses: [
        { id: 1, dueDate: '2026-10-15', amount: 100, paidAmount: 0 },
      ],
      currentMonth: new Date(2026, 10, 1),
      today: new Date(2026, 10, 2),
    });
    expect(nudge.type).toBe('past_month');
    expect(nudge.payload.lastMonthLabel).toBe('October 2026');
  });

  describe('DateUtils.toLocalDay', () => {
    it('keeps a calendar day as it is', () => {
      expect(DateUtils.toLocalDay('2029-11-02')).toBe('2029-11-02');
    });

    it('turns a moment into the local day, not the UTC day', () => {
      // 7:24 pm on 2 Nov in Los Angeles is 03:24 on 3 Nov UTC.
      const moment = new Date(2029, 10, 2, 19, 24).toISOString();
      expect(moment.startsWith('2029-11-03')).toBe(true);
      expect(DateUtils.toLocalDay(moment)).toBe('2029-11-02');
    });

    it('is null when there is nothing to convert', () => {
      expect(DateUtils.toLocalDay('')).toBeNull();
      expect(DateUtils.toLocalDay(null)).toBeNull();
    });
  });
});
