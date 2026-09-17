import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { securePINStorage } from '../crypto';

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// The PIN lock must fail closed: when WebCrypto is unavailable, the PIN is
// never stored - least of all in plaintext. These tests pin that invariant
// by breaking the global crypto object and asserting both the rejection and
// the absence of any stored PIN.
describe('securePINStorage — fail closed', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('never falls back to plaintext storage when crypto is unavailable', async () => {
    vi.stubGlobal('crypto', { subtle: undefined });

    await expect(securePINStorage.setPIN('1234')).rejects.toThrow(
      /securely store PIN/i,
    );
    expect(localStorage.getItem('digibook_pin')).toBeNull();
    expect(localStorage.getItem('digibook_encrypted_pin')).toBeNull();
  });

  it('getPIN returns an empty string when nothing is stored', async () => {
    expect(await securePINStorage.getPIN()).toBe('');
  });

  it('getPIN still reads a legacy plaintext PIN (read-only migration path)', async () => {
    localStorage.setItem('digibook_pin', '9876');
    expect(await securePINStorage.getPIN()).toBe('9876');
  });
});
