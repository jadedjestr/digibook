import '@testing-library/jest-dom';

// Mock IndexedDB for testing
import FDBFactory from 'fake-indexeddb/lib/FDBFactory';
import FDBKeyRange from 'fake-indexeddb/lib/FDBKeyRange';
import { vi } from 'vitest';

// Setup fake indexedDB
const indexedDB = new FDBFactory();
const IDBKeyRange = FDBKeyRange;

global.indexedDB = indexedDB;
global.IDBKeyRange = IDBKeyRange;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Reset mocks and database before each test
beforeEach(async () => {
  // Clear all mocks
  vi.clearAllMocks();

  // Load app db after fake indexedDB is set (dynamic import so Dexie uses the fake)
  const { db } = await import('../db/database-clean');

  // Clear fake indexedDB (preserve app DB so tests using it stay valid)
  const dbs = await indexedDB.databases();
  await Promise.all(
    dbs
      .filter(database => database.name !== db.name)
      .map(database => {
        return new Promise(resolve => {
          const req = indexedDB.deleteDatabase(database.name);
          req.onsuccess = resolve;
          req.onerror = resolve;
        });
      }),
  );

  // Clear all tables on app db so each test gets a clean slate
  if (db.tables && db.tables.length > 0) {
    await Promise.all(db.tables.map(table => table.clear()));
  }

  // Clear localStorage mock
  localStorageMock.clear();
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
