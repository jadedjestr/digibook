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

const sortById = items =>
  [...items].sort((a, b) =>
    String(a.id || '').localeCompare(String(b.id || ''), undefined, {
      numeric: true,
    }),
  );

describe('dbHelpers.importSingleTable (CSV merge import)', () => {
  const now = '2026-02-01T00:00:00.000Z';

  const baseline = {
    accounts: [
      {
        id: '1',
        name: 'Baseline Checking',
        type: 'checking',
        currentBalance: 100,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ],
    creditCards: [
      {
        id: '1',
        name: 'Baseline Card',
        balance: 50,
        creditLimit: 1000,
        interestRate: 19.99,
        dueDate: '2026-02-15',
        statementClosingDate: '2026-02-01',
        minimumPayment: 25,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ],
    categories: [
      {
        id: '1',
        name: 'Housing',
        color: '#FF0000',
        icon: 'home',
        isDefault: true,
        createdAt: now,
        sortOrder: 0,
        updatedAt: now,
        deletedAt: null,
      },
    ],
    fixedExpenses: [
      {
        id: '1',
        name: 'Baseline Rent',
        dueDate: '2026-02-05',
        amount: 1000,
        accountId: '1',
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Housing',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ],
    pendingTransactions: [
      {
        id: '1',
        accountId: '1',
        amount: 10,
        category: 'Housing',
        description: 'Baseline pending',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ],
  };

  beforeEach(async () => {
    await Promise.all([
      db.accounts.clear(),
      db.creditCards.clear(),
      db.categories.clear(),
      db.fixedExpenses.clear(),
      db.pendingTransactions.clear(),
      db.recurringExpenseTemplates.clear(),
    ]);

    await db.accounts.bulkPut(baseline.accounts);
    await db.creditCards.bulkPut(baseline.creditCards);
    await db.categories.bulkPut(baseline.categories);
    await db.fixedExpenses.bulkPut(baseline.fixedExpenses);
    await db.pendingTransactions.bulkPut(baseline.pendingTransactions);
  });

  it('merges into the target table without touching any other table', async () => {
    await dbHelpers.importSingleTable('categories', [
      {
        id: '2',
        name: 'Utilities',
        color: '#00FF00',
        icon: 'zap',
        isDefault: false,
        createdAt: now,
        sortOrder: 1,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    // Untouched tables stay byte-for-byte identical to baseline
    expect(sortById(await db.accounts.toArray())).toEqual(baseline.accounts);
    expect(sortById(await db.creditCards.toArray())).toEqual(
      baseline.creditCards,
    );
    expect(sortById(await db.fixedExpenses.toArray())).toEqual(
      baseline.fixedExpenses,
    );
    expect(sortById(await db.pendingTransactions.toArray())).toEqual(
      baseline.pendingTransactions,
    );

    // Target table has both the original row and the merged one
    const categoriesAfter = sortById(await db.categories.toArray());
    expect(categoriesAfter).toHaveLength(2);
    expect(categoriesAfter.map(c => c.id)).toEqual(['1', '2']);
  });

  it('upserts by id: updates an existing row in place, adds a new one, no duplicates', async () => {
    await dbHelpers.importSingleTable('categories', [
      { ...baseline.categories[0], name: 'Housing (renamed)' },
      {
        id: '2',
        name: 'Utilities',
        color: '#00FF00',
        icon: 'zap',
        isDefault: false,
        createdAt: now,
        sortOrder: 1,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    const categoriesAfter = sortById(await db.categories.toArray());
    expect(categoriesAfter).toHaveLength(2);
    expect(categoriesAfter[0].name).toBe('Housing (renamed)');
    expect(categoriesAfter[1].id).toBe('2');
  });

  it('rolls back and preserves prior state if a mid-write failure occurs', async () => {
    const originalBulkPut = db.categories.bulkPut.bind(db.categories);
    db.categories.bulkPut = async () => {
      throw new Error('Injected failure during categories write');
    };

    try {
      await expect(
        dbHelpers.importSingleTable('categories', [
          { ...baseline.categories[0], name: 'Should not persist' },
        ]),
      ).rejects.toThrow(/Failed to import categories/i);
    } finally {
      db.categories.bulkPut = originalBulkPut;
    }

    expect(sortById(await db.categories.toArray())).toEqual(
      baseline.categories,
    );
  });

  it('rejects an unknown table name without touching the DB', async () => {
    await expect(
      dbHelpers.importSingleTable('notARealTable', []),
    ).rejects.toThrow(/Unknown table/i);
  });

  it('rejects non-array items without touching the DB', async () => {
    await expect(
      dbHelpers.importSingleTable('categories', { not: 'an array' }),
    ).rejects.toThrow(/Expected an array/i);

    expect(sortById(await db.categories.toArray())).toEqual(
      baseline.categories,
    );
  });

  it('handles large imports via chunked bulkPut', async () => {
    const largeCategories = Array.from({ length: 1505 }, (_v, idx) => ({
      id: String(idx + 100),
      name: `Category ${idx + 100}`,
      color: '#000000',
      icon: 'tag',
      isDefault: false,
      createdAt: now,
      sortOrder: idx,
      updatedAt: now,
      deletedAt: null,
    }));

    await dbHelpers.importSingleTable('categories', largeCategories);

    // baseline's one row + the 1505 newly-merged rows
    expect(await db.categories.count()).toBe(1506);
  });

  it('rejects a fixedExpenses row with a dangling accountId, without touching the DB', async () => {
    await expect(
      dbHelpers.importSingleTable('fixedExpenses', [
        {
          id: '2',
          name: 'Broken Expense',
          dueDate: '2026-03-01',
          amount: 50,
          accountId: 'does-not-exist',
          creditCardId: null,
          targetCreditCardId: null,
          category: 'Housing',
          paidAmount: 0,
          status: 'pending',
          recurringTemplateId: null,
          createdAt: now,
        },
      ]),
    ).rejects.toThrow(/Invalid references/i);

    expect(sortById(await db.fixedExpenses.toArray())).toEqual(
      baseline.fixedExpenses,
    );
  });

  it('allows a fixedExpenses row whose accountId references a real account', async () => {
    await dbHelpers.importSingleTable('fixedExpenses', [
      {
        id: '2',
        name: 'New Expense',
        dueDate: '2026-03-01',
        amount: 50,
        accountId: '1',
        creditCardId: null,
        targetCreditCardId: null,
        category: 'Housing',
        paidAmount: 0,
        status: 'pending',
        recurringTemplateId: null,
        createdAt: now,
      },
    ]);

    expect(await db.fixedExpenses.count()).toBe(2);
  });
});
