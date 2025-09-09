import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock IndexedDB for testing
const FDBFactory = require('fake-indexeddb/lib/FDBFactory');
const FDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

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

  // Clear fake indexedDB
  const dbs = await indexedDB.databases();
  await Promise.all(
    dbs.map(db => {
      return new Promise(resolve => {
        const req = indexedDB.deleteDatabase(db.name);
        req.onsuccess = resolve;
        req.onerror = resolve;
      });
    })
  );

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
