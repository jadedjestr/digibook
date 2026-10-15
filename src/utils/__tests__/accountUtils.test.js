import { describe, expect, it } from 'vitest';

import { getDefaultAccount, getProjectedBalance } from '../accountUtils';

const accounts = [
  { id: 'a1', name: 'Checking', currentBalance: 500, isDefault: true },
  { id: 'a2', name: 'Savings', currentBalance: 9000, isDefault: false },
];

describe('getDefaultAccount', () => {
  it('picks the account marked default', () => {
    expect(getDefaultAccount([accounts[1], accounts[0]]).id).toBe('a1');
  });

  it('falls back to the first account, then to null', () => {
    expect(getDefaultAccount([accounts[1]]).id).toBe('a2');
    expect(getDefaultAccount([])).toBeNull();
  });
});

// These moved here from ProjectedBalanceCard's tests when the card stopped
// doing its own math: the starting balance it shows is built here.
describe('getProjectedBalance', () => {
  // The point of the income feature: a paycheck arriving before the bills
  // are due should be visible, or "can I make it to Friday?" is answered
  // wrongly.
  it('counts an expected paycheck', () => {
    expect(
      getProjectedBalance(accounts[0], [{ accountId: 'a1', amount: 1200 }]),
    ).toBe(1700);
  });

  it('counts spending that has not cleared yet', () => {
    expect(
      getProjectedBalance(accounts[0], [{ accountId: 'a1', amount: -125.5 }]),
    ).toBe(374.5);
  });

  it('ignores pending rows belonging to other accounts', () => {
    expect(
      getProjectedBalance(accounts[0], [{ accountId: 'a2', amount: 5000 }]),
    ).toBe(500);
  });

  it('still works with no pending transactions at all', () => {
    expect(getProjectedBalance(accounts[0])).toBe(500);
  });

  it('is 0 without an account', () => {
    expect(getProjectedBalance(null, [])).toBe(0);
  });
});
