import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  vi,
  describe,
  test,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
} from 'vitest';

import AccountSelectorErrorBoundary from '../AccountSelectorErrorBoundary';

// Component that throws an error for testing
const ThrowError = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error for error boundary');
  }
  return <div>No error</div>;
};

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('AccountSelectorErrorBoundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders children when there is no error', () => {
    render(
      <AccountSelectorErrorBoundary>
        <ThrowError shouldThrow={false} />
      </AccountSelectorErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  test('renders error UI when child component throws', () => {
    render(
      <AccountSelectorErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AccountSelectorErrorBoundary>
    );

    expect(screen.getByText('Account Selection Error')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Unable to load account options. This might be due to invalid data or a temporary issue.'
      ),
    ).toBeInTheDocument();
  });

  test('shows retry button in error state', () => {
    render(
      <AccountSelectorErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AccountSelectorErrorBoundary>
    );

    const retryButton = screen.getByText('Retry');
    expect(retryButton).toBeInTheDocument();
  });

  test('retry button resets error state', () => {
    const { rerender } = render(
      <AccountSelectorErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AccountSelectorErrorBoundary>
    );

    expect(screen.getByText('Account Selection Error')).toBeInTheDocument();

    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    // Rerender with no error
    rerender(
      <AccountSelectorErrorBoundary>
        <ThrowError shouldThrow={false} />
      </AccountSelectorErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  test('shows reset button after retry attempts', () => {
    const { rerender } = render(
      <AccountSelectorErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AccountSelectorErrorBoundary>
    );

    // First retry
    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    // Rerender with error still present
    rerender(
      <AccountSelectorErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AccountSelectorErrorBoundary>
    );

    // Reset button should now be visible
    expect(screen.getByText('Reset')).toBeInTheDocument();
    expect(screen.getByText('Retry attempts: 1')).toBeInTheDocument();
  });

  test('reset button resets retry count', () => {
    const { rerender } = render(
      <AccountSelectorErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AccountSelectorErrorBoundary>
    );

    // First retry
    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);

    // Rerender with error still present
    rerender(
      <AccountSelectorErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AccountSelectorErrorBoundary>
    );

    // Click reset
    const resetButton = screen.getByText('Reset');
    fireEvent.click(resetButton);

    // Rerender with no error
    rerender(
      <AccountSelectorErrorBoundary>
        <ThrowError shouldThrow={false} />
      </AccountSelectorErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  test('shows error details in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      <AccountSelectorErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AccountSelectorErrorBoundary>
    );

    const detailsButton = screen.getByText('Error Details (Development)');
    expect(detailsButton).toBeInTheDocument();

    fireEvent.click(detailsButton);

    expect(
      screen.getByText('Test error for error boundary')
    ).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  test('does not show error details in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    render(
      <AccountSelectorErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AccountSelectorErrorBoundary>
    );

    expect(
      screen.queryByText('Error Details (Development)')
    ).not.toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  test('logs error to console', () => {
    render(
      <AccountSelectorErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AccountSelectorErrorBoundary>
    );

    expect(console.error).toHaveBeenCalledWith(
      'AccountSelector Error Boundary caught an error:',
      expect.any(Error),
      expect.any(Object)
    );
  });

  test('handles multiple error states correctly', () => {
    const { rerender } = render(
      <AccountSelectorErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AccountSelectorErrorBoundary>
    );

    // First error
    expect(screen.getByText('Account Selection Error')).toBeInTheDocument();

    // Retry
    fireEvent.click(screen.getByText('Retry'));

    // Rerender with no error
    rerender(
      <AccountSelectorErrorBoundary>
        <ThrowError shouldThrow={false} />
      </AccountSelectorErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();

    // Throw error again
    rerender(
      <AccountSelectorErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AccountSelectorErrorBoundary>
    );

    expect(screen.getByText('Account Selection Error')).toBeInTheDocument();
  });
});
