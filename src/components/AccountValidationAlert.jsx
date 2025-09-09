import { AlertTriangle, ExternalLink } from 'lucide-react';
import React from 'react';

const AccountValidationAlert = ({
  invalidExpenses = [],
  onNavigateToSettings,
  onFixAccount,
}) => {
  if (invalidExpenses.length === 0) return null;

  return (
    <div className='glass-panel bg-orange-500/10 border-orange-500/30 mb-6'>
      <div className='flex items-start space-x-3 p-4'>
        <AlertTriangle className='w-6 h-6 text-orange-400 mt-0.5 flex-shrink-0' />
        <div className='flex-1'>
          <h3 className='text-lg font-semibold text-orange-400 mb-2'>
            Account Validation Issues
          </h3>
          <p className='text-white/70 mb-4'>
            Some fixed expenses are mapped to accounts that no longer exist.
            This may cause payment processing issues.
          </p>

          <div className='space-y-2 mb-4'>
            {invalidExpenses.map(expense => (
              <div
                key={expense.id}
                className='bg-orange-500/10 border border-orange-500/20 rounded-lg p-3'
              >
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='font-medium text-white'>{expense.name}</p>
                    <p className='text-sm text-orange-300'>
                      Invalid Account ID: {expense.accountId}
                    </p>
                  </div>
                  <button
                    onClick={() => onFixAccount(expense)}
                    className='px-3 py-1.5 text-xs bg-orange-500/20 text-orange-300
                             rounded-md hover:bg-orange-500/30 transition-colors'
                  >
                    Fix Account
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className='flex space-x-3'>
            <button
              onClick={onNavigateToSettings}
              className='flex items-center space-x-2 px-4 py-2 bg-orange-500/20
                       text-orange-300 rounded-lg hover:bg-orange-500/30 transition-colors'
            >
              <ExternalLink className='w-4 h-4' />
              <span>Manage Accounts</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountValidationAlert;
