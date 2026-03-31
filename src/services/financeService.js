import { useMemo } from 'react';

export const useFinanceCalculations = (
  accounts,
  pendingTransactions,
  creditCards = [],
) => {
  const calculateProjectedBalance = useMemo(() => {
    return accountId => {
      const account = accounts.find(a => a.id === accountId);
      if (!account) return 0;

      const pendingForAccount = pendingTransactions
        .filter(t => t.accountId === accountId)
        .reduce((sum, t) => sum + t.amount, 0);

      // Add pending amount to get projected balance (expenses or income)
      return account.currentBalance + pendingForAccount;
    };
  }, [accounts, pendingTransactions]);

  const calculateLiquidBalance = useMemo(() => {
    return accounts.reduce((sum, account) => sum + account.currentBalance, 0);
  }, [accounts]);

  const getAccountProjectedBalances = useMemo(() => {
    const balances = {};
    accounts.forEach(account => {
      const pendingForAccount = pendingTransactions
        .filter(t => t.accountId === account.id)
        .reduce((sum, t) => sum + t.amount, 0);
      balances[account.id] = account.currentBalance + pendingForAccount;
    });
    return balances;
  }, [accounts, pendingTransactions]);

  const getDefaultAccount = useMemo(() => {
    return accounts.find(account => account.isDefault === true) || null;
  }, [accounts]);

  const getDefaultAccountProjectedBalance = useMemo(() => {
    const defaultAccount = getDefaultAccount;
    if (!defaultAccount) return 0;

    const pendingForAccount = pendingTransactions
      .filter(t => t.accountId === defaultAccount.id)
      .reduce((sum, t) => sum + t.amount, 0);

    return defaultAccount.currentBalance + pendingForAccount;
  }, [getDefaultAccount, pendingTransactions]);

  const getAccountName = useMemo(() => {
    return accountId => {
      // First, look in regular accounts
      const account = accounts.find(a => a.id === accountId);
      if (account) {
        return account.name;
      }

      // If not found, look in credit cards
      const creditCard = creditCards.find(cc => cc.id === accountId);
      if (creditCard) {
        return creditCard.name;
      }

      return `Unknown Account (${accountId})`;
    };
  }, [accounts, creditCards]);

  return {
    calculateProjectedBalance,
    calculateLiquidBalance,
    getAccountProjectedBalances,
    getDefaultAccount,
    getDefaultAccountProjectedBalance,
    getAccountName,
  };
};
