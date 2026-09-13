import { describe, it, expect, vi, afterEach } from 'vitest';

import { requestPersistentStorage } from '../persistentStorage';

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const withStorage = storage => {
  Object.defineProperty(navigator, 'storage', {
    value: storage,
    configurable: true,
    writable: true,
  });
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('requestPersistentStorage', () => {
  it('requests persistence when it has not been granted yet', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    withStorage({ persisted: vi.fn().mockResolvedValue(false), persist });

    await expect(requestPersistentStorage()).resolves.toEqual({
      supported: true,
      persisted: true,
    });
    expect(persist).toHaveBeenCalledTimes(1);
  });

  // Repeat prompts can count against an origin, so an already-granted state
  // must short-circuit rather than ask again.
  it('does not ask again when already granted', async () => {
    const persist = vi.fn();
    withStorage({ persisted: vi.fn().mockResolvedValue(true), persist });

    await expect(requestPersistentStorage()).resolves.toEqual({
      supported: true,
      persisted: true,
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it('reports a refusal without treating it as an error', async () => {
    withStorage({
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(false),
    });

    await expect(requestPersistentStorage()).resolves.toEqual({
      supported: true,
      persisted: false,
    });
  });

  it('reports unsupported browsers without throwing', async () => {
    withStorage(undefined);

    await expect(requestPersistentStorage()).resolves.toEqual({
      supported: false,
      persisted: false,
    });
  });

  // App startup calls this without awaiting it; a rejection must not surface
  // as an unhandled promise or take down the boot sequence.
  it('swallows a rejecting storage API', async () => {
    withStorage({
      persisted: vi.fn().mockRejectedValue(new Error('denied by policy')),
      persist: vi.fn(),
    });

    await expect(requestPersistentStorage()).resolves.toEqual({
      supported: false,
      persisted: false,
    });
  });
});
