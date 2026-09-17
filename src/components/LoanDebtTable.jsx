import { ArrowDown, ArrowUp, Landmark } from 'lucide-react';
import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';

import { formatCurrency } from '../utils/accountUtils';
import { formatLoanBalance } from '../utils/loanUtils';

import CollapsibleCard from './CollapsibleCard';
import PrivacyWrapper from './PrivacyWrapper';
import StatusBadge from './StatusBadge';

// Days until a date (local, midnight-normalized) - null when there's no date.
const getDaysUntilDue = dueDate => {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  const diffTime = due - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const LoanDebtTable = ({ loans = [] }) => {
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

  // Sort loans based on selected column and direction
  const sortedLoans = useMemo(() => {
    if (!sortColumn || !loans.length) return loans;

    return [...loans].sort((a, b) => {
      let comparison = 0;

      switch (sortColumn) {
        case 'name': {
          const aName = a.name || '';
          const bName = b.name || '';
          comparison = aName.localeCompare(bName);
          break;
        }
        case 'balance':
          comparison = (a.balance || 0) - (b.balance || 0);
          break;

        case 'originalLoanAmount':
          comparison =
            (a.originalLoanAmount || 0) - (b.originalLoanAmount || 0);
          break;

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

        case 'targetPayoffDate': {
          const aTarget = a.targetPayoffDate
            ? new Date(`${a.targetPayoffDate}T00:00:00`)
            : new Date('2099-12-31');
          const bTarget = b.targetPayoffDate
            ? new Date(`${b.targetPayoffDate}T00:00:00`)
            : new Date('2099-12-31');
          comparison = aTarget - bTarget;
          break;
        }

        default:
          return 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [loans, sortColumn, sortDirection]);

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
    const totalDebt = loans.reduce(
      (sum, loan) => sum + Math.max(loan.balance || 0, 0),
      0,
    );
    const totalOriginalPrincipal = loans.reduce(
      (sum, loan) => sum + (loan.originalLoanAmount || 0),
      0,
    );
    const totalPaidOff = Math.max(0, totalOriginalPrincipal - totalDebt);

    return {
      totalDebt,
      totalOriginalPrincipal,
      totalPaidOff,
      loanCount: loans.length,
    };
  }, [loans]);

  // Format date helper
  const formatDate = dateString => {
    if (!dateString) return 'N/A';
    return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  // Get status for a loan - mirrors EnhancedLoanCard's due-soon thresholds,
  // extended with Overdue/Good Standing so every row always shows a status
  // the way the credit card table's does.
  const getLoanStatus = loan => {
    if ((loan.balance || 0) <= 0) return 'Paid Off';

    const daysUntilDue = getDaysUntilDue(loan.dueDate);
    if (daysUntilDue !== null && daysUntilDue < 0) return 'Overdue';
    if (daysUntilDue !== null && daysUntilDue <= 7) return 'Due Soon';
    if (daysUntilDue !== null && daysUntilDue <= 14) return 'Payment Due';
    return 'Good Standing';
  };

  if (loans.length === 0) {
    return (
      <CollapsibleCard
        title='Loan Debt Overview'
        icon={Landmark}
        defaultExpanded={false}
      >
        <div className='text-center py-4'>
          <p className='text-white/70'>No loans found.</p>
        </div>
      </CollapsibleCard>
    );
  }

  return (
    <CollapsibleCard
      title='Loan Debt Overview'
      icon={Landmark}
      defaultExpanded={false}
    >
      {/* Summary Row - Always Visible */}
      <div className='mb-4 p-3 glass-card rounded-2xl border border-white/10'>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
          <div>
            <p className='text-white/70 mb-1'>Total Remaining</p>
            <PrivacyWrapper>
              <p className='text-lg font-bold text-white'>
                {formatCurrency(summary.totalDebt)}
              </p>
            </PrivacyWrapper>
          </div>
          <div>
            <p className='text-white/70 mb-1'>Original Loan Amount</p>
            <PrivacyWrapper>
              <p className='text-lg font-bold text-white'>
                {formatCurrency(summary.totalOriginalPrincipal)}
              </p>
            </PrivacyWrapper>
          </div>
          <div>
            <p className='text-white/70 mb-1'>Paid Off So Far</p>
            <PrivacyWrapper>
              <p className='text-lg font-bold text-green-400'>
                {formatCurrency(summary.totalPaidOff)}
              </p>
            </PrivacyWrapper>
          </div>
          <div>
            <p className='text-white/70 mb-1'>Loans</p>
            <p className='text-lg font-bold text-white'>{summary.loanCount}</p>
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
                  Loan Name
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
                onClick={() => handleSort('originalLoanAmount')}
              >
                <div className='flex items-center justify-end'>
                  Original Loan Amount
                  {renderSortIndicator('originalLoanAmount')}
                </div>
              </th>
              <th
                className='text-center py-2 px-3 text-sm font-medium text-white/70 cursor-pointer hover:bg-white/5 transition-colors select-none'
                onClick={() => handleSort('targetPayoffDate')}
              >
                <div className='flex items-center justify-center'>
                  Target Payoff
                  {renderSortIndicator('targetPayoffDate')}
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
            {sortedLoans.map(loan => {
              const balanceInfo = formatLoanBalance(loan.balance || 0);
              const status = getLoanStatus(loan);

              return (
                <tr
                  key={loan.id}
                  className='border-b border-white/5 hover:bg-white/5 transition-colors'
                >
                  <td className='py-3 px-3'>
                    <p className='text-white font-medium'>{loan.name}</p>
                    {loan.lender && (
                      <p className='text-xs text-white/50'>{loan.lender}</p>
                    )}
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
                      {loan.originalLoanAmount
                        ? formatCurrency(loan.originalLoanAmount)
                        : 'N/A'}
                    </PrivacyWrapper>
                  </td>
                  <td className='py-3 px-3 text-center text-white/70'>
                    {formatDate(loan.targetPayoffDate)}
                  </td>
                  <td className='py-3 px-3 text-right text-white/70'>
                    {loan.interestRate !== null &&
                    loan.interestRate !== undefined
                      ? `${(loan.interestRate || 0).toFixed(2)}%`
                      : 'N/A'}
                  </td>
                  <td className='py-3 px-3 text-center text-white/70'>
                    {formatDate(loan.dueDate)}
                  </td>
                  <td className='py-3 px-3 text-center'>
                    <StatusBadge status={status} variant='loan' />
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
                  {formatCurrency(summary.totalOriginalPrincipal)}
                </PrivacyWrapper>
              </td>
              <td className='py-3 px-3 text-center text-white/70'>—</td>
              <td className='py-3 px-3 text-right text-white/70'>—</td>
              <td className='py-3 px-3 text-center text-white/70'>—</td>
              <td className='py-3 px-3 text-center'>
                <span className='text-white/70'>
                  {summary.loanCount} loan{summary.loanCount !== 1 ? 's' : ''}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </CollapsibleCard>
  );
};

LoanDebtTable.propTypes = {
  loans: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      name: PropTypes.string,
      lender: PropTypes.string,
      balance: PropTypes.number,
      originalLoanAmount: PropTypes.number,
      interestRate: PropTypes.number,
      dueDate: PropTypes.string,
      targetPayoffDate: PropTypes.string,
    }),
  ),
};

LoanDebtTable.defaultProps = {
  loans: [],
};

export default LoanDebtTable;
