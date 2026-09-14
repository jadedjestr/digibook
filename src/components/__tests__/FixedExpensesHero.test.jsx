import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';

import { PrivacyProvider } from '../../contexts/PrivacyContext';
import FixedExpensesHero from '../FixedExpensesHero';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const renderHero = summaryTotals =>
  render(
    <PrivacyProvider>
      <FixedExpensesHero summaryTotals={summaryTotals} />
    </PrivacyProvider>,
  );

describe('FixedExpensesHero', () => {
  test('shows the this-week total as the hero number', () => {
    renderHero({
      payThisWeekTotal: 404.87,
      payNextCheckTotal: 0,
      overdueTotal: 0,
    });
    expect(screen.getByText('$404.87')).toBeInTheDocument();
  });

  test('reads "Nothing overdue" when there is nothing overdue', () => {
    renderHero({
      payThisWeekTotal: 100,
      payNextCheckTotal: 0,
      overdueTotal: 0,
    });
    expect(screen.getByText('Nothing overdue')).toBeInTheDocument();
  });

  test('shows the overdue amount instead, when there is one', () => {
    renderHero({
      payThisWeekTotal: 100,
      payNextCheckTotal: 0,
      overdueTotal: 125,
    });
    expect(screen.queryByText('Nothing overdue')).not.toBeInTheDocument();

    // The amount and "overdue" are sibling text inside one span
    // ("$125.00 overdue"), so no single node's own text is exactly either
    // string — a regex matches as a substring of the node's full text,
    // where an exact-string match would find nothing at all.
    expect(screen.getByText(/\$125\.00/)).toBeInTheDocument();
    expect(screen.getByText(/overdue/)).toBeInTheDocument();
  });

  test('shows the next-check total as context', () => {
    renderHero({
      payThisWeekTotal: 100,
      payNextCheckTotal: 292.97,
      overdueTotal: 0,
    });
    expect(screen.getByText(/\$292\.97/)).toBeInTheDocument();
    expect(screen.getByText(/with your next check/)).toBeInTheDocument();
  });

  test('does not throw when summaryTotals is entirely omitted', () => {
    expect(() =>
      render(
        <PrivacyProvider>
          <FixedExpensesHero />
        </PrivacyProvider>,
      ),
    ).not.toThrow();
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  test('all three amounts are privacy-masked when hidden', () => {
    renderHero({
      payThisWeekTotal: 404.87,
      payNextCheckTotal: 292.97,
      overdueTotal: 125,
    });

    // Sanity check before toggling: the masked fallback isn't present yet.
    // queryAllByText (not getAllByText) is required here — getAllByText
    // throws on zero matches instead of returning an empty array.
    expect(screen.queryAllByText('••••••')).toHaveLength(0);
    expect(screen.getByText('$404.87')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'h', metaKey: true, shiftKey: true });

    expect(screen.queryByText('$404.87')).not.toBeInTheDocument();
    expect(screen.queryByText(/\$292\.97/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\$125\.00/)).not.toBeInTheDocument();

    // Unlike the amounts above, each masked fallback IS its own isolated
    // element (PrivacyWrapper renders a real <span>••••••</span>, not a
    // bare string), so an exact match against all three is reliable here.
    expect(screen.getAllByText('••••••')).toHaveLength(3);
  });
});
