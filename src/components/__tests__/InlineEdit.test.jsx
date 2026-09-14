import { render, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';

import { PrivacyProvider } from '../../contexts/PrivacyContext';
import InlineEdit from '../InlineEdit';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const renderWithPrivacy = ui => render(<PrivacyProvider>{ui}</PrivacyProvider>);

describe('InlineEdit (type="number")', () => {
  // Mobile keyboards default to an integer-only numeric pad for a bare
  // type='number' input on several Android keyboards, omitting the decimal
  // point - exactly the character every dollar amount needs.
  test('requests a decimal-capable mobile keyboard', () => {
    const { getByTitle, getByRole } = renderWithPrivacy(
      <InlineEdit value={100} onSave={vi.fn()} type='number' showEditIcon />,
    );

    fireEvent.click(getByTitle('Click to edit'));
    expect(getByRole('spinbutton')).toHaveAttribute('inputMode', 'decimal');
  });

  test('saves a valid finite number', () => {
    const onSave = vi.fn();
    const { getByTitle, getByRole } = renderWithPrivacy(
      <InlineEdit value={100} onSave={onSave} type='number' showEditIcon />,
    );

    fireEvent.click(getByTitle('Click to edit'));
    const input = getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '250' } });
    fireEvent.click(getByTitle('Save (Enter)'));

    expect(onSave).toHaveBeenCalledWith(250);
  });

  // Regression: a value the native number input can't represent (e.g. an
  // out-of-range paste) gets silently cleared to "" by the browser before
  // React ever sees it. parseFloat('') is NaN, and the old `|| 0` fallback
  // treated that as "the user wants to save 0" - silently zeroing out a
  // real balance with no warning. It must refuse to save instead.
  test('refuses to save when the input value is not a finite number', () => {
    const onSave = vi.fn();
    const { getByTitle, getByRole } = renderWithPrivacy(
      <InlineEdit value={2500} onSave={onSave} type='number' showEditIcon />,
    );

    fireEvent.click(getByTitle('Click to edit'));
    const input = getByRole('spinbutton');

    // Simulates the browser having sanitized an out-of-range value to "".
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(getByTitle('Save (Enter)'));

    expect(onSave).not.toHaveBeenCalled();
  });

  test('tells the user why the save was refused instead of failing silently', () => {
    const onSave = vi.fn();
    const { getByTitle, getByRole, getByText } = renderWithPrivacy(
      <InlineEdit value={2500} onSave={onSave} type='number' showEditIcon />,
    );

    fireEvent.click(getByTitle('Click to edit'));
    fireEvent.change(getByRole('spinbutton'), { target: { value: '' } });
    fireEvent.click(getByTitle('Save (Enter)'));

    expect(getByText('Enter an amount')).toBeInTheDocument();
  });

  test('clears the error and saves once the value is corrected', () => {
    const onSave = vi.fn();
    const { getByTitle, getByRole, queryByText } = renderWithPrivacy(
      <InlineEdit value={2500} onSave={onSave} type='number' showEditIcon />,
    );

    fireEvent.click(getByTitle('Click to edit'));
    const input = getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(getByTitle('Save (Enter)'));
    expect(queryByText('Enter an amount')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '300' } });
    expect(queryByText('Enter an amount')).not.toBeInTheDocument();

    fireEvent.click(getByTitle('Save (Enter)'));
    expect(onSave).toHaveBeenCalledWith(300);
  });
});
