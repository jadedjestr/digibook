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

/**
 * localStorage — a working in-memory implementation, not bare stubs.
 *
 * This was four `vi.fn()`s that stored nothing and returned `undefined`.
 * That double is worse than no double: it cannot fail, so every assertion
 * about persistence passed vacuously, and it reported `undefined` for a
 * missing key where the real API returns `null` — the precise difference
 * that let a missing-key bug reach the browser (`Number(null)` is 0, so an
 * absent preference read as a real value of 0).
 *
 * Spies are kept on top so tests can still assert call counts.
 */
const createLocalStorageMock = () => {
  let store = new Map();
  return {
    getItem: vi.fn(key =>
      store.has(String(key)) ? store.get(String(key)) : null,
    ),
    setItem: vi.fn((key, value) => {
      store.set(String(key), String(value));
    }),
    removeItem: vi.fn(key => {
      store.delete(String(key));
    }),
    clear: vi.fn(() => {
      store = new Map();
    }),
    key: vi.fn(index => [...store.keys()][index] ?? null),
    get length() {
      return store.size;
    },
  };
};

const localStorageMock = createLocalStorageMock();
global.localStorage = localStorageMock;

// Some code reaches it through window rather than the global.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
}

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
