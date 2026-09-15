import { describe, it, expect, beforeEach, vi } from 'vitest';

import { DateUtils } from '../../utils/dateUtils';
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

describe('dbHelpers.selfHealPaycheckAnchor', () => {
  const now = '2026-09-01T00:00:00.000Z';
  const today = DateUtils.today();

  beforeEach(async () => {
    await Promise.all([db.paycheckSettings.clear(), db.auditLogs.clear()]);
  });

  async function seedSettings({ lastPaycheckDate, frequency = 'weekly' }) {
    await db.paycheckSettings.bulkPut([
      {
        id: 'settings-1',
        lastPaycheckDate,
        frequency,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);
  }

  it('is a no-op when the anchor is still within the 2-day safe zone', async () => {
    // Weekly, anchor exactly on the implied payday: 0 days past.
    await seedSettings({ lastPaycheckDate: today, frequency: 'weekly' });

    const result = await dbHelpers.selfHealPaycheckAnchor();

    expect(result).toEqual({ advanced: false });
    const settings = await dbHelpers.getPaycheckSettings();
    expect(settings.lastPaycheckDate).toBe(today);
    expect(await db.auditLogs.count()).toBe(0);
  });

  it('is a no-op at exactly 2 days past the implied payday', async () => {
    // Weekly anchor 9 days ago -> implied payday is 2 days ago.
    const staleAnchor = DateUtils.addDays(today, -9);
    await seedSettings({ lastPaycheckDate: staleAnchor, frequency: 'weekly' });

    const result = await dbHelpers.selfHealPaycheckAnchor();

    expect(result).toEqual({ advanced: false });
    const settings = await dbHelpers.getPaycheckSettings();
    expect(settings.lastPaycheckDate).toBe(staleAnchor);
    expect(await db.auditLogs.count()).toBe(0);
  });

  it('advances the anchor at exactly 3 days past the implied payday and logs it', async () => {
    // Weekly anchor 17 days ago -> implied payday is 3 days ago (17 - 14).
    const staleAnchor = DateUtils.addDays(today, -17);
    const impliedPayDate = DateUtils.addDays(today, -3);
    await seedSettings({ lastPaycheckDate: staleAnchor, frequency: 'weekly' });

    const result = await dbHelpers.selfHealPaycheckAnchor();

    expect(result).toEqual({
      advanced: true,
      previousDate: staleAnchor,
      newDate: impliedPayDate,
    });

    const settings = await dbHelpers.getPaycheckSettings();
    expect(settings.lastPaycheckDate).toBe(impliedPayDate);
    expect(settings.frequency).toBe('weekly');

    const logEntries = await db.auditLogs.toArray();
    expect(logEntries).toHaveLength(1);
    expect(logEntries[0]).toMatchObject({
      actionType: 'SELF_HEAL_PAYCHECK_ANCHOR',
      entityType: 'paycheckSettings',
      entityId: 'settings-1',
      details: {
        previousDate: staleAnchor,
        newDate: impliedPayDate,
        daysPast: 3,
      },
    });
  });

  it('advances a badly stale anchor to the most recent implied payday, not just one step forward', async () => {
    // Monthly anchor 2 months + 9 days ago.
    const staleAnchor = DateUtils.addDays(today, -69);
    await seedSettings({ lastPaycheckDate: staleAnchor, frequency: 'monthly' });

    const result = await dbHelpers.selfHealPaycheckAnchor();

    expect(result.advanced).toBe(true);
    expect(result.newDate).not.toBe(staleAnchor);

    // Whatever it resolved to, it must be the most recent implied payday -
    // i.e. less than one calendar month (at most 31 days) behind today,
    // proving the walk didn't stop short at the first stale cycle.
    const daysPast = DateUtils.daysBetween(result.newDate, today);
    expect(daysPast).toBeGreaterThanOrEqual(0);
    expect(daysPast).toBeLessThan(31);
  });

  it('is a no-op when paycheck settings are missing', async () => {
    const result = await dbHelpers.selfHealPaycheckAnchor();

    expect(result).toEqual({ advanced: false });
    expect(await db.auditLogs.count()).toBe(0);
  });

  it('is a no-op when lastPaycheckDate or frequency is missing from settings', async () => {
    await db.paycheckSettings.bulkPut([
      {
        id: 'settings-1',
        lastPaycheckDate: '',
        frequency: 'weekly',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    const result = await dbHelpers.selfHealPaycheckAnchor();

    expect(result).toEqual({ advanced: false });
  });
});
