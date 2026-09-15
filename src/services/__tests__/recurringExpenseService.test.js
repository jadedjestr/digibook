import { describe, it, expect, beforeEach, vi } from 'vitest';

import { db } from '../../db/database-clean';
import { DateUtils } from '../../utils/dateUtils';
import {
  createTemplate,
  firstOccurrenceMaterializeThrough,
  getTemplate,
} from '../recurringExpenseService';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('recurringExpenseService', () => {
  describe('createTemplate', () => {
    beforeEach(async () => {
      await db.recurringExpenseTemplates.clear();
    });

    it('stores nextDueDate equal to startDate so first occurrence can be generated', async () => {
      const startDate = '2025-02-16';
      const templateId = await createTemplate({
        name: 'Test Recurring',
        baseAmount: 100,
        frequency: 'monthly',
        intervalValue: 1,
        intervalUnit: 'months',
        startDate,
        category: 'Housing',
      });

      const template = await getTemplate(templateId);
      expect(template).toBeDefined();
      expect(template.nextDueDate).toBe(startDate);
    });

    it('stores nextDueDate from startDate for future start', async () => {
      const startDate = '2025-06-01';
      const templateId = await createTemplate({
        name: 'Future Recurring',
        baseAmount: 50,
        frequency: 'monthly',
        startDate,
        category: 'Utilities',
      });

      const template = await getTemplate(templateId);
      expect(template.nextDueDate).toBe(startDate);
    });
  });

  describe('firstOccurrenceMaterializeThrough', () => {
    it('materializes through the next paycheck when pay cycle settings exist', () => {
      expect(
        firstOccurrenceMaterializeThrough('2026-09-24', '2026-09-15'),
      ).toBe('2026-09-24');
    });

    it('falls back to today (due-date-only behaviour) without paycheck settings', () => {
      expect(firstOccurrenceMaterializeThrough(null, '2026-09-15')).toBe(
        '2026-09-15',
      );
    });

    it('defaults today to DateUtils.today() when omitted', () => {
      expect(firstOccurrenceMaterializeThrough(null)).toBe(DateUtils.today());
    });
  });
});
