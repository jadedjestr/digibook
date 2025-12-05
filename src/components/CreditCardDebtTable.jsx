import { ArrowDown, ArrowUp, CreditCard } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import CollapsibleCard from './CollapsibleCard';
import PrivacyWrapper from './PrivacyWrapper';
import StatusBadge from './StatusBadge';
import {
  calculateAvailableCredit,
  formatCreditCardBalance,
} from '../utils/creditCardUtils';
import { formatCurrency } from '../utils/accountUtils';

const CreditCardDebtTable = ({ creditCards = [] }) => {
  // Sorting state
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  // Handle column header click for sorting
  const handleSort = column => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort credit cards based on selected column and direction
  const sortedCreditCards = useMemo(() => {
    if (!sortColumn || !creditCards.length) return creditCards;

    return [...creditCards].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'name':
          const aName = a.name || '';
          const bName = b.name || '';
          comparison = aName.localeCompare(bName);
          break;

        case 'balance':
          comparison = (a.balance || 0) - (b.balance || 0);
          break;

        case 'creditLimit':
          comparison = (a.creditLimit || 0) - (b.creditLimit || 0);
          break;

        case 'utilization': {
          const aUtil = calculateAvailableCredit(
            a.balance || 0,
            a.creditLimit || 0
          ).utilization;
          const bUtil = calculateAvailableCredit(
            b.balance || 0,
            b.creditLimit || 0
          ).utilization;
          comparison = aUtil - bUtil;
          break;
        }

        case 'interestRate':
          comparison = (a.interestRate || 0) - (b.interestRate || 0);
          break;

        case 'dueDate': {
          const aDue = a.dueDate
            ? new Date(`${a.dueDate}T00:00:00`)
            : new Date('2099-12-31');
          const bDue = b.dueDate
            ? new Date(`${b.dueDate}T00:00:00`)
            : new Date('2099-12-31');
          comparison = aDue - bDue;
          break;
        }

        default:
          return 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [creditCards, sortColumn, sortDirection]);

  // Render sort indicator
  const renderSortIndicator = column => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? (
      <ArrowUp size={14} className='inline-block ml-1' />
    ) : (
      <ArrowDown size={14} className='inline-block ml-1' />
    );
  };

  // Calculate totals and statistics
  const summary = useMemo(() => {
    const totalDebt = creditCards.reduce(
      (sum, card) => sum + Math.max(card.balance || 0, 0),
      0
    );
    const totalCreditLimit = creditCards.reduce(
      (sum, card) => sum + (card.creditLimit || 0),
      0
    );
    const totalUtilization =
      totalCreditLimit > 0 ? (totalDebt / totalCreditLimit) * 100 : 0;
    const totalAvailableCredit = totalCreditLimit - totalDebt;

    return {
      totalDebt,
      totalCreditLimit,
      totalUtilization,
      totalAvailableCredit,
      cardCount: creditCards.length,
    };
  }, [creditCards]);

  // Format date helper
  const formatDate = dateString => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Get days until due
  const getDaysUntilDue = dueDate => {
    if (!dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${dueDate}T00:00:00`);
    const diffTime = due - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Get utilization color
  const getUtilizationColor = utilization => {
    if (utilization >= 90) return 'text-red-400';
    if (utilization >= 70) return 'text-orange-400';
    if (utilization >= 50) return 'text-yellow-400';
    return 'text-green-400';
  };

  // Get status for a card
  const getCardStatus = card => {
    const daysUntilDue = getDaysUntilDue(card.dueDate);
    const creditInfo = calculateAvailableCredit(
      card.balance || 0,
      card.creditLimit || 0
    );

    // Handle zero balance (paid off)
    if (card.balance === 0) return 'Paid Off';

    // Handle negative balance (credit balance - customer is owed money)
    if (card.balance < 0) return 'Credit Balance';

    // Check for overdue cards first (negative daysUntilDue)
    if (daysUntilDue !== null && daysUntilDue < 0) return 'Overdue';

    // Check for due soon (0-7 days)
    if (daysUntilDue !== null && daysUntilDue <= 7 && daysUntilDue >= 0)
      return 'Due Soon';

    // Check utilization levels
    if (creditInfo.utilization >= 90) return 'High Usage';
    if (creditInfo.utilization >= 70) return 'Above Ideal';
    return 'Good Standing';
  };

  if (creditCards.length === 0) {
    return (
      <CollapsibleCard
        title='Credit Card Debt Overview'
        icon={CreditCard}
        defaultExpanded={false}
      >
        <div className='text-center py-4'>
          <p className='text-white/70'>No credit cards found.</p>
        </div>
      </CollapsibleCard>
    );
  }

  return (
    <CollapsibleCard
      title='Credit Card Debt Overview'
      icon={CreditCard}
      defaultExpanded={false}
    >
      {/* Summary Row - Always Visible */}
      <div className='mb-4 p-3 glass-card rounded-lg border border-white/10'>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
          <div>
            <p className='text-white/70 mb-1'>Total Debt</p>
            <PrivacyWrapper>
              <p className='text-lg font-bold text-white'>
                {formatCurrency(summary.totalDebt)}
              </p>
            </PrivacyWrapper>
          </div>
          <div>
            <p className='text-white/70 mb-1'>Total Credit Limit</p>
            <PrivacyWrapper>
              <p className='text-lg font-bold text-white'>
                {formatCurrency(summary.totalCreditLimit)}
              </p>
            </PrivacyWrapper>
          </div>
          <div>
            <p className='text-white/70 mb-1'>Utilization</p>
            <p
              className={`text-lg font-bold ${getUtilizationColor(
                summary.totalUtilization
              )}`}
            >
              {summary.totalUtilization.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className='text-white/70 mb-1'>Available Credit</p>
            <PrivacyWrapper>
              <p className='text-lg font-bold text-green-400'>
                {formatCurrency(summary.totalAvailableCredit)}
              </p>
            </PrivacyWrapper>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className='overflow-x-auto'>
        <table className='w-full'>
          <thead>
            <tr className='border-b border-white/10'>
              <th
                className='text-left py-2 px-3 text-sm font-medium text-white/70 cursor-pointer hover:bg-white/5 transition-colors select-none'
                onClick={() => handleSort('name')}
              >
                <div className='flex items-center'>
                  Card Name
                  {renderSortIndicator('name')}
                </div>
              </th>
              <th
                className='text-right py-2 px-3 text-sm font-medium text-white/70 cursor-pointer hover:bg-white/5 transition-colors select-none'
                onClick={() => handleSort('balance')}
              >
                <div className='flex items-center justify-end'>
                  Balance
                  {renderSortIndicator('balance')}
                </div>
              </th>
              <th
                className='text-right py-2 px-3 text-sm font-medium text-white/70 cursor-pointer hover:bg-white/5 transition-colors select-none'
                onClick={() => handleSort('creditLimit')}
              >
                <div className='flex items-center justify-end'>
                  Credit Limit
                  {renderSortIndicator('creditLimit')}
                </div>
              </th>
              <th
                className='text-right py-2 px-3 text-sm font-medium text-white/70 cursor-pointer hover:bg-white/5 transition-colors select-none'
                onClick={() => handleSort('utilization')}
              >
                <div className='flex items-center justify-end'>
                  Utilization
                  {renderSortIndicator('utilization')}
                </div>
              </th>
              <th
                className='text-right py-2 px-3 text-sm font-medium text-white/70 cursor-pointer hover:bg-white/5 transition-colors select-none'
                onClick={() => handleSort('interestRate')}
              >
                <div className='flex items-center justify-end'>
                  Interest Rate
                  {renderSortIndicator('interestRate')}
                </div>
              </th>
              <th
                className='text-center py-2 px-3 text-sm font-medium text-white/70 cursor-pointer hover:bg-white/5 transition-colors select-none'
                onClick={() => handleSort('dueDate')}
              >
                <div className='flex items-center justify-center'>
                  Due Date
                  {renderSortIndicator('dueDate')}
                </div>
              </th>
              <th className='text-center py-2 px-3 text-sm font-medium text-white/70'>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCreditCards.map(card => {
              const balanceInfo = formatCreditCardBalance(card.balance || 0);
              const creditInfo = calculateAvailableCredit(
                card.balance || 0,
                card.creditLimit || 0
              );
              const status = getCardStatus(card);

              return (
                <tr
                  key={card.id}
                  className='border-b border-white/5 hover:bg-white/5 transition-colors'
                >
                  <td className='py-3 px-3 text-white font-medium'>
                    {card.name}
                  </td>
                  <td className='py-3 px-3 text-right'>
                    <PrivacyWrapper>
                      <span className={balanceInfo.className}>
                        {balanceInfo.formattedAmount}
                      </span>
                    </PrivacyWrapper>
                  </td>
                  <td className='py-3 px-3 text-right text-white/70'>
                    <PrivacyWrapper>
                      {formatCurrency(card.creditLimit || 0)}
                    </PrivacyWrapper>
                  </td>
                  <td className='py-3 px-3 text-right'>
                    <span
                      className={getUtilizationColor(creditInfo.utilization)}
                    >
                      {creditInfo.formattedUtilization}
                    </span>
                  </td>
                  <td className='py-3 px-3 text-right text-white/70'>
                    {card.interestRate !== null &&
                    card.interestRate !== undefined
                      ? `${(card.interestRate || 0).toFixed(2)}%`
                      : 'N/A'}
                  </td>
                  <td className='py-3 px-3 text-center text-white/70'>
                    {formatDate(card.dueDate)}
                  </td>
                  <td className='py-3 px-3 text-center'>
                    <StatusBadge status={status} variant='credit-card' />
                  </td>
                </tr>
              );
            })}
            {/* Total Row */}
            <tr className='border-t-2 border-white/20 bg-white/5 font-semibold'>
              <td className='py-3 px-3 text-white'>Total</td>
              <td className='py-3 px-3 text-right'>
                <PrivacyWrapper>
                  <span className='text-white'>
                    {formatCurrency(summary.totalDebt)}
                  </span>
                </PrivacyWrapper>
              </td>
              <td className='py-3 px-3 text-right text-white/70'>
                <PrivacyWrapper>
                  {formatCurrency(summary.totalCreditLimit)}
                </PrivacyWrapper>
              </td>
              <td className='py-3 px-3 text-right'>
                <span className={getUtilizationColor(summary.totalUtilization)}>
                  {summary.totalUtilization.toFixed(1)}%
                </span>
              </td>
              <td className='py-3 px-3 text-right text-white/70'>—</td>
              <td className='py-3 px-3 text-center text-white/70'>—</td>
              <td className='py-3 px-3 text-center'>
                <span className='text-white/70'>
                  {summary.cardCount} card{summary.cardCount !== 1 ? 's' : ''}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </CollapsibleCard>
  );
};

export default CreditCardDebtTable;
