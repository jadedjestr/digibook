import PropTypes from 'prop-types';

import { formatCurrency } from '../../utils/accountUtils';

/**
 * Summary-only card for the Fixed Expenses left panel.
 * Displays count, Total/Paid/Remaining, and category breakdown.
 * No Add Expense, sort, or filter. Category rows call onCategoryClick (required).
 */
const FixedExpensesSummaryCard = ({
  totals,
  categoryRows,
  onCategoryClick,
}) => {
  const {
    totalExpenses = 0,
    totalAmount = 0,
    totalPaid = 0,
    totalRemaining = 0,
  } = totals || {};

  return (
    <div className='glass-panel p-4'>
      <h3 className='text-lg font-semibold text-white mb-2'>Fixed Expenses</h3>
      <div className='flex flex-wrap gap-3 text-sm text-white/70 mb-4'>
        <span>{totalExpenses} expenses</span>
        <span>Total: {formatCurrency(totalAmount)}</span>
        <span>Paid: {formatCurrency(totalPaid)}</span>
        <span className='text-yellow-300'>
          Remaining: {formatCurrency(totalRemaining)}
        </span>
      </div>

      {categoryRows && categoryRows.length > 0 ? (
        <>
          <h4 className='text-sm font-medium text-white/80 mb-2'>
            Category breakdown
          </h4>
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[200px] text-left'>
              <thead>
                <tr className='border-b border-white/10 text-xs text-white/60 uppercase tracking-wide'>
                  <th className='pb-2 pr-3 font-medium'>Category</th>
                  <th className='pb-2 pr-3 font-medium text-right'>Count</th>
                  <th className='pb-2 font-medium text-right'>Amount</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map(({ name, count, totalBudgeted }) => (
                  <tr
                    key={name}
                    role='button'
                    tabIndex={0}
                    onClick={() => onCategoryClick(name)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onCategoryClick(name);
                      }
                    }}
                    className='border-b border-white/5 text-sm cursor-pointer hover:bg-white/5 focus:outline-none focus:bg-white/5'
                  >
                    <td className='py-2 pr-3 text-white'>
                      {name === 'Uncategorized' ? 'Uncategorized' : name}
                    </td>
                    <td className='py-2 pr-3 text-right text-white/80'>
                      {count}
                    </td>
                    <td className='py-2 text-right text-white/80'>
                      {formatCurrency(totalBudgeted)}
                    </td>
                  </tr>
                ))}
                <tr className='border-t border-white/10 text-sm font-medium text-white/80'>
                  <td className='pt-2 pr-3'>Total</td>
                  <td className='pt-2 pr-3 text-right'>{totalExpenses}</td>
                  <td className='pt-2 text-right'>
                    {formatCurrency(totalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className='text-sm text-white/60'>No expenses</p>
      )}
    </div>
  );
};

FixedExpensesSummaryCard.propTypes = {
  totals: PropTypes.shape({
    totalExpenses: PropTypes.number,
    totalAmount: PropTypes.number,
    totalPaid: PropTypes.number,
    totalRemaining: PropTypes.number,
  }).isRequired,
  categoryRows: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      count: PropTypes.number.isRequired,
      totalBudgeted: PropTypes.number.isRequired,
    }),
  ).isRequired,
  onCategoryClick: PropTypes.func.isRequired,
};

export default FixedExpensesSummaryCard;
