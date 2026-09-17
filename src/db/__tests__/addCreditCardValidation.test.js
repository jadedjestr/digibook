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

const validCard = () => ({
  name: 'Card',
  balance: 500,
  interestRate: 18,
  originalBalance: 1000,
  targetPayoffDate: '2030-01-01',
  hasIntroApr: false,
});

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
    const id = await dbHelpers.addCreditCard(validCard());
    expect(id).toBeTruthy();
    expect(await db.creditCards.count()).toBe(1);
  });

  describe('original balance (required)', () => {
    it('rejects a missing originalBalance', async () => {
      const card = validCard();
      delete card.originalBalance;
      await expect(dbHelpers.addCreditCard(card)).rejects.toThrow(
        /Original balance/,
      );
    });

    it('rejects a non-positive originalBalance', async () => {
      await expect(
        dbHelpers.addCreditCard({ ...validCard(), originalBalance: 0 }),
      ).rejects.toThrow(/Original balance/);
    });
  });

  describe('target payoff date (required)', () => {
    it('rejects a missing targetPayoffDate', async () => {
      const card = validCard();
      delete card.targetPayoffDate;
      await expect(dbHelpers.addCreditCard(card)).rejects.toThrow(
        /Target payoff date/,
      );
    });

    it('rejects an unreachable targetPayoffDate', async () => {
      await expect(
        dbHelpers.addCreditCard({
          ...validCard(),
          targetPayoffDate: '2020-01-01',
        }),
      ).rejects.toThrow(/at least one billing cycle away/);
    });
  });

  describe('intro APR (required choice)', () => {
    it('rejects a missing hasIntroApr', async () => {
      const card = validCard();
      delete card.hasIntroApr;
      await expect(dbHelpers.addCreditCard(card)).rejects.toThrow(
        /whether this card has an intro/,
      );
    });

    it('rejects hasIntroApr: true with a missing introApr', async () => {
      await expect(
        dbHelpers.addCreditCard({
          ...validCard(),
          hasIntroApr: true,
          introAprEndDate: '2030-01-01',
        }),
      ).rejects.toThrow(/Intro APR must be a finite number/);
    });

    it('rejects hasIntroApr: true with a missing introAprEndDate', async () => {
      await expect(
        dbHelpers.addCreditCard({
          ...validCard(),
          hasIntroApr: true,
          introApr: 0,
        }),
      ).rejects.toThrow(/Intro APR end date is required/);
    });

    it('rejects hasIntroApr: true with a past introAprEndDate', async () => {
      await expect(
        dbHelpers.addCreditCard({
          ...validCard(),
          hasIntroApr: true,
          introApr: 0,
          introAprEndDate: '2020-01-01',
        }),
      ).rejects.toThrow(/must be in the future/);
    });

    it('rejects hasIntroApr: false with a stray introApr set', async () => {
      await expect(
        dbHelpers.addCreditCard({
          ...validCard(),
          hasIntroApr: false,
          introApr: 0,
        }),
      ).rejects.toThrow(/must be empty when this card has no intro APR/);
    });

    it('accepts hasIntroApr: false as a complete, valid answer', async () => {
      const id = await dbHelpers.addCreditCard(validCard());
      expect(id).toBeTruthy();
    });

    it('accepts a fully-valid hasIntroApr: true card', async () => {
      const futureDate = '2027-01-01';
      const id = await dbHelpers.addCreditCard({
        ...validCard(),
        hasIntroApr: true,
        introApr: 0,
        introAprEndDate: futureDate,
      });
      expect(id).toBeTruthy();
    });
  });
});
