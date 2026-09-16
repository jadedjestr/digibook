import { Plus } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';

import ChooseFundingAccountModal from '../components/ChooseFundingAccountModal';
import CreateAccountModal from '../components/CreateAccountModal';
import EmptyState from '../components/EmptyState';
import EnhancedLoanCard from '../components/EnhancedLoanCard';
import LoansEmptyIllustration from '../components/illustrations/LoansEmptyIllustration';
import LoanDeletionModal from '../components/LoanDeletionModal';
import PrivacyWrapper from '../components/PrivacyWrapper';
import { dbHelpers } from '../db/database-clean';
import { useFixedExpenses } from '../stores/useAppStore';
import { formatCurrency } from '../utils/accountUtils';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications';

const getDaysUntilDue = dueDate => {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  const diffTime = due - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const emptyFormData = {
  name: '',
  lender: '',
  balance: '',
  principalAmount: '',
  interestRate: '',
  dueDate: '',
  targetPayoffDate: '',
  fundingAccountId: '',
};

const Loans = ({ onDataChange, accounts = [] }) => {
  const [loans, setLoans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);
  const [deletionModal, setDeletionModal] = useState({
    isOpen: false,
    loan: null,
  });
  const [formData, setFormData] = useState(emptyFormData);
  const [initialFundingAccountId, setInitialFundingAccountId] = useState(null);
  const [errors, setErrors] = useState({});
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [pendingLoanData, setPendingLoanData] = useState(null);
  const [showFundingModal, setShowFundingModal] = useState(false);
  const [fundingModalLoanId, setFundingModalLoanId] = useState(null);
  const [fundingModalLoanName, setFundingModalLoanName] = useState('');
  const [defaultAccountIdForModal, setDefaultAccountIdForModal] =
    useState(null);
  const [isFundingModalLoading, setIsFundingModalLoading] = useState(false);
  const [showChangeFundingModal, setShowChangeFundingModal] = useState(false);
  const [changeFundingLoanId, setChangeFundingLoanId] = useState(null);
  const [changeFundingLoanName, setChangeFundingLoanName] = useState('');
  const [changeFundingDefaultAccountId, setChangeFundingDefaultAccountId] =
    useState(null);
  const [isChangeFundingLoading, setIsChangeFundingLoading] = useState(false);

  const fixedExpenses = useFixedExpenses();

  const fundableAccounts = useMemo(
    () => accounts.filter(a => a.type === 'checking' || a.type === 'savings'),
    [accounts],
  );

  const fundingByLoanId = useMemo(() => {
    const map = new Map();
    if (!fixedExpenses || !accounts.length) return map;
    for (const expense of fixedExpenses) {
      if (expense.category !== 'Loan Payment' || expense.targetLoanId == null) {
        continue;
      }
      const lid = expense.targetLoanId;
      if (map.has(lid)) continue;
      const accountId = expense.accountId != null ? expense.accountId : null;
      const account = accounts.find(a => a.id === accountId);
      map.set(lid, {
        fundingSourceName: account ? account.name : null,
        fundingAccountId: accountId,
      });
    }
    return map;
  }, [fixedExpenses, accounts]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const result = await dbHelpers.ensureLoanPaymentExpensesLinked();
        if (
          mounted &&
          (result.createdCount > 0 ||
            result.repairedTemplates > 0 ||
            result.repairedExpenses > 0 ||
            result.duplicatesRemoved > 0)
        ) {
          onDataChange();
          if (result.createdCount > 0) {
            notify.success(`Created ${result.createdCount} payment expense(s)`);
          }
          if (result.repairedTemplates > 0 || result.repairedExpenses > 0) {
            notify.success('Repaired funding source(s)');
          }
          if (result.duplicatesRemoved > 0) {
            notify.success(
              `Cleaned up ${result.duplicatesRemoved} duplicate payment record(s)`,
            );
          }
        }
      } catch (error) {
        logger.error('Error ensuring loan payment expenses linked:', error);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [onDataChange]);

  const loadLoans = useCallback(async () => {
    try {
      setIsLoading(true);
      const rows = await dbHelpers.getLoans();
      setLoans(rows);
    } catch (error) {
      logger.error('Error loading loans:', error);
      notify.error('Failed to load loans');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLoans();
  }, [loadLoans]);

  const handleInputChange = useCallback(
    (field, value) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: '' }));
      }
    },
    [errors],
  );

  // Live preview of the payment required to hit the target payoff date -
  // the same formula the materialization path uses, so what the user sees
  // while filling out the form matches what actually gets billed.
  const paymentPreview = useMemo(() => {
    const balance = parseFloat(formData.balance);
    const interestRate = parseFloat(formData.interestRate);
    if (
      !Number.isFinite(balance) ||
      !Number.isFinite(interestRate) ||
      !formData.dueDate ||
      !formData.targetPayoffDate
    ) {
      return null;
    }
    return dbHelpers.calculateRequiredLoanPayment(
      balance,
      interestRate,
      formData.dueDate,
      formData.targetPayoffDate,
    );
  }, [
    formData.balance,
    formData.interestRate,
    formData.dueDate,
    formData.targetPayoffDate,
  ]);

  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (formData.balance === '' || parseFloat(formData.balance) < 0) {
      newErrors.balance = 'Balance must be a positive number';
    }
    if (formData.interestRate === '' || parseFloat(formData.interestRate) < 0) {
      newErrors.interestRate = 'Interest rate must be a positive number';
    }
    if (
      formData.principalAmount !== '' &&
      parseFloat(formData.principalAmount) < 0
    ) {
      newErrors.principalAmount =
        'Original principal must be a positive number';
    }
    if (!formData.dueDate) {
      newErrors.dueDate = 'Due date is required';
    }
    if (!formData.targetPayoffDate) {
      newErrors.targetPayoffDate = 'Target payoff date is required';
    } else if (paymentPreview && !paymentPreview.success) {
      newErrors.targetPayoffDate = paymentPreview.message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, paymentPreview]);

  const closeAddModalAndReset = useCallback(() => {
    setIsAddModalOpen(false);
    setEditingLoan(null);
    setFormData(emptyFormData);
    setInitialFundingAccountId(null);
    setErrors({});
  }, []);

  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      notify.error('Please fix the errors before saving');
      return;
    }

    try {
      const loanData = {
        name: formData.name,
        lender: formData.lender || '',
        balance: parseFloat(formData.balance),
        principalAmount:
          formData.principalAmount !== ''
            ? parseFloat(formData.principalAmount)
            : null,
        interestRate: parseFloat(formData.interestRate),
        dueDate: formData.dueDate,
        targetPayoffDate: formData.targetPayoffDate,
      };

      if (editingLoan) {
        await dbHelpers.updateLoan(
          editingLoan.id,
          loanData,
          editingLoan.updatedAt,
        );
        if (
          formData.fundingAccountId !== '' &&
          formData.fundingAccountId !== initialFundingAccountId
        ) {
          await dbHelpers.updateFundingAccountForLoan(
            editingLoan.id,
            formData.fundingAccountId,
          );
        }
        notify.success('Loan updated successfully');
        closeAddModalAndReset();
        loadLoans();
        onDataChange();
        return;
      }

      if (accounts.length === 0) {
        setPendingLoanData(loanData);
        setIsAccountModalOpen(true);
        return;
      }

      const newId = await dbHelpers.addLoan(loanData);
      notify.success('Loan added successfully');

      if (fundableAccounts.length === 1) {
        await dbHelpers.createExpenseForLoan(newId, fundableAccounts[0].id);
        notify.success('Created payment expense');
        closeAddModalAndReset();
        loadLoans();
        onDataChange();
        return;
      }

      const defaultAcct = await dbHelpers.getDefaultAccount();
      setDefaultAccountIdForModal(
        defaultAcct?.id ??
          fundableAccounts.find(a => a.type === 'checking')?.id ??
          fundableAccounts[0]?.id ??
          null,
      );
      setFundingModalLoanId(newId);
      setFundingModalLoanName(loanData.name);
      setShowFundingModal(true);
      closeAddModalAndReset();
      loadLoans();
      onDataChange();
    } catch (error) {
      logger.error('Error saving loan:', error);
      if (error.message?.startsWith('STALE_WRITE')) {
        notify.error(
          'This loan was changed elsewhere. Please close and reopen the edit form.',
        );
      } else {
        notify.error('Failed to save loan');
      }
    }
  }, [
    validateForm,
    formData,
    editingLoan,
    accounts.length,
    fundableAccounts,
    initialFundingAccountId,
    closeAddModalAndReset,
    loadLoans,
    onDataChange,
  ]);

  const handleFundingConfirm = useCallback(
    async accountId => {
      if (fundingModalLoanId == null) return;
      setIsFundingModalLoading(true);
      try {
        await dbHelpers.createExpenseForLoan(fundingModalLoanId, accountId);
        notify.success('Created payment expense');
        setShowFundingModal(false);
        setFundingModalLoanId(null);
        setFundingModalLoanName('');
        setDefaultAccountIdForModal(null);
        onDataChange();
      } catch (error) {
        logger.error('Error creating payment expense:', error);
        notify.error('Failed to create payment expense');
      } finally {
        setIsFundingModalLoading(false);
      }
    },
    [fundingModalLoanId, onDataChange],
  );

  const handleFundingUseDefault = useCallback(async () => {
    if (defaultAccountIdForModal != null) {
      await handleFundingConfirm(defaultAccountIdForModal);
    }
  }, [defaultAccountIdForModal, handleFundingConfirm]);

  const handleFundingCancel = useCallback(() => {
    setShowFundingModal(false);
    setFundingModalLoanId(null);
    setFundingModalLoanName('');
    setDefaultAccountIdForModal(null);
  }, []);

  const handleChangeFundingClick = useCallback(
    loan => {
      const info = fundingByLoanId.get(loan.id);
      setChangeFundingLoanId(loan.id);
      setChangeFundingLoanName(loan.name);
      setChangeFundingDefaultAccountId(info?.fundingAccountId ?? null);
      setShowChangeFundingModal(true);
    },
    [fundingByLoanId],
  );

  const handleChangeFundingConfirm = useCallback(
    async accountId => {
      if (changeFundingLoanId == null) return;
      setIsChangeFundingLoading(true);
      try {
        await dbHelpers.updateFundingAccountForLoan(
          changeFundingLoanId,
          accountId,
        );
        notify.success('Funding source updated');
        onDataChange();
        setShowChangeFundingModal(false);
        setChangeFundingLoanId(null);
        setChangeFundingLoanName('');
        setChangeFundingDefaultAccountId(null);
      } catch (error) {
        logger.error('Error updating funding source:', error);
        notify.error('Failed to update funding source');
      } finally {
        setIsChangeFundingLoading(false);
      }
    },
    [changeFundingLoanId, onDataChange],
  );

  const handleChangeFundingCancel = useCallback(() => {
    setShowChangeFundingModal(false);
    setChangeFundingLoanId(null);
    setChangeFundingLoanName('');
    setChangeFundingDefaultAccountId(null);
  }, []);

  const handleAccountCreated = useCallback(async () => {
    setIsAccountModalOpen(false);
    await onDataChange();

    if (pendingLoanData) {
      try {
        const newId = await dbHelpers.addLoan(pendingLoanData);
        notify.success('Loan added successfully');

        const fundable = await dbHelpers.getFundableAccounts();
        if (fundable.length === 1) {
          await dbHelpers.createExpenseForLoan(newId, fundable[0].id);
          notify.success('Created payment expense');
        } else if (fundable.length >= 2) {
          const defaultAcct = await dbHelpers.getDefaultAccount();
          setDefaultAccountIdForModal(
            defaultAcct?.id ??
              fundable.find(a => a.type === 'checking')?.id ??
              fundable[0]?.id ??
              null,
          );
          setFundingModalLoanId(newId);
          setFundingModalLoanName(pendingLoanData.name);
          setShowFundingModal(true);
        }

        closeAddModalAndReset();
        loadLoans();
        onDataChange();
      } catch (error) {
        logger.error('Error saving pending loan:', error);
        notify.error('Failed to save loan');
      } finally {
        setPendingLoanData(null);
      }
    }
  }, [pendingLoanData, closeAddModalAndReset, loadLoans, onDataChange]);

  const resetAddEditModal = useCallback(() => {
    closeAddModalAndReset();
  }, [closeAddModalAndReset]);

  const handleEdit = useCallback(async loan => {
    setEditingLoan(loan);
    const fundingAccountId = await dbHelpers.getFundingAccountIdForLoan(
      loan.id,
    );
    setFormData({
      name: loan.name,
      lender: loan.lender || '',
      balance: loan.balance.toString(),
      principalAmount:
        loan.principalAmount != null ? loan.principalAmount.toString() : '',
      interestRate: loan.interestRate.toString(),
      dueDate: loan.dueDate,
      targetPayoffDate: loan.targetPayoffDate,
      fundingAccountId:
        fundingAccountId != null ? String(fundingAccountId) : '',
    });
    setInitialFundingAccountId(fundingAccountId ?? null);
    setIsAddModalOpen(true);
  }, []);

  const handleDelete = useCallback(async loan => {
    setDeletionModal({ isOpen: true, loan });
  }, []);

  const handleDeleteConfirmed = useCallback(
    deletedLoanId => {
      setLoans(prev => prev.filter(loan => loan.id !== deletedLoanId));
      setDeletionModal({ isOpen: false, loan: null });
      onDataChange();
    },
    [onDataChange],
  );

  const handleDeleteModalClose = useCallback(() => {
    setDeletionModal({ isOpen: false, loan: null });
  }, []);

  const sortedLoans = useMemo(() => {
    if (!loans.length) return [];
    return [...loans]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(loan => ({
        ...loan,
        daysUntilDue: getDaysUntilDue(loan.dueDate),
      }));
  }, [loans]);

  const summary = useMemo(() => {
    const totalDebt = loans.reduce(
      (sum, loan) => sum + Math.max(loan.balance || 0, 0),
      0,
    );
    const totalOriginalPrincipal = loans.reduce(
      (sum, loan) => sum + (loan.principalAmount || 0),
      0,
    );
    const totalPaidOff = Math.max(0, totalOriginalPrincipal - totalDebt);
    return { totalDebt, totalOriginalPrincipal, totalPaidOff };
  }, [loans]);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-white'>Loading loans...</div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex justify-between items-center mb-6 pl-14 lg:pl-0'>
        <h1 className='text-3xl font-semibold text-white text-shadow'>Loans</h1>
        <div className='flex items-center space-x-3'>
          {loans.length > 0 && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className='glass-button glass-button--primary flex items-center space-x-2'
            >
              <Plus size={16} />
              <span>Add Loan</span>
            </button>
          )}
        </div>
      </div>

      {/* Total Debt Summary Card */}
      {loans.length > 0 && (
        <div className='glass-card rounded-2xl p-6 border border-white/10 mb-6'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
            <div>
              <p className='text-white/70 text-sm mb-2'>Total Remaining</p>
              <PrivacyWrapper>
                <p className='text-2xl font-bold text-white'>
                  {formatCurrency(summary.totalDebt)}
                </p>
              </PrivacyWrapper>
            </div>
            <div>
              <p className='text-white/70 text-sm mb-2'>Original Principal</p>
              <PrivacyWrapper>
                <p className='text-2xl font-bold text-white'>
                  {formatCurrency(summary.totalOriginalPrincipal)}
                </p>
              </PrivacyWrapper>
            </div>
            <div>
              <p className='text-white/70 text-sm mb-2'>Paid Off So Far</p>
              <PrivacyWrapper>
                <p className='text-2xl font-bold text-green-400'>
                  {formatCurrency(summary.totalPaidOff)}
                </p>
              </PrivacyWrapper>
            </div>
          </div>
        </div>
      )}

      {/* Loans Grid */}
      {loans.length === 0 ? (
        <EmptyState
          illustration={<LoansEmptyIllustration />}
          title='No loans yet'
          subtitle='Add a loan to track its balance and payoff progress'
          action={{
            label: 'Add Loan',
            onClick: () => setIsAddModalOpen(true),
          }}
        />
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {sortedLoans.map((loan, index) => {
            const funding = fundingByLoanId.get(loan.id);
            return (
              <EnhancedLoanCard
                key={loan.id}
                loan={loan}
                fundingSourceName={funding?.fundingSourceName ?? null}
                onChangeFundingSource={
                  fundableAccounts.length > 0
                    ? () => handleChangeFundingClick(loan)
                    : undefined
                }
                onEdit={handleEdit}
                onDelete={handleDelete}
                index={index}
              />
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isAddModalOpen &&
        createPortal(
          <div
            className='fixed bg-black/60 flex items-start justify-center z-50 overflow-y-auto py-8'
            style={{
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
            }}
            role='button'
            tabIndex={0}
            aria-label='Close loan modal'
            onClick={e => {
              if (e.target === e.currentTarget) {
                resetAddEditModal();
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                resetAddEditModal();
              }
            }}
          >
            <div className='glass-panel rounded-2xl p-8 w-full max-w-md space-y-6 my-auto modal-panel-enter'>
              <h2 className='text-xl font-semibold text-white'>
                {editingLoan ? 'Edit Loan' : 'Add Loan'}
              </h2>

              <div className='space-y-4'>
                <div>
                  <label
                    htmlFor='loan-name'
                    className='block text-sm font-medium text-white mb-2'
                  >
                    Name
                  </label>
                  <input
                    id='loan-name'
                    type='text'
                    value={formData.name}
                    onChange={e => handleInputChange('name', e.target.value)}
                    className='w-full px-4 py-3 glass-input rounded-xl text-white'
                    placeholder='e.g. Car Loan'
                  />
                  {errors.name && (
                    <p className='text-red-400 text-sm mt-1'>{errors.name}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor='loan-lender'
                    className='block text-sm font-medium text-white mb-2'
                  >
                    Lender (Optional)
                  </label>
                  <input
                    id='loan-lender'
                    type='text'
                    value={formData.lender}
                    onChange={e => handleInputChange('lender', e.target.value)}
                    className='w-full px-4 py-3 glass-input rounded-xl text-white'
                    placeholder='e.g. Toyota Financial'
                  />
                </div>

                <div>
                  <label
                    htmlFor='loan-balance'
                    className='block text-sm font-medium text-white mb-2'
                  >
                    Current Balance
                  </label>
                  <input
                    id='loan-balance'
                    type='number'
                    inputMode='decimal'
                    step='0.01'
                    value={formData.balance}
                    onChange={e => handleInputChange('balance', e.target.value)}
                    className='w-full px-4 py-3 glass-input rounded-xl text-white'
                    placeholder='0.00'
                  />
                  {errors.balance && (
                    <p className='text-red-400 text-sm mt-1'>
                      {errors.balance}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor='loan-principal'
                    className='block text-sm font-medium text-white mb-2'
                  >
                    Original Principal (Optional)
                  </label>
                  <input
                    id='loan-principal'
                    type='number'
                    inputMode='decimal'
                    step='0.01'
                    value={formData.principalAmount}
                    onChange={e =>
                      handleInputChange('principalAmount', e.target.value)
                    }
                    className='w-full px-4 py-3 glass-input rounded-xl text-white'
                    placeholder='0.00'
                  />
                  <p className='text-white/50 text-xs mt-1'>
                    Used to show payoff progress. Defaults to the current
                    balance if left blank.
                  </p>
                  {errors.principalAmount && (
                    <p className='text-red-400 text-sm mt-1'>
                      {errors.principalAmount}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor='loan-interest-rate'
                    className='block text-sm font-medium text-white mb-2'
                  >
                    Interest Rate (%)
                  </label>
                  <input
                    id='loan-interest-rate'
                    type='number'
                    inputMode='decimal'
                    step='0.01'
                    value={formData.interestRate}
                    onChange={e =>
                      handleInputChange('interestRate', e.target.value)
                    }
                    className='w-full px-4 py-3 glass-input rounded-xl text-white'
                    placeholder='0.00'
                  />
                  {errors.interestRate && (
                    <p className='text-red-400 text-sm mt-1'>
                      {errors.interestRate}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor='loan-due-date'
                    className='block text-sm font-medium text-white mb-2'
                  >
                    Due Date
                  </label>
                  <div style={{ overflow: 'hidden', width: '100%' }}>
                    <input
                      id='loan-due-date'
                      type='date'
                      value={formData.dueDate}
                      onChange={e =>
                        handleInputChange('dueDate', e.target.value)
                      }
                      className='w-full px-4 py-3 glass-input rounded-xl text-white'
                    />
                  </div>
                  {errors.dueDate && (
                    <p className='text-red-400 text-sm mt-1'>
                      {errors.dueDate}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor='loan-target-payoff-date'
                    className='block text-sm font-medium text-white mb-2'
                  >
                    Target Payoff Date
                  </label>
                  <div style={{ overflow: 'hidden', width: '100%' }}>
                    <input
                      id='loan-target-payoff-date'
                      type='date'
                      value={formData.targetPayoffDate}
                      onChange={e =>
                        handleInputChange('targetPayoffDate', e.target.value)
                      }
                      className='w-full px-4 py-3 glass-input rounded-xl text-white'
                    />
                  </div>
                  <p className='text-white/50 text-xs mt-1'>
                    The monthly payment is calculated automatically to pay off
                    the balance by this date.
                  </p>
                  {errors.targetPayoffDate ? (
                    <p className='text-red-400 text-sm mt-1'>
                      {errors.targetPayoffDate}
                    </p>
                  ) : (
                    paymentPreview?.success && (
                      <p className='text-green-400 text-sm mt-1'>
                        Calculated payment:{' '}
                        {formatCurrency(paymentPreview.payment)}
                        /month
                      </p>
                    )
                  )}
                </div>

                {editingLoan && (
                  <div>
                    <label
                      htmlFor='loan-funding-account'
                      className='block text-sm font-medium text-white mb-2'
                    >
                      Funding account
                    </label>
                    <select
                      id='loan-funding-account'
                      value={formData.fundingAccountId}
                      onChange={e =>
                        handleInputChange('fundingAccountId', e.target.value)
                      }
                      className='w-full px-4 py-3 glass-input rounded-xl text-white'
                    >
                      <option value=''>
                        {fundableAccounts.length === 0
                          ? 'No checking/savings accounts'
                          : 'Select account'}
                      </option>
                      {fundableAccounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} — {acc.type}
                        </option>
                      ))}
                    </select>
                    <p className='text-white/50 text-xs mt-1'>
                      Account used to pay this loan (synced with Fixed Expenses)
                    </p>
                  </div>
                )}
              </div>

              <div className='flex space-x-3'>
                <button
                  onClick={handleSave}
                  className='flex-1 px-4 py-3 glass-button glass-button--primary'
                >
                  {editingLoan ? 'Update' : 'Add'} Loan
                </button>
                <button
                  onClick={() => {
                    resetAddEditModal();
                  }}
                  className='flex-1 px-4 py-3 glass-button glass-button--secondary'
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Loan Deletion Modal */}
      <LoanDeletionModal
        isOpen={deletionModal.isOpen}
        loan={deletionModal.loan}
        onClose={handleDeleteModalClose}
        onDelete={handleDeleteConfirmed}
      />

      {/* Inline Account Creation Modal */}
      <CreateAccountModal
        isOpen={isAccountModalOpen}
        onClose={() => {
          setIsAccountModalOpen(false);
          setPendingLoanData(null);
        }}
        onAccountCreated={handleAccountCreated}
        description='To track loan payments, a checking or savings account is needed as the funding source. Create one now to continue.'
      />

      {/* Choose funding account for new loan (2+ accounts) */}
      <ChooseFundingAccountModal
        isOpen={showFundingModal}
        cardName={fundingModalLoanName}
        cardId={fundingModalLoanId ?? 0}
        accounts={fundableAccounts}
        defaultAccountId={defaultAccountIdForModal}
        onConfirm={handleFundingConfirm}
        onUseDefault={handleFundingUseDefault}
        onCancel={handleFundingCancel}
        isLoading={isFundingModalLoading}
      />

      <ChooseFundingAccountModal
        isOpen={showChangeFundingModal}
        cardName={changeFundingLoanName}
        cardId={changeFundingLoanId ?? 0}
        accounts={fundableAccounts}
        defaultAccountId={changeFundingDefaultAccountId}
        onConfirm={handleChangeFundingConfirm}
        onUseDefault={() => {}}
        onCancel={handleChangeFundingCancel}
        isLoading={isChangeFundingLoading}
      />
    </div>
  );
};

Loans.propTypes = {
  onDataChange: PropTypes.func.isRequired,
  accounts: PropTypes.arrayOf(PropTypes.object),
};

Loans.defaultProps = {
  accounts: [],
};

export default Loans;
