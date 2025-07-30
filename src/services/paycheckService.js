export class PaycheckService {
  constructor(paycheckSettings) {
    this.settings = paycheckSettings;
  }

  // Calculate next paycheck dates based on last paycheck date and frequency
  calculatePaycheckDates() {
    if (!this.settings?.lastPaycheckDate) {
      return {
        nextPayDate: null,
        followingPayDate: null,
        daysUntilNextPay: null,
        daysUntilFollowingPay: null
      };
    }

    const lastPayDate = new Date(this.settings.lastPaycheckDate);
    const today = new Date();
    
    // Calculate next paycheck (14 days from last paycheck)
    const nextPayDate = new Date(lastPayDate);
    nextPayDate.setDate(nextPayDate.getDate() + 14);
    
    // If next paycheck is in the past, keep adding 14 days until it's in the future
    while (nextPayDate <= today) {
      nextPayDate.setDate(nextPayDate.getDate() + 14);
    }
    
    // Calculate following paycheck (28 days from last paycheck)
    const followingPayDate = new Date(lastPayDate);
    followingPayDate.setDate(followingPayDate.getDate() + 28);
    
    // If following paycheck is in the past, keep adding 14 days until it's in the future
    while (followingPayDate <= today) {
      followingPayDate.setDate(followingPayDate.getDate() + 14);
    }
    
    // Calculate days until each paycheck
    const daysUntilNextPay = Math.ceil((nextPayDate - today) / (1000 * 60 * 60 * 24));
    const daysUntilFollowingPay = Math.ceil((followingPayDate - today) / (1000 * 60 * 60 * 24));
    
    return {
      nextPayDate: nextPayDate.toISOString().split('T')[0],
      followingPayDate: followingPayDate.toISOString().split('T')[0],
      daysUntilNextPay,
      daysUntilFollowingPay
    };
  }

  // Calculate expense status based on due date, amount, and paid amount
  calculateExpenseStatus(expense, paycheckDates) {
    const { dueDate, amount, paidAmount } = expense;
    const { nextPayDate, followingPayDate } = paycheckDates;
    const today = new Date();
    const due = new Date(dueDate);
    
    // If fully paid
    if (paidAmount >= amount) {
      return 'Paid';
    }
    
    // If partially paid
    if (paidAmount > 0 && paidAmount < amount) {
      return 'Partially Paid';
    }
    
    // If overdue
    if (due < today && paidAmount < amount) {
      return 'Overdue';
    }
    
    // If due this week (before next paycheck)
    if (due <= new Date(nextPayDate) && paidAmount === 0) {
      return 'Pay This Week';
    }
    
    // If due with next check (between next paycheck and following paycheck)
    if (due > new Date(nextPayDate) && due <= new Date(followingPayDate) && paidAmount === 0) {
      return 'Pay with Next Check';
    }
    
    // If due with following check (after following paycheck)
    if (due > new Date(followingPayDate) && paidAmount === 0) {
      return 'Pay with Following Check';
    }
    
    return 'Unknown';
  }

  // Get status color for badges
  getStatusColor(status) {
    switch (status) {
      case 'Paid':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'Partially Paid':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'Overdue':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'Pay This Week':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'Pay with Next Check':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Pay with Following Check':
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  }

  // Calculate summary totals for different payment categories
  calculateSummaryTotals(expenses, paycheckDates) {
    const totals = {
      payThisWeek: 0,
      payNextCheck: 0,
      payFollowingCheck: 0
    };

    expenses.forEach(expense => {
      const status = this.calculateExpenseStatus(expense, paycheckDates);
      const remainingAmount = expense.amount - expense.paidAmount;
      
      switch (status) {
        case 'Pay This Week':
          totals.payThisWeek += remainingAmount;
          break;
        case 'Pay with Next Check':
          totals.payNextCheck += remainingAmount;
          break;
        case 'Pay with Following Check':
          totals.payFollowingCheck += remainingAmount;
          break;
      }
    });

    return totals;
  }

  // Check if monthly reset should be prompted
  shouldPromptReset(expenses, paycheckDates) {
    if (!expenses.length) return false;
    
    const today = new Date();
    const nextPayDate = new Date(paycheckDates.nextPayDate);
    
    // Check if all expenses are paid or overdue
    const allPaidOrOverdue = expenses.every(expense => {
      const status = this.calculateExpenseStatus(expense, paycheckDates);
      return status === 'Paid' || status === 'Overdue';
    });
    
    // Check if next paycheck is in a new calendar month
    const nextPayMonth = nextPayDate.getMonth();
    const todayMonth = today.getMonth();
    const nextPayYear = nextPayDate.getFullYear();
    const todayYear = today.getFullYear();
    
    const isNewMonth = (nextPayYear > todayYear) || 
                      (nextPayYear === todayYear && nextPayMonth > todayMonth);
    
    return allPaidOrOverdue && isNewMonth;
  }
} 