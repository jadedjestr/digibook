import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CardPaymentModeField, {
  resolveCustomPayment,
} from '../CardPaymentModeField';

afterEach(cleanup);

describe('resolveCustomPayment', () => {
  it('is "no custom amount" for the calculated payment, whatever is typed', () => {
    expect(resolveCustomPayment('calculated', '250')).toEqual({
      error: null,
      amount: null,
    });
  });

  it('reads a typed amount at the edge, accepting $ and commas', () => {
    expect(resolveCustomPayment('custom', '$1,200.50')).toEqual({
      error: null,
      amount: 1200.5,
    });
  });

  it('keeps whole cents', () => {
    expect(resolveCustomPayment('custom', '100.456').amount).toBe(100.46);
  });

  it('does not turn blank or garbage into a number', () => {
    expect(resolveCustomPayment('custom', '').error).toBe('Enter an amount');
    expect(resolveCustomPayment('custom', 'abc').error).toBe(
      'Enter a valid amount',
    );
    expect(resolveCustomPayment('custom', 'abc').amount).toBeNull();
  });

  it('rejects zero and negatives: skipping a payment is what Skip is for', () => {
    for (const text of ['0', '-5', '0.00']) {
      expect(resolveCustomPayment('custom', text)).toEqual({
        error: 'Enter an amount above $0.00',
        amount: null,
      });
    }
  });
});

describe('CardPaymentModeField', () => {
  const setup = (props = {}) => {
    const onChange = vi.fn();
    render(
      <CardPaymentModeField
        mode='calculated'
        customPayment=''
        onChange={onChange}
        {...props}
      />,
    );
    return onChange;
  };

  it('shows the calculated payment and no amount box by default', () => {
    setup({ calculatedPayment: 138.95 });
    expect(
      screen.getByRole('button', { name: 'Calculated for me' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Custom amount' }),
    ).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/Right now: \$138\.95\/month/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Custom payment per month')).toBeNull();
  });

  it('says nothing about a calculated amount it does not have', () => {
    setup();
    expect(screen.queryByText(/Right now/)).toBeNull();
  });

  it('switches mode through onChange', () => {
    const onChange = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Custom amount' }));
    expect(onChange).toHaveBeenCalledWith('paymentMode', 'custom');
  });

  it('can switch back to the calculated payment', () => {
    const onChange = setup({ mode: 'custom', customPayment: '99' });
    fireEvent.click(screen.getByRole('button', { name: 'Calculated for me' }));
    expect(onChange).toHaveBeenCalledWith('paymentMode', 'calculated');
  });

  it('shows the amount box, with what was typed, in custom mode', () => {
    const onChange = setup({ mode: 'custom', customPayment: '99' });
    const input = screen.getByLabelText('Custom payment per month');
    expect(input).toHaveValue('99');
    fireEvent.change(input, { target: { value: '120' } });
    expect(onChange).toHaveBeenCalledWith('customPayment', '120');
  });

  it('shows a validation error next to the amount', () => {
    setup({
      mode: 'custom',
      customPayment: 'abc',
      error: 'Enter a valid amount',
    });
    expect(screen.getByText('Enter a valid amount')).toBeInTheDocument();
  });

  it('warns, without blocking, when the amount is below the card’s minimum', () => {
    setup({
      mode: 'custom',
      customPayment: '20',
      issuerMinimum: 25,
      plan: { belowIssuerMinimum: true, paysOffCard: false },
    });
    expect(
      screen.getByText(/below the card’s minimum payment of \$25\.00/),
    ).toBeInTheDocument();
    expect(screen.getByText(/may be charged a late fee/)).toBeInTheDocument();
  });

  it('does not warn when the amount meets the minimum', () => {
    setup({
      mode: 'custom',
      customPayment: '25',
      issuerMinimum: 25,
      plan: { belowIssuerMinimum: false, paysOffCard: false },
    });
    expect(screen.queryByText(/late fee/)).toBeNull();
  });

  it('says when the amount pays the card off, instead of a payoff date', () => {
    setup({
      mode: 'custom',
      customPayment: '500',
      plan: {
        paysOffCard: true,
        belowIssuerMinimum: false,
        projectedPayoffDate: '2026-10-14T00:00:00.000Z',
      },
    });
    expect(
      screen.getByText(/This pays off the card\. The bill will be just/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/paid off by/)).toBeNull();
  });

  it('warns when the amount is less than the card’s monthly interest', () => {
    setup({
      mode: 'custom',
      customPayment: '10',
      plan: {
        neverPaysOff: true,
        paysOffCard: false,
        belowIssuerMinimum: false,
        projectedPayoffDate: null,
      },
    });
    expect(
      screen.getByText(/less than the card’s monthly interest/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/paid off by/)).toBeNull();
  });

  it('shows when the card will be paid off at this payment', () => {
    setup({
      mode: 'custom',
      customPayment: '99',
      plan: {
        paysOffCard: false,
        belowIssuerMinimum: false,
        projectedPayoffDate: '2027-03-14T00:00:00.000Z',
      },
    });
    expect(screen.getByText(/paid off by/)).toBeInTheDocument();
  });
});
