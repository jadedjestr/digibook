import { describe, it, expect, beforeEach, vi } from 'vitest';

import { db } from '../../db/database-clean';
import { dataManager } from '../dataManager';

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

const baselineAccount = {
  id: '1',
  name: 'Baseline Checking',
  type: 'checking',
  currentBalance: 100,
  isDefault: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

const baselineCategory = {
  id: '1',
  name: 'Housing',
  color: '#FF0000',
  icon: 'home',
  isDefault: true,
  createdAt: now,
  sortOrder: 0,
  updatedAt: now,
  deletedAt: null,
};

const baselineFixedExpense = {
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
};

// jsdom's File/Blob implementation doesn't implement the async read methods
// (text(), arrayBuffer()) that real browsers provide - patch just what
// dataManager.readImportFile() needs, only on the File instances built here.
function makeTextFile(content, filename, type) {
  const file = new File([content], filename, { type });
  if (typeof file.text !== 'function') {
    file.text = () => Promise.resolve(content);
  }
  return file;
}

async function seedBaseline() {
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
    db.backups.clear(),
  ]);

  await db.accounts.bulkPut([baselineAccount]);
  await db.categories.bulkPut([baselineCategory]);
  await db.fixedExpenses.bulkPut([baselineFixedExpense]);
}

describe('dataManager', () => {
  beforeEach(async () => {
    await seedBaseline();
  });

  describe('BackupManager.createBackup (Bug #1: exponential backup nesting)', () => {
    it('does not grow backup payload size across repeated backups of unchanged data', async () => {
      const firstId = await dataManager.backupManager.createBackup('manual');
      const secondId = await dataManager.backupManager.createBackup('manual');
      const thirdId = await dataManager.backupManager.createBackup('manual');

      const backups = await db.backups.toArray();
      const byId = id => backups.find(b => b.id === id);
      const sizeOf = backup => JSON.stringify(backup.data).length;

      expect(sizeOf(byId(secondId))).toBe(sizeOf(byId(firstId)));
      expect(sizeOf(byId(thirdId))).toBe(sizeOf(byId(firstId)));

      // None of the stored backup payloads should carry a nested `backups` field
      expect(byId(firstId).data).not.toHaveProperty('backups');
      expect(byId(secondId).data).not.toHaveProperty('backups');
      expect(byId(thirdId).data).not.toHaveProperty('backups');
    });

    it('keeps at most 5 backups after repeated creation (rotation)', async () => {
      for (let i = 0; i < 7; i++) {
        await dataManager.backupManager.createBackup('manual');
      }
      const backups = await db.backups.toArray();
      expect(backups.length).toBeLessThanOrEqual(5);
    });
  });

  describe('BackupManager.restoreBackup (restores the exact backup requested)', () => {
    it('restores a non-latest backup by id, not whichever one was created most recently', async () => {
      const idA = await dataManager.backupManager.createBackup('manual');

      await db.accounts.update('1', { currentBalance: 500 });
      const idB = await dataManager.backupManager.createBackup('manual');

      // Mutate again after the last backup so a correct restore can't be
      // confused with "just leave the current data alone".
      await db.accounts.update('1', { currentBalance: 999 });

      await dataManager.backupManager.restoreBackup(idA);

      const accountsAfter = await db.accounts.toArray();
      expect(accountsAfter.find(a => a.id === '1').currentBalance).toBe(100);

      // Confirms idA and idB really captured distinct snapshots.
      const backups = await db.backups.toArray();
      const backupB = backups.find(b => b.id === idB);
      expect(backupB.data.accounts.find(a => a.id === '1').currentBalance).toBe(
        500,
      );
    });
  });

  describe('BackupManager.catchUpMissedBackup (Bug: missed scheduled backups)', () => {
    it('creates a backup when no scheduled_daily backup has ever run', async () => {
      await dataManager.backupManager.catchUpMissedBackup();

      const backups = await db.backups.toArray();
      expect(backups.filter(b => b.reason === 'scheduled_daily')).toHaveLength(
        1,
      );
    });

    it('creates a backup when the last one is more than 25 hours old', async () => {
      const twentySixHoursMs = 26 * 60 * 60 * 1000;
      const staleTimestamp = new Date(
        Date.now() - twentySixHoursMs,
      ).toISOString();
      await db.backups.add({
        id: 'stale-backup',
        reason: 'scheduled_daily',
        timestamp: staleTimestamp,
        version: 5,
        createdAt: staleTimestamp,
        data: { accounts: [] },
        checksum: 'irrelevant',
      });

      await dataManager.backupManager.catchUpMissedBackup();

      const backups = await db.backups.toArray();
      const scheduled = backups.filter(b => b.reason === 'scheduled_daily');
      expect(scheduled).toHaveLength(2);
    });

    it('does not create a backup when a recent one already exists', async () => {
      const oneHourMs = 60 * 60 * 1000;
      const recentTimestamp = new Date(Date.now() - oneHourMs).toISOString();
      await db.backups.add({
        id: 'recent-backup',
        reason: 'scheduled_daily',
        timestamp: recentTimestamp,
        version: 5,
        createdAt: recentTimestamp,
        data: { accounts: [] },
        checksum: 'irrelevant',
      });

      await dataManager.backupManager.catchUpMissedBackup();

      const backups = await db.backups.toArray();
      const scheduled = backups.filter(b => b.reason === 'scheduled_daily');
      expect(scheduled).toHaveLength(1);
      expect(scheduled[0].id).toBe('recent-backup');
    });
  });

  describe('importData - CSV vs JSON branching (Bug #2: non-functional CSV import)', () => {
    it('merges a single-table CSV import into only the matching table', async () => {
      const csvText = [
        'id,name,color,icon,isDefault,sortOrder',
        '2,Utilities,#00FF00,zap,false,1',
      ].join('\n');
      const csvFile = makeTextFile(
        csvText,
        'categories_2026-09-11.csv',
        'text/csv',
      );

      await dataManager.importData(csvFile, () => {});

      const categoriesAfter = await db.categories.toArray();
      expect(categoriesAfter.map(c => c.id).sort()).toEqual(['1', '2']);

      // Unrelated tables are completely untouched by the CSV merge
      expect(await db.accounts.toArray()).toEqual([baselineAccount]);
      expect(await db.fixedExpenses.toArray()).toEqual([baselineFixedExpense]);
    });

    it('still fully replaces all data for a JSON import', async () => {
      const jsonPayload = {
        accounts: [
          {
            id: '9',
            name: 'Imported Checking',
            type: 'checking',
            currentBalance: 500,
            isDefault: true,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          },
        ],
        creditCards: [],
        pendingTransactions: [],
        fixedExpenses: [],
        categories: [
          {
            id: '9',
            name: 'Imported Category',
            color: '#123456',
            icon: 'tag',
            isDefault: false,
            createdAt: now,
            sortOrder: 0,
            updatedAt: now,
            deletedAt: null,
          },
        ],
        paycheckSettings: [],
        userPreferences: [],
        recurringExpenseTemplates: [],
        monthlyExpenseHistory: [],
        auditLogs: [],
      };
      const jsonFile = makeTextFile(
        JSON.stringify(jsonPayload),
        'digibook_backup_2026-09-11.json',
        'application/json',
      );

      await dataManager.importData(jsonFile, () => {});

      expect((await db.accounts.toArray()).map(a => a.id)).toEqual(['9']);
      expect((await db.categories.toArray()).map(c => c.id)).toEqual(['9']);

      // Full replace: the baseline fixedExpenses row is gone
      expect(await db.fixedExpenses.count()).toBe(0);
    });
  });
});
