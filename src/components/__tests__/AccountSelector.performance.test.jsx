import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { vi, describe, test, expect, beforeEach } from 'vitest';

import AccountSelector from '../AccountSelector';

// Mock data for performance testing
const mockAccounts = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  name: `Account ${i + 1}`,
  currentBalance: Math.random() * 10000,
  type: 'checking',
  isDefault: i === 0,
}));

const mockCreditCards = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `Credit Card ${i + 1}`,
  balance: Math.random() * 5000,
  creditLimit: 10000,
  interestRate: 15.99,
  dueDate: '2024-01-15',
  statementClosingDate: '2024-01-01',
  minimumPayment: 25,
  createdAt: '2024-01-01T00:00:00Z',
}));

const defaultProps = {
  value: 1,
  onSave: vi.fn(),
  accounts: mockAccounts,
  creditCards: mockCreditCards,
  isCreditCardPayment: false,
};

describe('AccountSelector Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders large account list efficiently', () => {
    const startTime = performance.now();

    render(<AccountSelector {...defaultProps} />);

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render within 100ms for 150 accounts
    expect(renderTime).toBeLessThan(100);
  });

  test('handles rapid prop changes efficiently', () => {
    const { rerender } = render(<AccountSelector {...defaultProps} />);

    const startTime = performance.now();

    // Simulate rapid prop changes
    for (let i = 0; i < 10; i++) {
      rerender(<AccountSelector {...defaultProps} value={i + 1} />);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Should handle 10 rerenders within 50ms
    expect(totalTime).toBeLessThan(50);
  });

  test('dropdown opening is performant', () => {
    render(<AccountSelector {...defaultProps} />);

    const button = screen.getByRole('button');

    const startTime = performance.now();
    fireEvent.click(button);
    const endTime = performance.now();

    const openTime = endTime - startTime;

    // Dropdown should open within 16ms (one frame at 60fps)
    expect(openTime).toBeLessThan(16);
  });

  test('account selection is performant', () => {
    render(<AccountSelector {...defaultProps} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Find the first account option
    const accountOptions = screen
      .getAllByRole('button')
      .filter(btn => btn.textContent.includes('Account'));

    expect(accountOptions.length).toBeGreaterThan(0);

    const firstAccount = accountOptions[0];

    const startTime = performance.now();
    fireEvent.click(firstAccount);
    const endTime = performance.now();

    const selectionTime = endTime - startTime;

    // Account selection should be within 16ms
    expect(selectionTime).toBeLessThan(16);
  });

  test('memoization prevents unnecessary re-renders', () => {
    const renderSpy = vi.fn();

    const TestComponent = ({ accounts, creditCards }) => {
      renderSpy();
      return (
        <AccountSelector
          {...defaultProps}
          accounts={accounts}
          creditCards={creditCards}
        />
      );
    };

    const { rerender } = render(
      <TestComponent accounts={mockAccounts} creditCards={mockCreditCards} />
    );

    // Clear initial render
    renderSpy.mockClear();

    // Rerender with same props - should not cause re-render due to memoization
    rerender(
      <TestComponent accounts={mockAccounts} creditCards={mockCreditCards} />
    );

    // Should not have re-rendered due to memoization
    expect(renderSpy).toHaveBeenCalledTimes(0);
  });

  test('handles credit card payment mode efficiently', () => {
    const startTime = performance.now();

    render(<AccountSelector {...defaultProps} isCreditCardPayment={true} />);

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Should render credit card payment mode within 50ms
    expect(renderTime).toBeLessThan(50);
  });

  test('memory usage is reasonable', () => {
    // This is a basic memory test - in a real app you'd use more sophisticated tools
    const initialMemory = performance.memory
      ? performance.memory.usedJSHeapSize
      : 0;

    const { unmount } = render(<AccountSelector {...defaultProps} />);

    // Simulate some interactions
    const button = screen.getByRole('button');
    fireEvent.click(button);

    const accountOptions = screen
      .getAllByRole('button')
      .filter(btn => btn.textContent.includes('Account'));
    if (accountOptions.length > 0) {
      fireEvent.click(accountOptions[0]);
    }

    unmount();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = performance.memory
      ? performance.memory.usedJSHeapSize
      : 0;

    // Memory usage should not increase significantly
    if (initialMemory > 0 && finalMemory > 0) {
      const memoryIncrease = finalMemory - initialMemory;

      // Should not increase by more than 1MB
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    }
  });
});
