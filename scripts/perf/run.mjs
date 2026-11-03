// Large-data timing check. Not part of the test suite and never shipped.
//
//   npm run build
//   node scripts/perf/run.mjs --tier A,B,C --throttle 1,4 --repeat 3
//
// Serves the PRODUCTION build on port 4173 and drives it with Playwright in a
// brand-new browser context for every run: an empty database that is not
// yours, so your real data (port 5173, your own browser) is never touched
// (see AGENTS.md, "Working on the live app"). The seed is written through
// IndexedDB itself, so the timings are real storage, not the test fake.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

import { TIERS, buildDataset, countRows } from './dataset.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
    return acc;
  }, []),
);
const tierKeys = (args.tier || 'A').split(',');
const throttles = (args.throttle || '1').split(',').map(Number);
const repeat = Number(args.repeat || 3);
const skip = new Set((args.skip || '').split(','));
const ACTION_TIMEOUT = Number(args.timeout || 180000);
// --dev serves the unminified app on another port (still a fresh browser
// profile, never your data) so a CPU profile shows readable function names.
const DEV = args.dev === 'true';
const PORT = DEV ? 5174 : 4173;
const APP_URL = `http://localhost:${PORT}/`;
const TEST_PIN = '135790'; // throwaway, scratch profile only

const wait = ms => new Promise(r => setTimeout(r, ms));
const median = xs => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : null;
};

const startServer = async () => {
  const server = spawn(
    'npx',
    [
      'vite',
      ...(DEV ? [] : ['preview']),
      '--port',
      String(PORT),
      '--strictPort',
    ],
    {
      stdio: 'ignore',
    },
  );
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(APP_URL)).ok) return server;
    } catch {
      /* not up yet */
    }
    await wait(250);
  }
  server.kill();
  throw new Error(
    `Preview server did not start on ${PORT} (is it already running?)`,
  );
};

const SEED_TABLES = [
  'accounts',
  'creditCards',
  'recurringExpenseTemplates',
  'fixedExpenses',
  'recurringResolutionLog',
  'monthlyExpenseHistory',
  'auditLogs',
  'pendingTransactions',
  'paycheckSettings',
];

