import FDBIndex from 'fake-indexeddb/lib/FDBIndex';
import FDBObjectStore from 'fake-indexeddb/lib/FDBObjectStore';
import { Profiler, createElement } from 'react';
import { vi } from 'vitest';

// Performance checks that COUNT instead of timing. A millisecond budget
// measures how busy the machine is; a count of redraws or database reads is
// the same on every machine, so it can only fail when the code changed.

/**
 * Counts how many times React commits a render of the wrapped tree. Use it to
 * catch cascades: one click should be one commit, not a state change that
 * triggers an effect that sets more state.
 *
 *   const commits = createCommitCounter();
 *   render(commits.wrap(<Page />));
 *   commits.reset();                 // ignore the first draw
 *   fireEvent.click(...);
 *   expect(commits.updates).toBe(1);
 *
 * It is NOT a way to tell whether one child skipped rendering. React counts a
 * commit whenever the wrapper itself is re-rendered by its parent, even if
 * every child then bails out (memo). To check that a component did or did not
 * render, call a `vi.fn()` spy in its body, as AccountSelector's test does.
 */
export const createCommitCounter = () => {
  let mounts = 0;
  let updates = 0;
  const onRender = (_id, phase) => {
    if (phase === 'mount') mounts += 1;
    else updates += 1;
  };
  return {
    wrap: element => createElement(Profiler, { id: 'perf', onRender }, element),
    reset: () => {
      mounts = 0;
      updates = 0;
    },
    get mounts() {
      return mounts;
    },
    get updates() {
      return updates;
    },
    get commits() {
      return mounts + updates;
    },
  };
};

const SCANS = ['getAll', 'getAllKeys', 'openCursor', 'openKeyCursor', 'count'];
const POINT_READS = ['get', 'getKey'];

/**
 * Counts the real reads a task makes against the (fake) IndexedDB, per table,
 * however the code asks for them: toArray(), where(), filter() and get() all
 * end up as reads on an object store or an index.
 *
 * - `scans`: reads that walk or count a range (toArray, filter, where, count)
 * - `gets`: reads of one row by key
 *
 *   const { stores, scans } = await countStoreReads(() => dbHelpers.foo());
 *   expect(stores.fixedExpenses.scans).toBeLessThanOrEqual(2);
 *
 * Only reads are counted; writes and the reads Dexie does for its own
 * bookkeeping during a write are not part of this contract.
 * @param {() => Promise<unknown>|unknown} task
 * @returns {Promise<{stores: Object, scans: number, gets: number}>} `stores` maps
 *   a table name to `{ scans, gets }`
 */
export const countStoreReads = async task => {
  const stores = {};
  const bump = (storeName, kind) => {
    stores[storeName] ??= { scans: 0, gets: 0 };
    stores[storeName][kind] += 1;
  };

  const spies = [];
  const patch = (proto, methods, kind, storeNameOf) => {
    methods.forEach(method => {
      const original = proto[method];
      if (typeof original !== 'function') return;
      spies.push(
        vi.spyOn(proto, method).mockImplementation(function counted(...args) {
          bump(storeNameOf(this), kind);
          return original.apply(this, args);
        }),
      );
    });
  };
  const ofStore = store => store.name;
  const ofIndex = index => index.objectStore.name;
  patch(FDBObjectStore.prototype, SCANS, 'scans', ofStore);
  patch(FDBObjectStore.prototype, POINT_READS, 'gets', ofStore);
  patch(FDBIndex.prototype, SCANS, 'scans', ofIndex);
  patch(FDBIndex.prototype, POINT_READS, 'gets', ofIndex);

  try {
    await task();
  } finally {
    spies.forEach(spy => spy.mockRestore());
  }

  const total = kind =>
    Object.values(stores).reduce((sum, table) => sum + table[kind], 0);
  return { stores, scans: total('scans'), gets: total('gets') };
};
