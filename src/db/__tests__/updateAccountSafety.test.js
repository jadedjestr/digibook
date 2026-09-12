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

describe('dbHelpers.updateAccount (bounds + concurrency check)', () => {
  const now = '2026-02-01T00:00:00.000Z';

  beforeEach(async () => {
    await db.accounts.clear();

    await db.accounts.bulkPut([
      {
        id: '1',
        name: 'Checking',
        type: 'checking',
        currentBalance: 100,
        isDefault: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
  });

  it('rejects a non-finite currentBalance and makes no changes', async () => {
    await expect(
      dbHelpers.updateAccount('1', { currentBalance: Infinity }),
    ).rejects.toThrow(/finite number/);

    const [account] = await db.accounts.toArray();
    expect(account.currentBalance).toBe(100);
    expect(account.updatedAt).toBe(now);
  });

  it('rejects NaN currentBalance', async () => {
    await expect(
      dbHelpers.updateAccount('1', { currentBalance: NaN }),
    ).rejects.toThrow(/finite number/);
  });

  it('allows a finite currentBalance update', async () => {
    await dbHelpers.updateAccount('1', { currentBalance: 250 });
    const [account] = await db.accounts.toArray();
    expect(account.currentBalance).toBe(250);
  });

  it('allows updates that do not touch currentBalance', async () => {
    await dbHelpers.updateAccount('1', { name: 'Renamed' });
    const [account] = await db.accounts.toArray();
    expect(account.name).toBe('Renamed');
  });

  it('rejects a stale write and makes no changes', async () => {
    await expect(
      dbHelpers.updateAccount(
        '1',
        { currentBalance: 500 },
        '2020-01-01T00:00:00.000Z',
      ),
    ).rejects.toThrow(/STALE_WRITE/);

    const [account] = await db.accounts.toArray();
    expect(account.currentBalance).toBe(100);
    expect(account.updatedAt).toBe(now);
  });

  it('succeeds when expectedUpdatedAt matches the current row', async () => {
    await dbHelpers.updateAccount('1', { currentBalance: 500 }, now);
    const [account] = await db.accounts.toArray();
    expect(account.currentBalance).toBe(500);
  });

  it('still works when expectedUpdatedAt is omitted (back-compat)', async () => {
    await dbHelpers.updateAccount('1', { currentBalance: 500 });
    const [account] = await db.accounts.toArray();
    expect(account.currentBalance).toBe(500);
  });
});

describe('dbHelpers.addAccount (bounds check)', () => {
  beforeEach(async () => {
    await db.accounts.clear();
  });

  it('rejects a non-finite starting balance', async () => {
    await expect(
      dbHelpers.addAccount({
        name: 'New Account',
        type: 'checking',
        currentBalance: Infinity,
      }),
    ).rejects.toThrow(/valid number/);

    expect(await db.accounts.count()).toBe(0);
  });

  it('accepts a finite starting balance', async () => {
    const id = await dbHelpers.addAccount({
      name: 'New Account',
      type: 'checking',
      currentBalance: 500,
    });
    expect(id).toBeTruthy();
    expect(await db.accounts.count()).toBe(1);
  });
});
