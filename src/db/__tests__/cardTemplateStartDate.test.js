import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { db, dbHelpers } from '../database-clean';

// A card with no due date gets its payment bill starting today. "Today" is
// the local calendar day: the UTC date is already tomorrow on an evening in
// the Americas. Pin a zone west of Greenwich so this fails anywhere.
process.env.TZ = 'America/Los_Angeles';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const stamp = {
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  deletedAt: null,
};

describe('a card with no due date', () => {
  beforeEach(async () => {
    await Promise.all(
      [
        db.accounts,
        db.creditCards,
        db.fixedExpenses,
        db.recurringExpenseTemplates,
      ].map(table => table.clear()),
    );
    await db.accounts.put({
      id: 'checking',
      name: 'Checking',
      type: 'checking',
      currentBalance: 1000,
      isDefault: true,
      ...stamp,
    });
    await db.creditCards.put({
      id: 'visa',
      name: 'Visa',
      balance: 500,
      creditLimit: 5000,
      interestRate: 20,
      minimumPayment: 35,
      ...stamp,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts its payment bill on the local day, even in the evening', async () => {
    // 9 pm on 2 Nov in Los Angeles is already 3 Nov in UTC.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 2, 21, 0) });
    // eslint-disable-next-line no-restricted-syntax -- shows the UTC date is already tomorrow
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-11-03');

    await dbHelpers.createExpenseForCard('visa', 'checking');

    const [template] = await db.recurringExpenseTemplates.toArray();
    expect(template).toMatchObject({
      startDate: '2026-11-02',
      nextDueDate: '2026-11-02',
    });
  });
});
