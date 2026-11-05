// UX audit: taps per task, tap-target sizes, iPhone input zoom, accessibility
// (axe-core), dialogs and navigation behaviour. Not part of the test suite and
// never shipped.
//
//   npm run build
//   node scripts/ux/audit.mjs            # writes scripts/ux/results/audit.json
//
// Serves the PRODUCTION build on port 4173 and drives it in a brand-new,
// phone-sized (390x844, touch) browser context with sample data: an empty
// profile that is not yours and a throwaway PIN, so your own data is never
// touched (see AGENTS.md, "Working on the live app"). It uses Playwright's
// Chromium at iPhone size, which is NOT Safari or an iPhone; see UX_AUDIT.md
// for what that does and does not prove.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../../', import.meta.url)).replace(
  /\/$/,
  '',
);
const require = createRequire(REPO + '/');
const { chromium } = require('playwright');
const axeSrc = fs.readFileSync(
  REPO + '/node_modules/axe-core/axe.min.js',
  'utf8',
);
const { buildDataset } = await import('../perf/dataset.mjs');

const wait = ms => new Promise(r => setTimeout(r, ms));
const server = spawn(
  'npx',
  ['vite', 'preview', '--port', '4173', '--strictPort'],
  { cwd: REPO, stdio: 'ignore' },
);
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch('http://localhost:4173/')).ok) break;
  } catch {}
  await wait(250);
}

