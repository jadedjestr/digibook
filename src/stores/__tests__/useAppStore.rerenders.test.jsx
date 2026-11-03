import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  useAccounts,
  useAppStore,
  useCategories,
  useCreditCards,
  useCurrentPage,
  useError,
  useFixedExpenses,
  useIncomeSources,
  useIsLoading,
  useIsPanelOpen,
  useLoans,
  usePaycheckSettings,
  usePendingTransactions,
} from '../useAppStore';

// The store is shared by every page, so a change that redraws readers it has
// no business touching is paid for everywhere. Each reader below subscribes to
// one slice the way a page does; after an action, only the readers of the
// slices that action changes may redraw, and each exactly once.

const HOOKS = {
  accounts: useAccounts,
  creditCards: useCreditCards,
  loans: useLoans,
  pendingTransactions: usePendingTransactions,
  fixedExpenses: useFixedExpenses,
  categories: useCategories,
  paycheckSettings: usePaycheckSettings,
  incomeSources: useIncomeSources,
  currentPage: useCurrentPage,
  isPanelOpen: useIsPanelOpen,
  isLoading: useIsLoading,
  error: useError,
};

const renders = {};
const readers = Object.entries(HOOKS).map(([name, useSlice]) => {
  const Reader = () => {
    useSlice();
    renders[name] = (renders[name] || 0) + 1;
    return null;
  };
  Reader.displayName = `Reader(${name})`;
  return <Reader key={name} />;
});

const store = () => useAppStore.getState();

/** Which readers redrew while `action` ran, and how many times each. */
const redrawsDuring = async action => {
  Object.keys(HOOKS).forEach(name => {
    renders[name] = 0;
  });
  await act(async () => {
    await action();
  });
  return Object.fromEntries(
    Object.entries(renders).filter(([, count]) => count > 0),
  );
};

beforeEach(() => {
  useAppStore.setState({
    accounts: [{ id: 1, name: 'Checking', currentBalance: 100 }],
    creditCards: [{ id: 1, name: 'Visa', balance: 50 }],
    loans: [{ id: 1, name: 'Car' }],
    pendingTransactions: [{ id: 1, amount: 5 }],
    fixedExpenses: [
      { id: 'a', name: 'Rent', amount: 10, paidAmount: 0 },
      { id: 'b', name: 'Power', amount: 20, paidAmount: 0 },
    ],
    categories: [{ id: 1, name: 'Housing' }],
    paycheckSettings: null,
    incomeSources: [],
    currentPage: 'accounts',
    isPanelOpen: false,
    isLoading: false,
    error: 'boom',
  });
  render(<>{readers}</>);
});

describe('a store change redraws only the readers of what it changed', () => {
  const actions = [
    [
      'updateExpense',
      () => store().updateExpense('a', { amount: 11 }),
      'fixedExpenses',
    ],
    [
      'addExpense',
      () => store().addExpense({ id: 'c', amount: 1 }),
      'fixedExpenses',
    ],
    ['removeExpense', () => store().removeExpense('a'), 'fixedExpenses'],
    [
      'updateAccount',
      () => store().updateAccount(1, { currentBalance: 1 }),
      'accounts',
    ],
    [
      'updateCreditCard',
      () => store().updateCreditCard(1, { balance: 1 }),
      'creditCards',
    ],
    [
      'addTransaction',
      () => store().addTransaction({ id: 2, amount: 1 }),
      'pendingTransactions',
    ],
    [
      'removeTransaction',
      () => store().removeTransaction(1),
      'pendingTransactions',
    ],
    ['setCurrentPage', () => store().setCurrentPage('loans'), 'currentPage'],
    ['togglePanel', () => store().togglePanel(), 'isPanelOpen'],
    ['setPanelOpen', () => store().setPanelOpen(true), 'isPanelOpen'],
    ['clearError', () => store().clearError(), 'error'],
  ];

  actions.forEach(([name, run, slice]) => {
    it(`${name} redraws only the ${slice} readers, once`, async () => {
      expect(await redrawsDuring(run)).toEqual({ [slice]: 1 });
    });
  });

  it('refreshTemplates redraws no data reader', async () => {
    expect(await redrawsDuring(() => store().refreshTemplates())).toEqual({});
  });

  it('setting a value to what it already is redraws nobody', async () => {
    expect(
      await redrawsDuring(() => store().setCurrentPage('accounts')),
    ).toEqual({});
    expect(await redrawsDuring(() => store().setPanelOpen(false))).toEqual({});
  });

  // Rows memoize on the object they are given, so an edit must leave every
  // other expense as the same object.
  it('updating one expense keeps the others as the same objects', () => {
    const before = store().fixedExpenses;
    act(() => store().updateExpense('a', { amount: 99 }));
    const after = store().fixedExpenses;

    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).toBe(before[1]);
  });
});

describe('reloading from the database', () => {
  // These read fresh arrays from the database, so every slice a reload sets
  // redraws its readers even if the content is the same. What matters is that
  // a reload sets only the slices it names.
  const reloads = [
    ['reloadTransactions', { pendingTransactions: 1 }],
    ['reloadIncomeSources', { incomeSources: 1 }],
    ['reloadPaycheckSettings', { paycheckSettings: 1 }],
    ['reloadCategories', { categories: 1 }],
    ['reloadExpenses', { fixedExpenses: 1, categories: 1 }],
    ['reloadAccounts', { accounts: 1, creditCards: 1, loans: 1 }],
  ];

  reloads.forEach(([name, expected]) => {
    it(`${name} redraws only the readers of what it reloads`, async () => {
      // paycheckSettings starts null and reloads as null: no change, no redraw.
      const wanted = { ...expected };
      if (name === 'reloadPaycheckSettings') delete wanted.paycheckSettings;
      expect(await redrawsDuring(() => store()[name]())).toEqual(wanted);
    });
  });
});