const seed = async (page, data) => {
  // Empty the tables we fill, plus backups so the next load is a "first load
  // of the day" (it will create one).
  await page.evaluate(async tables => {
    const [info] = (await indexedDB.databases()).filter(d =>
      d.name.startsWith('Digibook'),
    );
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open(info.name);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction([...tables, 'backups'], 'readwrite');
    [...tables, 'backups'].forEach(t => tx.objectStore(t).clear());
    await new Promise((res, rej) => {
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, SEED_TABLES);

  for (const table of SEED_TABLES) {
    const rows = data[table];
    for (let i = 0; i < rows.length; i += 2000) {
      await page.evaluate(
        async ({ table: t, chunk }) => {
          const [info] = (await indexedDB.databases()).filter(d =>
            d.name.startsWith('Digibook'),
          );
          const db = await new Promise((res, rej) => {
            const r = indexedDB.open(info.name);
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
          });
          const tx = db.transaction(t, 'readwrite');
          chunk.forEach(row => tx.objectStore(t).put(row));
          await new Promise((res, rej) => {
            tx.oncomplete = res;
            tx.onerror = () => rej(tx.error);
          });
          db.close();
        },
        { table, chunk: rows.slice(i, i + 2000) },
      );
    }
  }
};

const run = async (browser, tierKey, throttle) => {
  const tier = TIERS[tierKey];
  const data = buildDataset(tierKey);
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(ACTION_TIMEOUT);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
  await page.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver(list =>
      list.getEntries().forEach(e => window.__long.push(e.duration)),
    ).observe({
      type: 'longtask',
      buffered: true,
    });
  });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');

  // First visit: create the schema, then set a PIN (test value, scratch only).
  await page.goto(APP_URL);
  await page.getByPlaceholder('Enter new PIN').fill(TEST_PIN);
  await page.getByPlaceholder('Confirm PIN').fill(TEST_PIN);
  await page.getByRole('button', { name: 'Set PIN' }).click();
  await page.waitForSelector('text=Fixed Expenses');
  await wait(1500);

  const t0 = Date.now();
  await seed(page, data);
  const seedMs = Date.now() - t0;
  if (throttle > 1)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });

  const heapMb = async () => {
    const { metrics } = await cdp.send('Performance.getMetrics');
    return Math.round(
      metrics.find(m => m.name === 'JSHeapUsedSize').value / 1048576,
    );
  };
  const measure = async (name, action, bucket) => {
    await page.evaluate(() => (window.__long = []));
    const start = Date.now();
    let status = 'ok';
    try {
      await action();
    } catch (e) {
      const screen = await page
        .evaluate(() =>
          (
            document.querySelector('[role=dialog]') ||
            document.querySelector('main')
          )?.innerText
            .replace(/\s+/g, ' ')
            .slice(0, 160),
        )
        .catch(() => '');
      status = `${String(e.message).split('\n')[0].slice(0, 60)} | screen: ${screen}`;
    }
    const ms = Date.now() - start;
    const long = await page.evaluate(() => window.__long.slice());
    (bucket[name] ||= []).push({
      ms,
      status,
      blockedMs: Math.round(long.reduce((a, b) => a + b, 0)),
      worstBlockMs: Math.round(Math.max(0, ...long)),
    });
  };
  // "Ready" means the seeded data is on screen, not just that the shell drew.
  const appLoaded = () =>
    page.waitForFunction(
      () =>
        document.body.innerText.includes('Checking') &&
        !document.body.innerText.includes('Loading...'),
    );
  const goTo = async label =>
    page.getByText(label, { exact: true }).first().click();
  const backupCount = () =>
    page.evaluate(async () => {
      const [info] = (await indexedDB.databases()).filter(d =>
        d.name.startsWith('Digibook'),
      );
      const db = await new Promise(
        res =>
          (indexedDB.open(info.name).onsuccess = e => res(e.target.result)),
      );
      const n = await new Promise(
        res =>
          (db.transaction('backups').objectStore('backups').count().onsuccess =
            e => res(e.target.result)),
      );
      db.close();
      return n;
    });

  const results = {};
  const memory = {};

  // 1. First load of the day: the app also creates its daily backup. The
  // backup clock starts at the reload, because it runs on its own after load.
  await page.evaluate(() => (window.__long = []));
  const reloadAt = Date.now();
  await page.reload();
  await appLoaded();
  const firstLoadMs = Date.now() - reloadAt;
  const firstLoadLong = await page.evaluate(() => window.__long.slice());
  (results['load, first of the day'] ||= []).push({
    ms: firstLoadMs,
    status: 'ok',
    blockedMs: Math.round(firstLoadLong.reduce((a, b) => a + b, 0)),
    worstBlockMs: Math.round(Math.max(0, ...firstLoadLong)),
  });
  let backupStatus = 'ok';
  try {
    for (let i = 0; (await backupCount()) === 0; i++) {
      if (i > ACTION_TIMEOUT / 250) throw new Error('no backup within timeout');
      await wait(250);
    }
  } catch (e) {
    backupStatus = e.message;
  }
  const afterBackupLong = await page.evaluate(() => window.__long.slice());
  (results['daily backup done (from start of load)'] ||= []).push({
    ms: Date.now() - reloadAt,
    status: backupStatus,
    blockedMs: Math.round(afterBackupLong.reduce((a, b) => a + b, 0)),
    worstBlockMs: Math.round(Math.max(0, ...afterBackupLong)),
  });
  memory['after first load'] = await heapMb();

  // 2. Later loads.
  for (let i = 0; i < (skip.has('reload') ? 0 : repeat); i++) {
    await measure(
      'load, later in the day',
      async () => {
        await page.reload();
        await appLoaded();
      },
      results,
    );
  }
  memory['after reloads'] = await heapMb();

  // 3. Screens.
  await measure(
    'open Fixed Expenses',
    async () => {
      await goTo('Fixed Expenses');
      await page.waitForFunction(
        () =>
          document.querySelectorAll('[role=gridcell]').length >= 35 &&
          document.querySelectorAll('.calendar-day .expense-badge').length > 0,
      );
    },
    results,
  );
  memory['Fixed Expenses open'] = await heapMb();

  for (let i = 0; i < (skip.has('month') ? 0 : repeat); i++) {
    const before = await page
      .locator('[role=gridcell]')
      .first()
      .getAttribute('aria-label');
    await measure(
      'next month',
      async () => {
        await page.getByRole('button', { name: /next month/i }).click();
        await page.waitForFunction(
          b =>
            document
              .querySelector('[role=gridcell]')
              ?.getAttribute('aria-label') !== b,
          before,
        );
      },
      results,
    );
    await page.getByRole('button', { name: /previous month/i }).click();
    await wait(300);
  }

  for (let i = 0; i < (skip.has('pay') ? 0 : repeat); i++) {
    await measure(
      'pay a bill (Pay now, Pay full)',
      async () => {
        const payNow = page.getByRole('button', { name: 'Pay now' });
        const before = await payNow.count();
        // A plain bill: card and loan payments use a different dialog. Climb to
        // the row (the widest ancestor holding only this one "Pay now").
        const plain = await page.evaluate(() =>
          [...document.querySelectorAll('button')]
            .filter(b => /^pay now$/i.test(b.textContent.trim()))
            .findIndex(b => {
              let el = b;
              while (
                el.parentElement &&
                (el.parentElement.innerText.match(/Pay now/gi) || []).length ===
                  1
              ) {
                el = el.parentElement;
              }
              return !/Card payment|Loan payment/i.test(el.innerText);
            }),
        );
        if (plain < 0) throw new Error('no plain bill left to pay');
        await payNow.nth(plain).click();
        await page.getByRole('button', { name: /pay full/i }).click();
        // Done when the dialog has closed and the bill has left the list: what
        // the person waits for. (The list can update before the dialog closes.)
        await page.waitForFunction(
          n =>
            !document.querySelector('[role=dialog]') &&
            [...document.querySelectorAll('button')].filter(b =>
              /pay now/i.test(b.textContent),
            ).length < n,
          before,
        );
      },
      results,
    );
    // The screen updates first; the database may still be busy. Time a
    // read-only transaction on the same tables: it cannot start until the
    // payment's writes have finished.
    if (!skip.has('dbfree'))
      await measure(
        'after paying: until the database is free again',
        async () => {
          await page.evaluate(async () => {
            const [info] = (await indexedDB.databases()).filter(d =>
              d.name.startsWith('Digibook'),
            );
            const db = await new Promise(
              res =>
                (indexedDB.open(info.name).onsuccess = e =>
                  res(e.target.result)),
            );
            await new Promise(res => {
              const tx = db.transaction(
                ['fixedExpenses', 'monthlyExpenseHistory'],
                'readonly',
              );
              tx.objectStore('fixedExpenses').count();
              tx.oncomplete = res;
            });
            db.close();
          });
        },
        results,
      );
    await wait(500);
  }
  memory['after paying bills'] = await heapMb();

  const profiling = args.profile === 'true';
  if (profiling) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await cdp.send('Profiler.start');
  }
  await measure(
    'open Insights',
    async () => {
      await goTo('Insights');
      await page.waitForSelector('text=Total Budgeted');
    },
    results,
  );
  if (profiling) {
    const { profile } = await cdp.send('Profiler.stop');
    const self = new Map();
    const byId = new Map(profile.nodes.map(n => [n.id, n]));
    profile.samples.forEach((id, i) => {
      const f = byId.get(id).callFrame;
      const key = `${f.functionName || '(anonymous)'}  ${f.url.split('/').slice(-2).join('/')}:${f.lineNumber + 1}`;
      self.set(key, (self.get(key) || 0) + profile.timeDeltas[i] / 1000);
    });
    const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
    process.stderr.write(
      `\nCPU profile while opening Insights (self time, ms):\n${top.map(([k, v]) => `${String(Math.round(v)).padStart(7)}  ${k}`).join('\n')}\n\n`,
    );
  }
  memory['Insights open'] = await heapMb();

  await goTo('Settings');
  await page
    .locator('[aria-controls="collapsible-content-data-management"]')
    .click();
  await page.getByRole('button', { name: 'Export JSON' }).waitFor();
  await measure(
    'export everything (JSON)',
    async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Export JSON' }).click(),
      ]);
      await download.path();
    },
    results,
  );
  memory['after export'] = await heapMb();

  const storageMb = await page.evaluate(async () =>
    Math.round(((await navigator.storage.estimate()).usage || 0) / 1048576),
  );
  const backups = await backupCount();
  await ctx.close();

  const summary = Object.fromEntries(
    Object.entries(results).map(([name, runs]) => [
      name,
      {
        medianMs: median(runs.map(r => r.ms)),
        worstMs: Math.max(...runs.map(r => r.ms)),
        medianBlockedMs: median(runs.map(r => r.blockedMs)),
        worstBlockMs: Math.max(...runs.map(r => r.worstBlockMs)),
        runs: runs.length,
        failures: runs.filter(r => r.status !== 'ok').map(r => r.status),
      },
    ]),
  );
  return {
    tier: tierKey,
    label: tier.label,
    throttle,
    rows: countRows(data),
    seedMs,
    storageMb,
    backups,
    memoryMb: memory,
    pageErrors: [...new Set(errors)].slice(0, 5),
    summary,
  };
};

const server = await startServer();
const browser = await chromium.launch();
const all = [];
try {
  for (const tierKey of tierKeys) {
    for (const throttle of throttles) {
      process.stderr.write(
        `tier ${tierKey} (${TIERS[tierKey].label}), CPU x${throttle} ...\n`,
      );
      const result = await run(browser, tierKey, throttle);
      all.push(result);
      mkdirSync(new URL('./results/', import.meta.url), { recursive: true });
      writeFileSync(
        new URL(`./results/${tierKey}-x${throttle}.json`, import.meta.url),
        JSON.stringify(result, null, 2),
      );
    }
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(JSON.stringify(all, null, 2));
