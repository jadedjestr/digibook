import { Plus, CreditCard } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';

import ChooseFundingAccountModal from '../components/ChooseFundingAccountModal';
import CreateAccountModal from '../components/CreateAccountModal';
import CreditCardDeletionModal from '../components/CreditCardDeletionModal';
import CreditCardMigrationModal from '../components/CreditCardMigrationModal';
import EnhancedCreditCard from '../components/EnhancedCreditCard';
import MissingExpensesModal from '../components/MissingExpensesModal';
import PrivacyWrapper from '../components/PrivacyWrapper';
import { dbHelpers } from '../db/database-clean';
import { formatCurrency } from '../utils/accountUtils';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications';

const calculateUtilization = (balance, limit) => {
  if (!limit || limit === 0) return 0;
  return (balance / limit) * 100;
};

const getDaysUntilDue = dueDate => {
  if (!dueDate) return null;

  // Create dates in local timezone to avoid timezone shifts
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset to start of day

  // Parse the due date as a local date (not UTC)
  const due = new Date(`${dueDate}T00:00:00`);

  const diffTime = due - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const getUtilizationColor = utilization => {
  if (utilization >= 90) return 'text-red-400';
  if (utilization >= 70) return 'text-orange-400';
  if (utilization >= 50) return 'text-yellow-400';
  return 'text-green-400';
};

const CreditCards = ({
  onDataChange,
  accounts = [],
  creditCards: _creditCardsProp = [],
}) => {
  const [creditCards, setCreditCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [deletionModal, setDeletionModal] = useState({
    isOpen: false,
    card: null,
  });
  const [migrationModal, setMigrationModal] = useState({ isOpen: false });
  const [formData, setFormData] = useState({
    name: '',
    balance: '',
    creditLimit: '',
    interestRate: '',
    dueDate: '',
    statementClosingDate: '',
    minimumPayment: '',
    fundingAccountId: '',
  });
  const [initialFundingAccountId, setInitialFundingAccountId] = useState(null);
  const [errors, setErrors] = useState({});
  const [sortBy, setSortBy] = useState('name');
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [pendingCardData, setPendingCardData] = useState(null);
  const [isMissingExpensesModalOpen, setIsMissingExpensesModalOpen] =
    useState(false);
  const [orphanedCards, setOrphanedCards] = useState([]);
  const [showFundingModal, setShowFundingModal] = useState(false);
  const [fundingModalCardId, setFundingModalCardId] = useState(null);
  const [fundingModalCardName, setFundingModalCardName] = useState('');
  const [defaultAccountIdForModal, setDefaultAccountIdForModal] =
    useState(null);
  const [isFundingModalLoading, setIsFundingModalLoading] = useState(false);

  const fundableAccounts = useMemo(
    () => accounts.filter(a => a.type === 'checking' || a.type === 'savings'),
    [accounts],
  );

  const loadCreditCards = useCallback(async () => {
    try {
      setIsLoading(true);
      const cards = await dbHelpers.getCreditCards();
      setCreditCards(cards);
    } catch (error) {
      logger.error('Error loading credit cards:', error);
      notify.error('Failed to load credit cards');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCreditCards();
  }, [loadCreditCards]);

  const handleInputChange = useCallback(
    (field, value) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors(prev => ({ ...prev, [field]: '' }));
      }
    },
    [errors],
  );

  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.balance || parseFloat(formData.balance) < 0) {
      newErrors.balance = 'Balance must be a positive number';
    }

    if (!formData.creditLimit || parseFloat(formData.creditLimit) <= 0) {
      newErrors.creditLimit = 'Credit limit must be greater than 0';
    }

    if (!formData.interestRate || parseFloat(formData.interestRate) < 0) {
      newErrors.interestRate = 'Interest rate must be a positive number';
    }

    if (!formData.dueDate) {
      newErrors.dueDate = 'Due date is required';
    }

    if (!formData.minimumPayment || parseFloat(formData.minimumPayment) < 0) {
      newErrors.minimumPayment = 'Minimum payment must be a positive number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const closeAddModalAndReset = useCallback(() => {
    setIsAddModalOpen(false);
    setEditingCard(null);
    setFormData({
      name: '',
      balance: '',
      creditLimit: '',
      interestRate: '',
      dueDate: '',
      statementClosingDate: '',
      minimumPayment: '',
      fundingAccountId: '',
    });
    setInitialFundingAccountId(null);
    setErrors({});
  }, []);

  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      notify.error('Please fix the errors before saving');
      return;
    }

    try {
      const cardData = {
        name: formData.name,
        balance: parseFloat(formData.balance),
        creditLimit: parseFloat(formData.creditLimit),
        interestRate: parseFloat(formData.interestRate),
        dueDate: formData.dueDate,
        statementClosingDate: formData.statementClosingDate || '',
        minimumPayment: parseFloat(formData.minimumPayment),
      };

      if (editingCard) {
        await dbHelpers.updateCreditCard(editingCard.id, cardData);
        if (
          formData.fundingAccountId !== '' &&
          Number(formData.fundingAccountId) !== Number(initialFundingAccountId)
        ) {
          await dbHelpers.updateFundingAccountForCard(
            editingCard.id,
            Number(formData.fundingAccountId),
          );
        }
        notify.success('Credit card updated successfully');
        closeAddModalAndReset();
        loadCreditCards();
        onDataChange();
        return;
      }

      if (accounts.length === 0) {
        setPendingCardData(cardData);
        setIsAccountModalOpen(true);
        return;
      }

      const newId = await dbHelpers.addCreditCard(cardData);
      notify.success('Credit card added successfully');

      if (fundableAccounts.length === 1) {
        await dbHelpers.createExpenseForCard(newId, fundableAccounts[0].id);
        notify.success('Created minimum payment expense');
        closeAddModalAndReset();
        loadCreditCards();
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
      setFundingModalCardId(newId);
      setFundingModalCardName(cardData.name);
      setShowFundingModal(true);
      closeAddModalAndReset();
      loadCreditCards();
      onDataChange();
    } catch (error) {
      logger.error('Error saving credit card:', error);
      notify.error('Failed to save credit card');
    }
  }, [
    validateForm,
    formData,
    editingCard,
    accounts.length,
    fundableAccounts,
    closeAddModalAndReset,
    loadCreditCards,
    onDataChange,
  ]);

  const handleFundingConfirm = useCallback(
    async accountId => {
      if (fundingModalCardId == null) return;
      setIsFundingModalLoading(true);
      try {
        await dbHelpers.createExpenseForCard(fundingModalCardId, accountId);
        notify.success('Created minimum payment expense');
        setShowFundingModal(false);
        setFundingModalCardId(null);
        setFundingModalCardName('');
        setDefaultAccountIdForModal(null);
        onDataChange();
      } catch (error) {
        logger.error('Error creating payment expense:', error);
        notify.error('Failed to create payment expense');
      } finally {
        setIsFundingModalLoading(false);
      }
    },
    [fundingModalCardId, onDataChange],
  );

  const handleFundingUseDefault = useCallback(async () => {
    if (defaultAccountIdForModal != null) {
      await handleFundingConfirm(defaultAccountIdForModal);
    }
  }, [defaultAccountIdForModal, handleFundingConfirm]);

  const handleFundingCancel = useCallback(() => {
    setShowFundingModal(false);
    setFundingModalCardId(null);
    setFundingModalCardName('');
    setDefaultAccountIdForModal(null);
  }, []);

  const handleAccountCreated = useCallback(async () => {
    setIsAccountModalOpen(false);
    await onDataChange();

    if (pendingCardData) {
      try {
        const newId = await dbHelpers.addCreditCard(pendingCardData);
        notify.success('Credit card added successfully');

        const fundable = await dbHelpers.getFundableAccounts();
        if (fundable.length === 1) {
          await dbHelpers.createExpenseForCard(newId, fundable[0].id);
          notify.success('Created minimum payment expense');
        } else if (fundable.length >= 2) {
          const defaultAcct = await dbHelpers.getDefaultAccount();
          setDefaultAccountIdForModal(
            defaultAcct?.id ??
              fundable.find(a => a.type === 'checking')?.id ??
              fundable[0]?.id ??
              null,
          );
          setFundingModalCardId(newId);
          setFundingModalCardName(pendingCardData.name);
          setShowFundingModal(true);
        }

        closeAddModalAndReset();
        loadCreditCards();
        onDataChange();

        const orphans = await dbHelpers.getOrphanedCreditCards();
        if (orphans.length > 0) {
          setOrphanedCards(orphans);
          setIsMissingExpensesModalOpen(true);
        }
      } catch (error) {
        logger.error('Error saving pending credit card:', error);
        notify.error('Failed to save credit card');
      } finally {
        setPendingCardData(null);
      }
    }
  }, [pendingCardData, closeAddModalAndReset, loadCreditCards, onDataChange]);

  const handleRetroConfirm = useCallback(async () => {
    try {
      const count = await dbHelpers.createMissingCreditCardExpenses();
      if (count > 0) {
        notify.success(`Created ${count} missing payment expense(s)`);
      }
      onDataChange();
    } catch (error) {
      logger.error('Error creating missing expenses:', error);
      notify.error('Failed to create missing expenses');
    } finally {
      setIsMissingExpensesModalOpen(false);
      setOrphanedCards([]);
    }
  }, [onDataChange]);

  const handleRetroSkip = useCallback(() => {
    setIsMissingExpensesModalOpen(false);
    setOrphanedCards([]);
  }, []);

  const resetAddEditModal = useCallback(() => {
    setIsAddModalOpen(false);
    setEditingCard(null);
    setFormData({
      name: '',
      balance: '',
      creditLimit: '',
      interestRate: '',
      dueDate: '',
      statementClosingDate: '',
      minimumPayment: '',
    });
    setErrors({});
  }, []);

  const handleEdit = useCallback(async card => {
    setEditingCard(card);
    const fundingAccountId = await dbHelpers.getFundingAccountIdForCard(
      card.id,
    );
    setFormData({
      name: card.name,
      balance: card.balance.toString(),
      creditLimit: card.creditLimit.toString(),
      interestRate: card.interestRate.toString(),
      dueDate: card.dueDate,
      statementClosingDate: card.statementClosingDate || '',
      minimumPayment: card.minimumPayment.toString(),
      fundingAccountId:
        fundingAccountId != null ? String(fundingAccountId) : '',
    });
    setInitialFundingAccountId(fundingAccountId ?? null);
    setIsAddModalOpen(true);
  }, []);

  const handleDelete = useCallback(async card => {
    // Open the enhanced deletion modal instead of simple confirmation
    setDeletionModal({ isOpen: true, card });
  }, []);

  const handleDeleteConfirmed = useCallback(
    deletedCardId => {
      // Remove the deleted card from local state
      setCreditCards(prev => prev.filter(card => card.id !== deletedCardId));
      setDeletionModal({ isOpen: false, card: null });
      onDataChange();
    },
    [onDataChange],
  );

  const handleDeleteModalClose = useCallback(() => {
    setDeletionModal({ isOpen: false, card: null });
  }, []);

  const handleOpenMigration = useCallback(() => {
    setMigrationModal({ isOpen: true });
  }, []);

  const handleMigrationComplete = useCallback(() => {
    loadCreditCards();
    onDataChange(); // Refresh the data in parent
  }, [loadCreditCards, onDataChange]);

  // Sort credit cards based on selected criteria and pre-compute derived values
  const sortedCreditCards = useMemo(() => {
    if (!creditCards.length) return [];

    const sorted = [...creditCards].sort((a, b) => {
      switch (sortBy) {
        case 'dueDate': {
          // Sort by due date (closest due date first)
          const aDue = a.dueDate
            ? new Date(`${a.dueDate}T00:00:00`)
            : new Date('2099-12-31');
          const bDue = b.dueDate
            ? new Date(`${b.dueDate}T00:00:00`)
            : new Date('2099-12-31');
          return aDue - bDue;
        }

        case 'balance':
          // Sort by current balance (highest debt first)
          return b.balance - a.balance;

        case 'utilization': {
          // Sort by utilization percentage (highest utilization first)
          const aUtil = calculateUtilization(a.balance, a.creditLimit);
          const bUtil = calculateUtilization(b.balance, b.creditLimit);
          return bUtil - aUtil;
        }

        case 'name':
        default:
          // Sort alphabetically by name
          return a.name.localeCompare(b.name);
      }
    });

    return sorted.map(card => ({
      ...card,
      utilization: calculateUtilization(card.balance, card.creditLimit),
      daysUntilDue: getDaysUntilDue(card.dueDate),
    }));
  }, [creditCards, sortBy]);

  // Calculate summary statistics for all credit cards
  const summary = useMemo(() => {
    const totalDebt = creditCards.reduce(
      (sum, card) => sum + Math.max(card.balance || 0, 0),
      0,
    );
    const totalCreditLimit = creditCards.reduce(
      (sum, card) => sum + (card.creditLimit || 0),
      0,
    );
    const totalUtilization =
      totalCreditLimit > 0 ? (totalDebt / totalCreditLimit) * 100 : 0;
    const totalAvailableCredit = creditCards.reduce((sum, card) => {
      const available = (card.creditLimit || 0) - (card.balance || 0);
      return sum + Math.max(0, available);
    }, 0);

    return {
      totalDebt,
      totalCreditLimit,
      totalUtilization,
      totalAvailableCredit,
    };
  }, [creditCards]);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-white'>Loading credit cards...</div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex justify-between items-center mb-6'>
        <h1 className='text-3xl font-semibold text-white text-shadow'>
          Credit Cards
        </h1>
        <div className='flex items-center space-x-3'>
          {creditCards.length > 0 && (
            <button
              onClick={handleOpenMigration}
              className='glass-button glass-button--primary flex items-center space-x-2'
            >
              <Plus size={16} />
              <span>Smart Link Expenses</span>
            </button>
          )}
          {/* Only show Add Credit Card button when credit cards exist */}
          {creditCards.length > 0 && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className='glass-button glass-button--primary flex items-center space-x-2'
            >
              <Plus size={16} />
              <span>Add Credit Card</span>
            </button>
          )}
        </div>
      </div>

      {/* Total Debt Summary Card */}
      {creditCards.length > 0 && (
        <div className='glass-card rounded-2xl p-6 border border-white/10 mb-6'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-6'>
            <div>
              <p className='text-white/70 text-sm mb-2'>Total Debt</p>
              <PrivacyWrapper>
                <p className='text-2xl font-bold text-white'>
                  {formatCurrency(summary.totalDebt)}
                </p>
              </PrivacyWrapper>
            </div>
            <div>
              <p className='text-white/70 text-sm mb-2'>Total Credit Limit</p>
              <PrivacyWrapper>
                <p className='text-2xl font-bold text-white'>
                  {formatCurrency(summary.totalCreditLimit)}
                </p>
              </PrivacyWrapper>
            </div>
            <div>
              <p className='text-white/70 text-sm mb-2'>Utilization</p>
              <p
                className={`text-2xl font-bold ${getUtilizationColor(
                  summary.totalUtilization,
                )}`}
              >
                {summary.totalUtilization.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className='text-white/70 text-sm mb-2'>Available Credit</p>
              <PrivacyWrapper>
                <p className='text-2xl font-bold text-green-400'>
                  {formatCurrency(summary.totalAvailableCredit)}
                </p>
              </PrivacyWrapper>
            </div>
          </div>
        </div>
      )}

      {/* Sorting Controls */}
      {creditCards.length > 0 && (
        <div className='flex items-center space-x-4 mb-4'>
          <span className='text-white/70 text-sm'>Sort by:</span>
          <div className='flex items-center space-x-2'>
            <button
              onClick={() => setSortBy('name')}
              className={`glass-button glass-button--filter text-sm ${
                sortBy === 'name' ? 'active' : ''
              }`}
            >
              Name
            </button>
            <button
              onClick={() => setSortBy('dueDate')}
              className={`glass-button glass-button--filter text-sm ${
                sortBy === 'dueDate' ? 'active' : ''
              }`}
            >
              Due Date (Soonest First)
            </button>
            <button
              onClick={() => setSortBy('balance')}
              className={`glass-button glass-button--filter text-sm ${
                sortBy === 'balance' ? 'active' : ''
              }`}
            >
              Balance (Highest First)
            </button>
            <button
              onClick={() => setSortBy('utilization')}
              className={`glass-button glass-button--filter text-sm ${
                sortBy === 'utilization' ? 'active' : ''
              }`}
            >
              Utilization (Highest First)
            </button>
          </div>
        </div>
      )}

      {/* Credit Cards Grid */}
      {creditCards.length === 0 ? (
        <div className='text-center py-12'>
          <CreditCard size={48} className='mx-auto text-white/50 mb-4' />
          <h3 className='text-lg font-medium text-white/70 mb-2'>
            No Credit Cards
          </h3>
          <p className='text-white/50 mb-4'>
            Add your first credit card to start tracking your debt
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className='glass-button'
          >
            Add Credit Card
          </button>
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {sortedCreditCards.map((card, index) => (
            <EnhancedCreditCard
              key={card.id}
              card={card}
              onEdit={handleEdit}
              onDelete={handleDelete}
              index={index}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isAddModalOpen &&
        createPortal(
          <div
            className='fixed bg-black/50 backdrop-blur-sm flex items-center justify-center z-50'
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
            aria-label='Close credit card modal'
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
            <div className='glass-panel rounded-2xl p-8 w-full max-w-md space-y-6'>
              <h2 className='text-xl font-semibold text-white'>
                {editingCard ? 'Edit Credit Card' : 'Add Credit Card'}
              </h2>

              <div className='space-y-4'>
                <div>
                  <label
                    htmlFor='credit-card-name'
                    className='block text-sm font-medium text-white mb-2'
                  >
                    Name
                  </label>
                  <input
                    id='credit-card-name'
                    type='text'
                    value={formData.name}
                    onChange={e => handleInputChange('name', e.target.value)}
                    className='w-full px-4 py-3 glass-input rounded-xl text-white'
                    placeholder='Credit card name'
                  />
                  {errors.name && (
                    <p className='text-red-400 text-sm mt-1'>{errors.name}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor='credit-card-balance'
                    className='block text-sm font-medium text-white mb-2'
                  >
                    Current Balance
                  </label>
                  <input
                    id='credit-card-balance'
                    type='number'
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
                    htmlFor='credit-card-credit-limit'
                    className='block text-sm font-medium text-white mb-2'
                  >
                    Credit Limit
                  </label>
                  <input
                    id='credit-card-credit-limit'
                    type='number'
                    step='0.01'
                    value={formData.creditLimit}
                    onChange={e =>
                      handleInputChange('creditLimit', e.target.value)
                    }
                    className='w-full px-4 py-3 glass-input rounded-xl text-white'
                    placeholder='0.00'
                  />
                  {errors.creditLimit && (
                    <p className='text-red-400 text-sm mt-1'>
                      {errors.creditLimit}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor='credit-card-interest-rate'
                    className='block text-sm font-medium text-white mb-2'
                  >
                    Interest Rate (%)
                  </label>
                  <input
                    id='credit-card-interest-rate'
                    type='number'
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
                    htmlFor='credit-card-due-date'
                    className='block text-sm font-medium text-white mb-2'
                  >
                    Due Date
                  </label>
                  <input
                    id='credit-card-due-date'
                    type='date'
                    value={formData.dueDate}
                    onChange={e => handleInputChange('dueDate', e.target.value)}
                    className='w-full px-4 py-3 glass-input rounded-xl text-white'
                  />
                  {errors.dueDate && (
                    <p className='text-red-400 text-sm mt-1'>
                      {errors.dueDate}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor='credit-card-statement-closing-date'
                    className='block text-sm font-medium text-white mb-2'
                  >
                    Statement Closing Date (Optional)
                  </label>
                  <input
                    id='credit-card-statement-closing-date'
                    type='date'
                    value={formData.statementClosingDate}
                    onChange={e =>
                      handleInputChange('statementClosingDate', e.target.value)
                    }
                    className='w-full px-4 py-3 glass-input rounded-xl text-white'
                  />
                </div>

                <div>
                  <label
                    htmlFor='credit-card-minimum-payment'
                    className='block text-sm font-medium text-white mb-2'
                  >
                    Minimum Payment
                  </label>
                  <input
                    id='credit-card-minimum-payment'
                    type='number'
                    step='0.01'
                    value={formData.minimumPayment}
                    onChange={e =>
                      handleInputChange('minimumPayment', e.target.value)
                    }
                    className='w-full px-4 py-3 glass-input rounded-xl text-white'
                    placeholder='0.00'
                  />
                  {errors.minimumPayment && (
                    <p className='text-red-400 text-sm mt-1'>
                      {errors.minimumPayment}
                    </p>
                  )}
                </div>

                {editingCard && (
                  <div>
                    <label
                      htmlFor='credit-card-funding-account'
                      className='block text-sm font-medium text-white mb-2'
                    >
                      Funding account
                    </label>
                    <select
                      id='credit-card-funding-account'
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
                      Account used to pay this card (synced with Fixed Expenses)
                    </p>
                  </div>
                )}
              </div>

              <div className='flex space-x-3'>
                <button
                  onClick={handleSave}
                  className='flex-1 px-4 py-3 glass-button glass-button--primary'
                >
                  {editingCard ? 'Update' : 'Add'} Credit Card
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

      {/* Credit Card Deletion Modal */}
      <CreditCardDeletionModal
        isOpen={deletionModal.isOpen}
        creditCard={deletionModal.card}
        accounts={accounts}
        creditCards={creditCards}
        onClose={handleDeleteModalClose}
        onDelete={handleDeleteConfirmed}
      />

      {/* Credit Card Migration Modal */}
      <CreditCardMigrationModal
        isOpen={migrationModal.isOpen}
        onClose={() => setMigrationModal({ isOpen: false })}
        onComplete={handleMigrationComplete}
      />

      {/* Inline Account Creation Modal */}
      <CreateAccountModal
        isOpen={isAccountModalOpen}
        onClose={() => {
          setIsAccountModalOpen(false);
          setPendingCardData(null);
        }}
        onAccountCreated={handleAccountCreated}
      />

      {/* Retro-creation Confirmation Modal */}
      <MissingExpensesModal
        isOpen={isMissingExpensesModalOpen}
        cards={orphanedCards}
        onConfirm={handleRetroConfirm}
        onSkip={handleRetroSkip}
      />

      {/* Choose funding account for new card (2+ accounts) */}
      <ChooseFundingAccountModal
        isOpen={showFundingModal}
        cardName={fundingModalCardName}
        cardId={fundingModalCardId ?? 0}
        accounts={fundableAccounts}
        defaultAccountId={defaultAccountIdForModal}
        onConfirm={handleFundingConfirm}
        onUseDefault={handleFundingUseDefault}
        onCancel={handleFundingCancel}
        isLoading={isFundingModalLoading}
      />
    </div>
  );
};

CreditCards.propTypes = {
  onDataChange: PropTypes.func.isRequired,
  accounts: PropTypes.arrayOf(PropTypes.object),
  creditCards: PropTypes.arrayOf(PropTypes.object),
};

CreditCards.defaultProps = {
  accounts: [],
  creditCards: [],
};

export default CreditCards;
