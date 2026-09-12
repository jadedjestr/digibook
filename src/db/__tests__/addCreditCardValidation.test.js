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

describe('dbHelpers.addCreditCard (validation)', () => {
  beforeEach(async () => {
    await db.creditCards.clear();
  });

  it('rejects a missing name', async () => {
    await expect(dbHelpers.addCreditCard({ balance: 100 })).rejects.toThrow(
      /name is required/,
    );
    expect(await db.creditCards.count()).toBe(0);
  });

  it('rejects a blank name', async () => {
    await expect(
      dbHelpers.addCreditCard({ name: '   ', balance: 100 }),
    ).rejects.toThrow(/name is required/);
  });

  it('rejects a non-finite balance', async () => {
    await expect(
      dbHelpers.addCreditCard({ name: 'Card', balance: Infinity }),
    ).rejects.toThrow(/finite number/);
    expect(await db.creditCards.count()).toBe(0);
  });

  it('rejects a missing balance', async () => {
    await expect(dbHelpers.addCreditCard({ name: 'Card' })).rejects.toThrow(
      /finite number/,
    );
  });

  it('accepts valid input', async () => {
    const id = await dbHelpers.addCreditCard({ name: 'Card', balance: 500 });
    expect(id).toBeTruthy();
    expect(await db.creditCards.count()).toBe(1);
  });
});
