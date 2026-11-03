import { fireEvent, render, screen } from '@testing-library/react';
import FDBObjectStore from 'fake-indexeddb/lib/FDBObjectStore';
import { memo, useEffect, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db } from '../db/database-clean';

import { countStoreReads, createCommitCounter } from './perfCounters';

// These helpers are what the performance tests trust, so they are tested
// first: a counter that miscounts makes every later test meaningless.

describe('createCommitCounter', () => {
  function RowImpl({ label }) {
    return <span>{label}</span>;
  }
  const Row = memo(RowImpl);

  const Page = () => {
    const [count, setCount] = useState(0);
    const [other, setOther] = useState(0);
    return (
      <div>
        <button onClick={() => setCount(c => c + 1)}>count</button>
        <button onClick={() => setOther(o => o + 1)}>other</button>
        <span>{count}</span>
        <Row label='fixed' />
        <i>{other}</i>
      </div>
    );
  };

  it('counts the first draw as one mount', () => {
    const commits = createCommitCounter();
    render(commits.wrap(<Page />));
    expect(commits.mounts).toBe(1);
    expect(commits.updates).toBe(0);
  });

  it('counts one update per state change', () => {
    const commits = createCommitCounter();
    render(commits.wrap(<Page />));
    commits.reset();

    fireEvent.click(screen.getByText('count'));
    expect(commits.updates).toBe(1);
    fireEvent.click(screen.getByText('other'));
    fireEvent.click(screen.getByText('other'));
    expect(commits.updates).toBe(3);
    expect(commits.mounts).toBe(0);
  });

  it('counts a cascade: a change whose effect sets more state is two commits', () => {
    const Cascade = () => {
      const [clicks, setClicks] = useState(0);
      const [seen, setSeen] = useState(0);
      useEffect(() => {
        setSeen(clicks);
      }, [clicks]);
      return (
        <button onClick={() => setClicks(c => c + 1)}>
          {clicks}/{seen}
        </button>
      );
    };
    const commits = createCommitCounter();
    render(commits.wrap(<Cascade />));
    commits.reset();

    fireEvent.click(screen.getByRole('button'));
    expect(commits.updates).toBe(2);
  });

  // Pins the limit so nobody relies on it for memo: the wrapper re-rendering
  // counts as a commit even though the memo child skipped.
  it('still counts a commit when a memo child bails out under a re-rendered wrapper', () => {
    const renderSpy = vi.fn();
    function ChildImpl({ label }) {
      renderSpy();
      return <span>{label}</span>;
    }
    const Child = memo(ChildImpl);
    const commits = createCommitCounter();
    const { rerender } = render(commits.wrap(<Child label='same' />));
    commits.reset();
    renderSpy.mockClear();

    rerender(commits.wrap(<Child label='same' />));
    expect(renderSpy).not.toHaveBeenCalled(); // the child skipped...
    expect(commits.updates).toBe(1); // ...but the wrapper still counted
  });

  it('starts from zero again after reset', () => {
    const commits = createCommitCounter();
    render(commits.wrap(<Page />));
    commits.reset();
    expect(commits.commits).toBe(0);
  });
});

describe('countStoreReads', () => {
  beforeEach(async () => {
    await Promise.all([db.fixedExpenses.clear(), db.accounts.clear()]);
    await db.fixedExpenses.bulkPut(
      ['a', 'b', 'c'].map(id => ({
        id,
        name: id,
        dueDate: '2026-11-05',
        amount: 10,
        paidAmount: 0,
        recurringTemplateId: id === 'c' ? 't2' : 't1',
        deletedAt: null,
      })),
    );
  });

  it('counts a full read of one table against that table only', async () => {
    const result = await countStoreReads(() => db.fixedExpenses.toArray());
    expect(Object.keys(result.stores)).toEqual(['fixedExpenses']);
    expect(result.stores.fixedExpenses.scans).toBeGreaterThanOrEqual(1);
    expect(result.gets).toBe(0);
  });

  it('counts a read by key as a get, not a scan', async () => {
    const result = await countStoreReads(() => db.fixedExpenses.get('a'));
    expect(result.stores.fixedExpenses).toEqual({ scans: 0, gets: 1 });
  });

  it('sees a read through an index', async () => {
    const result = await countStoreReads(() =>
      db.fixedExpenses.where('recurringTemplateId').equals('t1').toArray(),
    );
    expect(result.stores.fixedExpenses.scans).toBeGreaterThanOrEqual(1);
  });

  it('sees a filter() the same as a toArray()', async () => {
    const result = await countStoreReads(() =>
      db.fixedExpenses.filter(e => e.amount > 5).toArray(),
    );
    expect(result.stores.fixedExpenses.scans).toBeGreaterThanOrEqual(1);
  });

  it('counts a table the task never touched as nothing', async () => {
    const result = await countStoreReads(() => db.fixedExpenses.toArray());
    expect(result.stores.accounts).toBeUndefined();
  });

  it('adds up across several reads, and is the same every time', async () => {
    const run = () =>
      countStoreReads(async () => {
        await db.fixedExpenses.toArray();
        await db.fixedExpenses.toArray();
        await db.accounts.toArray();
      });
    const first = await run();
    const second = await run();

    expect(first.stores.fixedExpenses.scans).toBe(
      2 * (await countStoreReads(() => db.fixedExpenses.toArray())).scans,
    );
    expect(first.stores.accounts.scans).toBeGreaterThanOrEqual(1);
    expect(second).toEqual(first);
  });

  it('does not count a read that happens after it returns', async () => {
    await countStoreReads(() => db.fixedExpenses.toArray());
    const after = await countStoreReads(() => {});
    expect(after).toEqual({ stores: {}, scans: 0, gets: 0 });
  });

  it('puts the real methods back, even when the task throws', async () => {
    await expect(
      countStoreReads(() => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(vi.isMockFunction(FDBObjectStore.prototype.getAll)).toBe(false);
    expect(vi.isMockFunction(FDBObjectStore.prototype.openCursor)).toBe(false);
  });
});
