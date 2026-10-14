import { describe, expect, it } from 'vitest';

import { getExpenseEditPolicy } from '../expenseEditPolicy';

const bill = overrides => ({
  id: 'e1',
  name: 'Bill',
  amount: 100,
  paidAmount: 0,
  dueDate: '2026-10-20',
  accountId: 'acc1',
  creditCardId: null,
  recurringTemplateId: null,
  targetCreditCardId: null,
  targetLoanId: null,
  ...overrides,
});

const locks = policy => ({
  amount: policy.fields.amount.locked,
  dueDate: policy.fields.dueDate.locked,
  paymentSource: policy.fields.paymentSource.locked,
});

describe('getExpenseEditPolicy — what is editable', () => {
  it('a one-off bill is fully editable and deletable', () => {
    const policy = getExpenseEditPolicy(bill());
    expect(policy.kindLabel).toBe('One-off bill');
    expect(locks(policy)).toEqual({
      amount: false,
      dueDate: false,
      paymentSource: false,
    });
    expect(policy.fields.name.locked).toBe(false);
    expect(policy.removal.action).toBe('delete');
  });

  it('a repeating bill locks its due date but not its amount', () => {
    // The date is how a bill is matched to its cycle; moving it makes the next
    // materialization create a second bill for the same cycle.
    const policy = getExpenseEditPolicy(bill({ recurringTemplateId: 't1' }));
    expect(policy.kindLabel).toBe('Repeating bill');
    expect(locks(policy)).toEqual({
      amount: false,
      dueDate: true,
      paymentSource: false,
    });
    expect(policy.fields.dueDate.reason).toMatch(/after my next paycheck/);
    expect(policy.removal.action).toBe('skipOrStop');
  });

  it('a template-linked card payment locks amount, due date and source', () => {
    const policy = getExpenseEditPolicy(
      bill({ recurringTemplateId: 't1', targetCreditCardId: 'c1' }),
    );
    expect(policy.kindLabel).toBe('Card payment');
    expect(locks(policy)).toEqual({
      amount: true,
      dueDate: true,
      paymentSource: true,
    });
    expect(policy.fields.amount.reason).toMatch(/Credit Cards page/);
    expect(policy.removal.action).toBe('skipOrStop');
  });

  it('a template-less card payment is not re-priced, so its amount stays editable', () => {
    const policy = getExpenseEditPolicy(bill({ targetCreditCardId: 'c1' }));
    expect(locks(policy)).toEqual({
      amount: false,
      dueDate: true,
      paymentSource: true,
    });
    expect(policy.removal.action).toBe('none');
    expect(policy.removal.reason).toMatch(/Credit Cards page/);
  });

  it('a loan payment locks amount even without a template', () => {
    const policy = getExpenseEditPolicy(bill({ targetLoanId: 'l1' }));
    expect(policy.kindLabel).toBe('Loan payment');
    expect(locks(policy)).toEqual({
      amount: true,
      dueDate: true,
      paymentSource: true,
    });
    expect(policy.fields.amount.reason).toMatch(/Loans page/);
  });

  it('a Balance Due is deletable and keeps an editable amount, even for a card payment', () => {
    const policy = getExpenseEditPolicy(
      bill({ targetCreditCardId: 'c1', isAutoCreated: true }),
      { isBalanceDue: true },
    );
    expect(policy.kindLabel).toBe('Balance due');
    expect(policy.fields.amount.locked).toBe(false);
    expect(policy.removal.action).toBe('delete');
  });
});

describe('getExpenseEditPolicy — money already paid', () => {
  it('requires the amount to stay above what is paid', () => {
    const policy = getExpenseEditPolicy(bill({ paidAmount: 40 }));
    expect(policy.fields.amount.mustExceed).toBe(40);
  });

  it('an unpaid bill only needs a positive amount', () => {
    expect(getExpenseEditPolicy(bill()).fields.amount.mustExceed).toBe(0);
  });

  it('locks the payment source once a payment was made from it', () => {
    const policy = getExpenseEditPolicy(bill({ paidAmount: 40 }));
    expect(policy.fields.paymentSource.locked).toBe(true);
    expect(policy.fields.paymentSource.reason).toMatch(/already been made/);
  });

  it('a bill with a payment recorded cannot be deleted, balance due or not', () => {
    for (const isBalanceDue of [false, true]) {
      const policy = getExpenseEditPolicy(bill({ paidAmount: 40 }), {
        isBalanceDue,
      });
      expect(policy.removal.action).toBe('none');
    }
  });

  it('treats a missing or null paidAmount as zero', () => {
    const policy = getExpenseEditPolicy(bill({ paidAmount: null }));
    expect(policy.fields.amount.mustExceed).toBe(0);
    expect(policy.fields.paymentSource.locked).toBe(false);
  });
});
