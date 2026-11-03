// Builds a realistic, repeatable history for the large-data timing check.
// Pure data: no browser, no database. The same tier always yields the same
// rows (seeded random), so two runs compare like with like.
//
// Shapes mirror what the app itself writes (see resolveCycle,
// snapshotExpensesForMonth and addAuditLogEntry in src/db/database-clean.js).

export const TIERS = {
  // templates = recurring bills; years = how long they have been paid.
  A: { label: '1 year', templates: 25, years: 1 },
  B: { label: '5 years', templates: 25, years: 5 },
  C: { label: '10 years', templates: 25, years: 10 },
  D: { label: 'stress: 10x the bills for 10 years', templates: 250, years: 10 },
};

// Matches the app's cap on the audit log (MAX_AUDIT_LOG_ENTRIES).
const AUDIT_LOG_ROWS = 500;
const CARDS = 4;
const CATEGORIES = [
  'Housing',
  'Utilities',
  'Subscriptions',
  'Insurance',
  'Transportation',
  'Food',
];

// mulberry32: small seeded PRNG.
const rng = seed => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pad = n => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

export const buildDataset = (tierKey, today = new Date()) => {
  const tier = TIERS[tierKey];
  if (!tier) throw new Error(`Unknown tier ${tierKey}`);
  const rand = rng(1000 + tierKey.charCodeAt(0));
  const uuid = () => {
    const h = () => Math.floor(rand() * 16).toString(16);
    const block = n => Array.from({ length: n }, h).join('');
    return `${block(8)}-${block(4)}-4${block(3)}-${'89ab'[Math.floor(rand() * 4)]}${block(3)}-${block(12)}`;
  };
  const money = (lo, hi) => Math.round((lo + rand() * (hi - lo)) * 100) / 100;

  const nowIso = today.toISOString();
  const stamp = { createdAt: nowIso, updatedAt: nowIso, deletedAt: null };
  const ty = today.getFullYear();
  const tm = today.getMonth() + 1;
  const td = today.getDate();

  const accounts = [
    {
      id: uuid(),
      name: 'Checking',
      type: 'checking',
      currentBalance: 12000,
      isDefault: true,
      ...stamp,
    },
    {
      id: uuid(),
      name: 'Savings',
      type: 'savings',
      currentBalance: 30000,
      isDefault: false,
      ...stamp,
    },
  ];
  const checkingId = accounts[0].id;

  const creditCards = Array.from({ length: CARDS }, (_, i) => ({
    id: uuid(),
    name: `Card ${i + 1}`,
    balance: money(200, 3000),
    creditLimit: 8000,
    interestRate: 19.99,
    dueDate: ymd(ty, tm === 12 ? 1 : tm + 1, 5 + i * 5),
    minimumPayment: 35,
    ...stamp,
  }));

  const templates = [];
  const fixedExpenses = [];
  const recurringResolutionLog = [];
  const monthlyExpenseHistory = [];

  const months = tier.years * 12;
  for (let t = 0; t < tier.templates; t++) {
    const isCard = t < CARDS;
    const day = 1 + ((t * 7) % 28);
    const base = isCard ? 200 : money(10, 220);
    const category = isCard
      ? 'Credit Card Payment'
      : CATEGORIES[t % CATEGORIES.length];
    const templateId = uuid();
    const nextMonth = tm === 12 ? { y: ty + 1, m: 1 } : { y: ty, m: tm + 1 };
    templates.push({
      id: templateId,
      name: isCard ? `${creditCards[t].name} Payment` : `Bill ${t + 1}`,
      baseAmount: base,
      frequency: 'monthly',
      intervalValue: 1,
      intervalUnit: 'months',
      startDate: ymd(ty - tier.years, tm, day),
      lastGenerated: ymd(ty, tm, day),
      nextDueDate: ymd(nextMonth.y, nextMonth.m, day),
      category,
      accountId: checkingId,
      ...(isCard && { targetCreditCardId: creditCards[t].id }),
      isActive: true,
      isVariableAmount: isCard,
      ...stamp,
    });

    for (let back = months; back >= 0; back--) {
      const idx = ty * 12 + (tm - 1) - back;
      const y = Math.floor(idx / 12);
      const m = (idx % 12) + 1;
      const dueDate = ymd(y, m, day);
      const isCurrent = back === 0;
      const paid = !isCurrent || day < td;
      const id = uuid();
      fixedExpenses.push({
        id,
        name: isCard ? `${creditCards[t].name} Payment` : `Bill ${t + 1}`,
        dueDate,
        amount: base,
        paidAmount: paid ? base : 0,
        status: paid ? 'paid' : 'pending',
        category,
        accountId: checkingId,
        creditCardId: null,
        targetCreditCardId: isCard ? creditCards[t].id : null,
        recurringTemplateId: templateId,
        ...stamp,
      });
      if (paid) {
        const resolvedAt = new Date(y, m - 1, day, 9).toISOString();
        recurringResolutionLog.push({
          id: uuid(),
          templateId,
          expenseId: id,
          cycleDueDate: dueDate,
          resolvedAt,
          committedAmount: base,
          paidAmount: base,
          wasSkipped: false,
          coveredByCardPayments: false,
          adjustmentExpenseId: null,
          shortfallOutcome: null,
          deferredDueDate: null,
          templatePausedOnForgive: false,
          previousNextDueDate: dueDate,
          previousLastGenerated: dueDate,
          previousExpensePaidAmount: 0,
          previousExpenseStatus: 'pending',
          createdAt: resolvedAt,
          updatedAt: resolvedAt,
          deletedAt: null,
        });
        monthlyExpenseHistory.push({
          expenseId: id,
          month: m,
          year: y,
          budgetAmount: base,
          actualAmount: base,
          overpaymentAmount: 0,
          ...stamp,
        });
      }
    }
  }

  const auditLogs = Array.from({ length: AUDIT_LOG_ROWS }, (_, i) => ({
    id: uuid(),
    timestamp: new Date(today.getTime() - i * 3600e3).toISOString(),
    actionType: 'RESOLVE_CYCLE',
    entityType: 'fixedExpense',
    entityId: fixedExpenses[fixedExpenses.length - 1 - i]?.id ?? uuid(),
    details: { paidAmount: 50, committedAmount: 50 },
    updatedAt: nowIso,
    deletedAt: null,
  }));

  const pendingTransactions = Array.from({ length: 40 }, (_, i) => ({
    id: uuid(),
    accountId: checkingId,
    amount: -money(5, 90),
    category: CATEGORIES[i % CATEGORIES.length],
    description: `Purchase ${i + 1}`,
    ...stamp,
  }));

  // Biweekly pay anchored on a recent date so the countdown has something.
  const anchor = new Date(today.getTime() - 5 * 86400e3);
  const paycheckSettings = [
    {
      id: uuid(),
      lastPaycheckDate: ymd(
        anchor.getFullYear(),
        anchor.getMonth() + 1,
        anchor.getDate(),
      ),
      frequency: 'biweekly',
      ...stamp,
    },
  ];

  return {
    accounts,
    creditCards,
    recurringExpenseTemplates: templates,
    fixedExpenses,
    recurringResolutionLog,
    monthlyExpenseHistory,
    auditLogs,
    pendingTransactions,
    paycheckSettings,
  };
};

export const countRows = data =>
  Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
