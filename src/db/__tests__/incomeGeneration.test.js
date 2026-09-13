import { describe, it, expect, beforeEach, vi } from 'vitest';

import { db, dbHelpers } from '../database-clean';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const now = '2026-02-01T00:00:00.000Z';
const ACCOUNT_ID = 'acct-1';

/** Days before today, as YYYY-MM-DD in local time (matches DateUtils). */
const daysAgo = n => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  const pad = v => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const seedSource = async (overrides = {}) =>
  dbHelpers.upsertIncomeSource({
    name: 'Paycheck',
    accountId: ACCOUNT_ID,
    expectedAmount: 1200,
    isEnabled: true,
    ...overrides,
  });

describe('dbHelpers.generateDueIncome', () => {
  beforeEach(async () => {
    await Promise.all([
      db.accounts.clear(),
      db.pendingTransactions.clear(),
      db.paycheckSettings.clear(),
      db.incomeSources.clear(),
      db.categories.clear(),
    ]);

    await db.accounts.put({
      id: ACCOUNT_ID,
      name: 'Checking',
      type: 'checking',
      currentBalance: 500,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    await db.paycheckSettings.put({
      id: 'pay-1',
      lastPaycheckDate: daysAgo(28),
      frequency: 'biweekly',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  });

  it('creates one pending row per payday that has passed', async () => {
    await seedSource();

    const { generated } = await dbHelpers.generateDueIncome();

    // Anchored 28 days back on a biweekly cycle: two paydays have passed.
    expect(generated).toBe(2);
    const rows = (await db.pendingTransactions.toArray()).filter(
      t => !t.deletedAt,
    );
    expect(rows).toHaveLength(2);
    expect(rows.map(r => r.date).sort()).toEqual([daysAgo(14), daysAgo(0)]);
  });

  // The property the whole design rests on: a forecast must never be able to
  // produce a wrong balance.
  it('does not touch any account balance', async () => {
    await seedSource();

    await dbHelpers.generateDueIncome();

    const [account] = await db.accounts.toArray();
    expect(account.currentBalance).toBe(500);
    expect(account.updatedAt).toBe(now);
  });

  it('writes income as a positive amount so completion adds to the balance', async () => {
    await seedSource();
    await dbHelpers.generateDueIncome();

    const [row] = (await db.pendingTransactions.toArray()).filter(
      t => !t.deletedAt,
    );
    expect(row.amount).toBe(1200);
    expect(row.type).toBe('income');
    expect(row.accountId).toBe(ACCOUNT_ID);
  });

  it('is idempotent — a second run creates nothing', async () => {
    await seedSource();

    const first = await dbHelpers.generateDueIncome();
    const second = await dbHelpers.generateDueIncome();

    expect(first.generated).toBe(2);
    expect(second.generated).toBe(0);
    const rows = (await db.pendingTransactions.toArray()).filter(
      t => !t.deletedAt,
    );
    expect(rows).toHaveLength(2);
  });

  it('generates nothing while disabled', async () => {
    await seedSource({ isEnabled: false });

    const { generated } = await dbHelpers.generateDueIncome();

    expect(generated).toBe(0);
    expect(await db.pendingTransactions.count()).toBe(0);
  });

  it('generates nothing when no source has been configured', async () => {
    const { generated } = await dbHelpers.generateDueIncome();
    expect(generated).toBe(0);
  });

  it('caps a long absence instead of flooding the list', async () => {
    await db.paycheckSettings.clear();
    await db.paycheckSettings.put({
      id: 'pay-1',
      lastPaycheckDate: daysAgo(365),
      frequency: 'weekly',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    await seedSource();

    const { generated } = await dbHelpers.generateDueIncome();

    // A year of weekly paydays is 52; the cap keeps it manageable.
    expect(generated).toBeLessThanOrEqual(7);
    expect(generated).toBeGreaterThan(0);
  });

  it('disables itself rather than orphaning income when the account is gone', async () => {
    await seedSource();
    await db.accounts.update(ACCOUNT_ID, { deletedAt: now });

    const { generated } = await dbHelpers.generateDueIncome();

    expect(generated).toBe(0);
    const source = await dbHelpers.getPrimaryIncomeSource();
    expect(source.isEnabled).toBe(false);
  });

  it('does not backfill when enabling sets the anchor to today', async () => {
    // Mirrors what the settings UI does on enable.
    await seedSource({ lastGeneratedDate: daysAgo(0) });

    const { generated } = await dbHelpers.generateDueIncome();

    expect(generated).toBe(0);
  });
});

describe('dbHelpers.sweepUnconfirmedIncome', () => {
  beforeEach(async () => {
    await Promise.all([
      db.accounts.clear(),
      db.pendingTransactions.clear(),
      db.paycheckSettings.clear(),
      db.incomeSources.clear(),
    ]);

    await db.accounts.put({
      id: ACCOUNT_ID,
      name: 'Checking',
      type: 'checking',
      currentBalance: 500,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    await db.paycheckSettings.put({
      id: 'pay-1',
      lastPaycheckDate: daysAgo(28),
      frequency: 'biweekly',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  });

  it('removes predictions but keeps confirmed paychecks', async () => {
    const sourceId = await seedSource();
    await dbHelpers.generateDueIncome();

    const rows = (await db.pendingTransactions.toArray()).filter(
      t => !t.deletedAt,
    );
    expect(rows).toHaveLength(2);

    // The user confirms one of them — that one is now real history.
    await dbHelpers.completePendingTransaction(rows[0].id);

    const swept = await dbHelpers.sweepUnconfirmedIncome(sourceId);
    expect(swept).toBe(1);

    const remaining = (await db.pendingTransactions.toArray()).filter(
      t => !t.deletedAt,
    );
    expect(remaining).toHaveLength(0);

    // The confirmed one still exists as a soft-deleted record, and the money
    // it moved is still in the account.
    const confirmed = await db.pendingTransactions.get(rows[0].id);
    expect(confirmed).toBeDefined();
    const [account] = await db.accounts.toArray();
    expect(account.currentBalance).toBe(500 + rows[0].amount);
  });
});

describe('confirming generated income', () => {
  beforeEach(async () => {
    await Promise.all([
      db.accounts.clear(),
      db.pendingTransactions.clear(),
      db.paycheckSettings.clear(),
      db.incomeSources.clear(),
      db.auditLogs.clear(),
    ]);
    await db.accounts.put({
      id: ACCOUNT_ID,
      name: 'Checking',
      type: 'checking',
      currentBalance: 500,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
    await db.paycheckSettings.put({
      id: 'pay-1',
      lastPaycheckDate: daysAgo(14),
      frequency: 'biweekly',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  });

  it('moves the balance by exactly the amount and writes an audit entry', async () => {
    await seedSource({ expectedAmount: 1200 });
    await dbHelpers.generateDueIncome();

    const [row] = (await db.pendingTransactions.toArray()).filter(
      t => !t.deletedAt,
    );
    await dbHelpers.completePendingTransaction(row.id);

    const [account] = await db.accounts.toArray();
    expect(account.currentBalance).toBe(1700);

    const logs = await db.auditLogs.toArray();
    const entry = logs.find(l => l.entityId === row.id);
    expect(entry).toBeDefined();
    expect(entry.details).toMatchObject({
      amount: 1200,
      previousBalance: 500,
      newBalance: 1700,
    });
  });
});