const TABLES = [
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
const browser = await chromium.launch();
const out = { flows: [], screens: {}, navigation: {} };
try {
  // iPhone-sized, touch, fresh empty profile (nothing of yours)
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:4173/');

  // ---- helper: scan the current screen -------------------------------------------------
  const scan = async name => {
    await page.evaluate(axeSrc);
    const res = await page.evaluate(async () => {
      const SEL =
        'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch], [role=checkbox], [role=gridcell], summary, [tabindex="0"]';
      const seen = new Set();
      const small = [];
      let total = 0;
      const zoom = [];
      for (const el of document.querySelectorAll(SEL)) {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        if (
          r.width === 0 ||
          r.height === 0 ||
          cs.visibility === 'hidden' ||
          cs.display === 'none' ||
          +cs.opacity === 0
        )
          continue;
        if (el.closest('[aria-hidden=true]') || el.closest('.hidden')) continue;
        total++;
        const label = (
          el.getAttribute('aria-label') ||
          el.innerText ||
          el.getAttribute('title') ||
          el.getAttribute('placeholder') ||
          el.tagName
        )
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 34);
        if (r.width < 44 || r.height < 44)
          small.push({
            label,
            tag: el.tagName.toLowerCase(),
            w: Math.round(r.width),
            h: Math.round(r.height),
            tiny: r.width < 24 || r.height < 24,
          });
        if (
          /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) &&
          !/^(checkbox|radio|button|submit|range|file)$/.test(el.type)
        ) {
          const fs = parseFloat(cs.fontSize);
          if (fs < 16) zoom.push({ label, fontSize: fs });
        }
      }
      const axeRes = await axe.run(document, {
        runOnly: [
          'wcag2a',
          'wcag2aa',
          'wcag21a',
          'wcag21aa',
          'wcag22aa',
          'best-practice',
        ],
      });
      const violations = axeRes.violations.map(v => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.length,
        example: v.nodes[0]?.target?.join(' ').slice(0, 70),
      }));
      return {
        total,
        small,
        zoom,
        violations,
        h1: [...document.querySelectorAll('h1')]
          .map(h => h.innerText.trim())
          .slice(0, 2),
        landmarks: {
          main: document.querySelectorAll('main,[role=main]').length,
          nav: document.querySelectorAll('nav,[role=navigation]').length,
        },
        title: document.title,
        path: location.pathname + location.hash,
        historyLength: history.length,
      };
    });
    out.screens[name] = res;
  };

  // ---- 0. PIN screen -----------------------------------------------------------------
  await scan('PIN screen (first launch)');
  await page.getByPlaceholder('Enter new PIN').fill('135790');
  await page.getByPlaceholder('Confirm PIN').fill('135790');
  await page.getByRole('button', { name: 'Set PIN' }).click();
  await page.waitForSelector('text=Fixed Expenses', { state: 'attached' });
  await wait(1500);

  // ---- seed sample data (same as the timing tool) -------------------------------------
  const data = buildDataset('A');
  const open = `(async()=>{const [i]=(await indexedDB.databases()).filter(d=>d.name.startsWith('Digibook'));return await new Promise(r=>indexedDB.open(i.name).onsuccess=e=>r(e.target.result))})()`;
  await page.evaluate(
    `(async()=>{const db=await ${open};const names=[...db.objectStoreNames];const tx=db.transaction(names,'readwrite');names.forEach(n=>tx.objectStore(n).clear());await new Promise(r=>tx.oncomplete=r);db.close()})()`,
  );
  for (const t of TABLES)
    await page.evaluate(
      `(async()=>{const db=await ${open};const tx=db.transaction(${JSON.stringify(t)},'readwrite');${JSON.stringify(data[t])}.forEach(r=>tx.objectStore(${JSON.stringify(t)}).put(r));await new Promise(r=>tx.oncomplete=r);db.close()})()`,
    );
  await page.reload();
  await page.waitForFunction(
    () =>
      document.body.innerText.includes('Checking') ||
      document.body.innerText.includes('Liquid Cash'),
  );
  await wait(800);

  out.dialogs = {};
  // "Open" = something covers the menu button, which is what a person feels.
  const covered = () =>
    page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x =>
        x.querySelector('svg.lucide-menu'),
      );
      if (!b) return true;
      const r = b.getBoundingClientRect();
      const el = document.elementFromPoint(
        r.x + r.width / 2,
        r.y + r.height / 2,
      );
      return !(el && b.contains(el));
    });
  const closeDialog = async name => {
    const info = {
      escapeClosesFocusOutside: null,
      escapeClosesFocusInside: null,
      cancelButton: null,
      closedBy: null,
    };
    await page.keyboard.press('Escape');
    await wait(400);
    info.escapeClosesFocusOutside = !(await covered());
    if (!info.escapeClosesFocusOutside) {
      const input = page.locator('input:visible').first();
      if (await input.count()) {
        await input.focus();
        await page.keyboard.press('Escape');
        await wait(400);
      }
      info.escapeClosesFocusInside = !(await covered());
    }
    if (await covered()) {
      const cancel = page
        .getByRole('button', { name: /^cancel$/i })
        .locator('visible=true')
        .first();
      if (await cancel.count()) {
        const bb = await cancel.boundingBox();
        info.cancelButton = {
          w: Math.round(bb.width),
          h: Math.round(bb.height),
        };
        await cancel.click();
        await wait(500);
        info.closedBy = 'Cancel button';
      }
    } else info.closedBy = 'Escape key';
    if (await covered()) {
      await page.reload();
      await page.waitForFunction(
        () =>
          document.body.innerText.includes('Liquid Cash') ||
          document.body.innerText.includes('Checking'),
      );
      await wait(600);
      info.closedBy = (info.closedBy || 'nothing') + ', then a page reload';
    }
    out.dialogs[name] = info;
  };

  // Measured now: later steps lock the app, and the menu is not on screen then.
  const mb = await page
    .locator('button')
    .filter({ has: page.locator('svg.lucide-menu') })
    .first()
    .boundingBox();
  const menuButtonRect = mb && {
    x: Math.round(mb.x),
    y: Math.round(mb.y),
    w: Math.round(mb.width),
    h: Math.round(mb.height),
    distanceFromBottomPct: Math.round(
      100 - ((mb.y + mb.height / 2) / 844) * 100,
    ),
  };

  // ---- navigation + task flows: count every tap ----------------------------------------
  let taps = 0;
  const tap = async loc => {
    await loc.click();
    taps++;
  };
  const menu = () =>
    page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-menu') })
      .first();
  const goTo = async label => {
    await tap(menu());
    await wait(250);
    await tap(
      page.getByText(label, { exact: true }).locator('visible=true').first(),
    );
    await wait(900);
  };
  const flow = async (name, fn, note = '') => {
    taps = 0;
    const t0 = Date.now();
    let status = 'ok';
    try {
      await fn();
    } catch (e) {
      status = String(e.message).split('\n')[0].slice(0, 90);
    }
    out.flows.push({ name, taps, ms: Date.now() - t0, status, note });
  };

  await flow('Open Fixed Expenses (from another screen)', () =>
    goTo('Fixed Expenses'),
  );
  await scan('Fixed Expenses: Month View');
  await flow('Switch to next month', async () => {
    await tap(page.getByRole('button', { name: /next month/i }));
    await wait(300);
  });
  await tap(page.getByRole('button', { name: /previous month/i }));
  await wait(300);
  await flow('Open "Where Your Bills Go" tab', async () => {
    await tap(page.getByRole('button', { name: 'Where Your Bills Go' }));
    await wait(500);
  });
  await scan('Fixed Expenses: Where Your Bills Go');
  await flow('Open "All Future One-Offs" tab', async () => {
    await tap(page.getByRole('button', { name: 'All Future One-Offs' }));
    await wait(500);
  });
  await scan('Fixed Expenses: All Future One-Offs');
  await tap(page.getByRole('button', { name: 'Month View' }));
  await wait(500);
  await flow(
    'Open the Add Expense panel',
    async () => {
      await tap(page.getByRole('button', { name: /add expense/i }).first());
      await wait(600);
    },
    'then fill the form',
  );
  await scan('Add Expense panel');
  const fields = await page.evaluate(() =>
    [...document.querySelectorAll('input, select, textarea')]
      .filter(e => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && e.type !== 'hidden';
      })
      .map(
        e => e.getAttribute('aria-label') || e.placeholder || e.name || e.type,
      )
      .slice(0, 14),
  );
  out.flows[out.flows.length - 1].note =
    `form shows ${fields.length} fields: ${fields.join(', ')}`;
  out.dialogSemantics = out.dialogSemantics || {};
  out.dialogSemantics['Add Expense panel'] = await page.evaluate(() => ({
    roleDialog: !!document.querySelector('[role=dialog]'),
    ariaModal: !!document.querySelector('[aria-modal=true]'),
  }));
  await closeDialog('Add Expense panel');

  await flow(
    'Pay a bill (from Fixed Expenses)',
    async () => {
      const idx = await page.evaluate(() =>
        [...document.querySelectorAll('button')]
          .filter(b => /^pay now$/i.test(b.textContent.trim()))
          .findIndex(b => {
            let el = b;
            while (
              el.parentElement &&
              (el.parentElement.innerText.match(/Pay now/gi) || []).length === 1
            )
              el = el.parentElement;
            return !/Card payment|Loan payment/i.test(el.innerText);
          }),
      );
      await tap(page.getByRole('button', { name: 'Pay now' }).nth(idx));
      await tap(page.getByRole('button', { name: /pay full/i }));
      await page.waitForFunction(
        () => !document.querySelector('[role=dialog]'),
      );
    },
    'tapping Pay now opens a dialog; Pay full confirms',
  );
  await flow(
    'Pay a bill (from Accounts, including getting there)',
    async () => {
      await goTo('Accounts');
      await goTo('Fixed Expenses');
      const idx = await page.evaluate(() =>
        [...document.querySelectorAll('button')]
          .filter(b => /^pay now$/i.test(b.textContent.trim()))
          .findIndex(b => {
            let el = b;
            while (
              el.parentElement &&
              (el.parentElement.innerText.match(/Pay now/gi) || []).length === 1
            )
              el = el.parentElement;
            return !/Card payment|Loan payment/i.test(el.innerText);
          }),
      );
      taps = 2;
      /* only count: menu+select to Fixed Expenses */ await tap(
        page.getByRole('button', { name: 'Pay now' }).nth(idx),
      );
      await tap(page.getByRole('button', { name: /pay full/i }));
      await page.waitForFunction(
        () => !document.querySelector('[role=dialog]'),
      );
    },
    'menu, Fixed Expenses, Pay now, Pay full',
  );

  await flow('Open Credit Cards (see balances and due dates)', () =>
    goTo('Credit Cards'),
  );
  await scan('Credit Cards');
  await flow('Open the Pay extra dialog on a card', async () => {
    await tap(page.getByRole('button', { name: /pay extra/i }).first());
    await wait(500);
  });
  await scan('Pay extra dialog');
  out.dialogSemantics['Pay extra dialog'] = await page.evaluate(() => ({
    roleDialog: !!document.querySelector('[role=dialog]'),
    ariaModal: !!document.querySelector('[aria-modal=true]'),
  }));
  await closeDialog('Pay extra dialog');
  await flow('Open Loans', () => goTo('Loans'));
  await scan('Loans (empty in the sample data)');
  await flow('Open Insights', () => goTo('Insights'));
  await wait(800);
  await scan('Insights');
  await flow('Open Pending Transactions', () => goTo('Pending Transactions'));
  await scan('Pending Transactions');
  await flow('Open Accounts', () => goTo('Accounts'));
  await scan('Accounts');
  await flow('Open Settings', () => goTo('Settings'));
  await scan('Settings');
  await flow(
    'Export everything (from Settings)',
    async () => {
      await tap(
        page.locator('[aria-controls="collapsible-content-data-management"]'),
      );
      await wait(500);
      const [dl] = await Promise.all([
        page.waitForEvent('download'),
        tap(page.getByRole('button', { name: 'Export JSON' })),
      ]);
      await dl.path();
    },
    'expand Data Management, then Export JSON',
  );
  await flow('Lock the app', async () => {
    await tap(menu());
    await wait(250);
    await tap(
      page.getByText('Lock', { exact: true }).locator('visible=true').first(),
    );
    await wait(500);
  });

  // ---- navigation behaviour -----------------------------------------------------------
  const nav = {};
  nav.urlAfterNavigating = await page.evaluate(() => ({
    path: location.pathname,
    hash: location.hash,
    search: location.search,
    historyLength: history.length,
  }));
  nav.titleSamePerScreen = [
    ...new Set(Object.values(out.screens).map(s => s.title)),
  ];
  const before = page.url();
  await page.goBack({ timeout: 5000 }).catch(() => {});
  nav.afterBackGesture = { urlBefore: before, urlAfter: page.url() };
  nav.menuButton = menuButtonRect;
  nav.viewportMeta = await page.evaluate(
    () => document.querySelector('meta[name=viewport]')?.content,
  );
  out.navigation = nav;
  await ctx.close();
} finally {
  await browser.close();
  server.kill();
}
const outPath = process.argv[2] || REPO + '/scripts/ux/results/audit.json';
fs.mkdirSync(outPath.replace(/\/[^/]*$/, ''), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(
  "Taps per task (the milliseconds include the tool's own click waiting; ignore them):",
);
for (const f of out.flows)
  console.log(
    `  ${String(f.taps).padStart(2)} taps  ${f.status === 'ok' ? 'ok  ' : 'FAIL'} ${f.name}${f.note ? '  (' + f.note + ')' : ''}`,
  );
console.log(
  '\nPer screen: interactive elements | under 44 pt | under 24 pt | input-zoom risks | accessibility issues',
);
for (const [name, s] of Object.entries(out.screens)) {
  console.log(
    `  ${name.slice(0, 44).padEnd(44)} ${String(s.total).padStart(3)} | ${String(s.small.length).padStart(3)} | ${String(s.small.filter(x => x.tiny).length).padStart(3)} | ${String(s.zoom.length).padStart(2)} | ${String(s.violations.length).padStart(2)}`,
  );
}
console.log('\nDialogs:', JSON.stringify(out.dialogs));
console.log('Navigation:', JSON.stringify(out.navigation));
console.log('\nFull results written to ' + outPath);
