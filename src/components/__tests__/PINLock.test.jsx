import { render } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';

import PINLock from '../PINLock';

// A numeric PIN popping the full QWERTY keyboard on mobile is the exact bug
// this component must not regress into - these three attributes together
// are what makes a phone draw a numeric keypad instead.
const expectNumericKeypadAttributes = input => {
  expect(input).toHaveAttribute('inputMode', 'numeric');
  expect(input).toHaveAttribute('pattern', '[0-9]*');
  expect(input).toHaveAttribute('autoComplete', 'off');
};

describe('PINLock', () => {
  test('the set-PIN and confirm-PIN inputs both request a numeric keypad', () => {
    const { getByPlaceholderText } = render(
      <PINLock pin={null} onUnlock={vi.fn()} onPINChange={vi.fn()} />,
    );

    expectNumericKeypadAttributes(getByPlaceholderText('Enter new PIN'));
    expectNumericKeypadAttributes(getByPlaceholderText('Confirm PIN'));
  });

  test('the unlock PIN input requests a numeric keypad', () => {
    const { getByPlaceholderText } = render(
      <PINLock pin='1234' onUnlock={vi.fn()} onPINChange={vi.fn()} />,
    );

    expectNumericKeypadAttributes(getByPlaceholderText('Enter PIN'));
  });
});
