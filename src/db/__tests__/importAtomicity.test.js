import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DEFAULT_PAY_FREQUENCY } from '../../constants/payFrequency';
import { db, dbHelpers } from '../database-clean';

import { createMockPaycheckSettings } from './mock-database';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const sortById = items => [...items].sort((a, b) => (a.id || 0) - (b.id || 0));

describe('dbHelpers.importData (atomic transaction)', () => {
  const now = '2026-02-01T00:00:00.000Z';

  const baseline = {
    accounts: [
      {
        id: 1,
        name: 'Baseline Checking',
        type: 'checking',
        currentBalance: 100,
        isDefault: true,
        createdAt: now,
      },
    ],
    creditCards: [
      {
        id: 1,
        name: 'Baseline Card',
        balance: 50,
        creditLimit: 1000,
        interestRate: 19.99,
        dueDate: '2026-02-15',
        statementClosingDate: '2026-02-01',
        minimumPayment: 25,
        createdAt: now,
      },
    ],
    categories: [
      {
        id: 1,
        name: 'Housing',
        color: '#FF0000',
        icon: 'home',
        isDefault: true,
        createdAt: now,
      },
    ],
    paycheckSettings: [
      createMockPaycheckSettings(DEFAULT_PAY_FREQUENCY, {
        id: 1,
        lastPaycheckDate: '2026-01-15',
        createdAt: now,
      }),
    ],
    userPreferences: [],
    recurringExpenseTemplates: [
      {
        id: 1,
        name: 'Baseline Rent',
        baseAmount: 1000,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate: '2026-02-01',
        nextDueDate: '2026-02-01',
        category: 'Housing',
        accountId: 1,
        creditCardId: null,
        targetCreditCardId: null,
        notes: '',
        isActive: true,
        isVariableAmount: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
    pendingTransactions: [
      {
        id: 1,
        accountId: 1,
        amount: 10,
        category: 'Housing',
        description: 'Baseline pending',
        createdAt: now,
      },
    ],
    fixedExpenses: [
      {
        id: 1,
        name: 'Baseline Rent',
        dueDate: '2026-02-05',
        amount: 1000,
        accountId: 1,
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Housing',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: 1,
        createdAt: now,
      },
    ],
    monthlyExpenseHistory: [],
    auditLogs: [],
  };

  const importData = {
    accounts: [
      {
        id: 1,
        name: 'Imported Checking',
        type: 'checking',
        currentBalance: 200,
        isDefault: true,
        createdAt: now,
      },
    ],
    creditCards: [
      {
        id: 1,
        name: 'Imported Card',
        balance: 75,
        creditLimit: 1500,
        interestRate: 17.5,
        dueDate: '2026-03-15',
        statementClosingDate: '2026-03-01',
        minimumPayment: 30,
        createdAt: now,
      },
    ],
    categories: [
      {
        id: 1,
        name: 'Utilities',
        color: '#00FF00',
        icon: 'zap',
        isDefault: false,
        createdAt: now,
      },
    ],
    paycheckSettings: [],
    userPreferences: [],
    recurringExpenseTemplates: [],
    pendingTransactions: [],
    fixedExpenses: [
      {
        id: 1,
        name: 'Imported Electric',
        dueDate: '2026-03-03',
        amount: 120,
        accountId: 1,
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Utilities',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ],
    monthlyExpenseHistory: [],
    auditLogs: [],
  };

  beforeEach(async () => {
    // Ensure a clean slate even if other tests left data behind
    await Promise.all([
      db.accounts.clear(),
      db.creditCards.clear(),
      db.categories.clear(),
      db.paycheckSettings.clear(),
      db.userPreferences.clear(),
      db.recurringExpenseTemplates.clear(),
      db.pendingTransactions.clear(),
      db.fixedExpenses.clear(),
      db.monthlyExpenseHistory.clear(),
      db.auditLogs.clear(),
    ]);

    // Seed baseline dataset
    await db.accounts.bulkPut(baseline.accounts);
    await db.creditCards.bulkPut(baseline.creditCards);
    await db.categories.bulkPut(baseline.categories);
    await db.paycheckSettings.bulkPut(baseline.paycheckSettings);
    await db.recurringExpenseTemplates.bulkPut(
      baseline.recurringExpenseTemplates,
    );
    await db.pendingTransactions.bulkPut(baseline.pendingTransactions);
    await db.fixedExpenses.bulkPut(baseline.fixedExpenses);
  });

  it('rolls back and preserves pre-import data if a mid-import write fails', async () => {
    const originalBulkPut = db.fixedExpenses.bulkPut.bind(db.fixedExpenses);

    db.fixedExpenses.bulkPut = async () => {
      throw new Error('Injected failure during fixedExpenses write');
    };

    try {
      await expect(dbHelpers.importData(importData)).rejects.toThrow(
        /Failed to import data/i,
      );
    } finally {
      db.fixedExpenses.bulkPut = originalBulkPut;
    }

    // Assert baseline is intact (atomic rollback)
    expect(sortById(await db.accounts.toArray())).toEqual(baseline.accounts);
    expect(sortById(await db.creditCards.toArray())).toEqual(
      baseline.creditCards,
    );
    expect(sortById(await db.categories.toArray())).toEqual(
      baseline.categories,
    );
    expect(sortById(await db.paycheckSettings.toArray())).toEqual(
      baseline.paycheckSettings,
    );
    expect(sortById(await db.recurringExpenseTemplates.toArray())).toEqual(
      baseline.recurringExpenseTemplates,
    );
    expect(sortById(await db.pendingTransactions.toArray())).toEqual(
      baseline.pendingTransactions,
    );
    expect(sortById(await db.fixedExpenses.toArray())).toEqual(
      baseline.fixedExpenses,
    );
  });

  it('replaces all data on successful import', async () => {
    await dbHelpers.importData(importData);

    expect(sortById(await db.accounts.toArray())).toEqual(importData.accounts);
    expect(sortById(await db.creditCards.toArray())).toEqual(
      importData.creditCards,
    );
    expect(sortById(await db.categories.toArray())).toEqual(
      importData.categories,
    );

    // Normalization turns empty paycheckSettings into one default row; DB may assign id
    const paycheckSettingsAfter = await db.paycheckSettings.toArray();
    expect(paycheckSettingsAfter).toHaveLength(1);
    expect(paycheckSettingsAfter[0].frequency).toBe(DEFAULT_PAY_FREQUENCY);
    expect(paycheckSettingsAfter[0].lastPaycheckDate).toBe('');
    expect(sortById(await db.recurringExpenseTemplates.toArray())).toEqual(
      importData.recurringExpenseTemplates,
    );
    expect(sortById(await db.pendingTransactions.toArray())).toEqual(
      importData.pendingTransactions,
    );
    expect(sortById(await db.fixedExpenses.toArray())).toEqual(
      importData.fixedExpenses,
    );
  });

  it('handles large fixedExpenses imports via chunked bulkPut', async () => {
    const largeFixedExpenses = Array.from({ length: 1505 }, (_v, idx) => ({
      id: idx + 1,
      name: `Imported Expense ${idx + 1}`,
      dueDate: '2026-03-10',
      amount: 1,
      accountId: 1,
      creditCardId: null,
      targetCreditCardId: null,
      category: 'Utilities',
      paidAmount: 0,
      status: 'pending',
      recurringTemplateId: null,
      createdAt: now,
    }));

    const largeImport = {
      ...importData,
      fixedExpenses: largeFixedExpenses,
    };

    await dbHelpers.importData(largeImport);
    expect((await db.fixedExpenses.count()) > 1000).toBe(true);
    expect(await db.fixedExpenses.count()).toBe(1505);
  });

  // eslint-disable-next-line quotes -- string contains single quote, Prettier uses double quotes
  it("preserves frequency: 'weekly' after import", async () => {
    const importDataWithWeekly = {
      ...importData,
      paycheckSettings: [
        createMockPaycheckSettings('weekly', {
          id: 1,
          lastPaycheckDate: '2026-01-20',
          createdAt: now,
        }),
      ],
    };
    await dbHelpers.importData(importDataWithWeekly);
    const settings = await db.paycheckSettings.toArray();
    expect(settings).toHaveLength(1);
    expect(settings[0].frequency).toBe('weekly');
  });

  // eslint-disable-next-line quotes -- string contains single quote, Prettier uses double quotes
  it("preserves frequency: 'monthly' after import", async () => {
    const importDataWithMonthly = {
      ...importData,
      paycheckSettings: [
        createMockPaycheckSettings('monthly', {
          id: 1,
          lastPaycheckDate: '2026-01-31',
          createdAt: now,
        }),
      ],
    };
    await dbHelpers.importData(importDataWithMonthly);
    const settings = await db.paycheckSettings.toArray();
    expect(settings).toHaveLength(1);
    expect(settings[0].frequency).toBe('monthly');
  });
});
