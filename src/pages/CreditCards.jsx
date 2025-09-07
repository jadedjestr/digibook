import { Plus, CreditCard } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { dbHelpers } from '../db/database-clean';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications';
import EnhancedCreditCard from '../components/EnhancedCreditCard';
import PrivacyWrapper from '../components/PrivacyWrapper';
import CreditCardDeletionModal from '../components/CreditCardDeletionModal';
import CreditCardMigrationModal from '../components/CreditCardMigrationModal';

const CreditCards = ({
  onDataChange,
  accounts = [],
  creditCards: creditCardsProp = [],
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
  });
  const [errors, setErrors] = useState({});
  const [sortBy, setSortBy] = useState('name'); // 'name', 'dueDate', 'balance', 'utilization'

  useEffect(() => {
    loadCreditCards();
  }, []);

  const loadCreditCards = async () => {
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
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
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
  };

  const handleSave = async () => {
    if (!validateForm()) {
      notify.error('Please fix the errors before saving');
      return;
    }

    try {
      const cardData = {
        ...formData,
        balance: parseFloat(formData.balance),
        creditLimit: parseFloat(formData.creditLimit),
        interestRate: parseFloat(formData.interestRate),
        minimumPayment: parseFloat(formData.minimumPayment),
      };

      if (editingCard) {
        await dbHelpers.updateCreditCard(editingCard.id, cardData);
        notify.success('Credit card updated successfully');
      } else {
        await dbHelpers.addCreditCard(cardData);
        notify.success('Credit card added successfully');
      }

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
      loadCreditCards();
      onDataChange();
    } catch (error) {
      logger.error('Error saving credit card:', error);
      notify.error('Failed to save credit card');
    }
  };

  const handleEdit = card => {
    setEditingCard(card);
    setFormData({
      name: card.name,
      balance: card.balance.toString(),
      creditLimit: card.creditLimit.toString(),
      interestRate: card.interestRate.toString(),
      dueDate: card.dueDate,
      statementClosingDate: card.statementClosingDate || '',
      minimumPayment: card.minimumPayment.toString(),
    });
    setIsAddModalOpen(true);
  };

  const handleDelete = async card => {
    // Open the enhanced deletion modal instead of simple confirmation
    setDeletionModal({ isOpen: true, card });
  };

  const handleDeleteConfirmed = deletedCardId => {
    // Remove the deleted card from local state
    setCreditCards(prev => prev.filter(card => card.id !== deletedCardId));
    setDeletionModal({ isOpen: false, card: null });
    onDataChange();
  };

  const handleDeleteModalClose = () => {
    setDeletionModal({ isOpen: false, card: null });
  };

  const handleCreateMissingExpenses = async () => {
    try {
      const createdCount = await dbHelpers.createMissingCreditCardExpenses();
      if (createdCount > 0) {
        notify.success(`Created ${createdCount} missing credit card expenses`);
        onDataChange(); // Refresh the data
      } else {
        notify.info(
          'All credit cards already have corresponding fixed expenses'
        );
      }
    } catch (error) {
      logger.error('Error creating missing expenses:', error);
      notify.error('Failed to create missing expenses');
    }
  };

  const handleOpenMigration = () => {
    setMigrationModal({ isOpen: true });
  };

  const handleMigrationComplete = () => {
    loadCreditCards();
    onDataChange(); // Refresh the data in parent
  };

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

  // Sort credit cards based on selected criteria
  const sortedCreditCards = React.useMemo(() => {
    if (!creditCards.length) return [];

    const sorted = [...creditCards].sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          // Sort by due date (closest due date first)
          const aDue = a.dueDate
            ? new Date(`${a.dueDate}T00:00:00`)
            : new Date('2099-12-31');
          const bDue = b.dueDate
            ? new Date(`${b.dueDate}T00:00:00`)
            : new Date('2099-12-31');
          return aDue - bDue;

        case 'balance':
          // Sort by current balance (highest debt first)
          return b.balance - a.balance;

        case 'utilization':
          // Sort by utilization percentage (highest utilization first)
          const aUtil = calculateUtilization(a.balance, a.creditLimit);
          const bUtil = calculateUtilization(b.balance, b.creditLimit);
          return bUtil - aUtil;

        case 'name':
        default:
          // Sort alphabetically by name
          return a.name.localeCompare(b.name);
      }
    });

    return sorted;
  }, [creditCards, sortBy]);

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
              className='glass-button flex items-center space-x-2 bg-green-500/20 text-green-300 hover:bg-green-500/30'
            >
              <Plus size={16} />
              <span>Smart Link Expenses</span>
            </button>
          )}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className='glass-button flex items-center space-x-2 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
          >
            <Plus size={16} />
            <span>Add Credit Card</span>
          </button>
        </div>
      </div>

      {/* Sorting Controls */}
      {creditCards.length > 0 && (
        <div className='flex items-center space-x-4 mb-4'>
          <span className='text-white/70 text-sm'>Sort by:</span>
          <div className='flex items-center space-x-2'>
            <button
              onClick={() => setSortBy('name')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                sortBy === 'name'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              Name
            </button>
            <button
              onClick={() => setSortBy('dueDate')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                sortBy === 'dueDate'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              Due Date (Soonest First)
            </button>
            <button
              onClick={() => setSortBy('balance')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                sortBy === 'balance'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
            >
              Balance (Highest First)
            </button>
            <button
              onClick={() => setSortBy('utilization')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                sortBy === 'utilization'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
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
          {sortedCreditCards.map((card, index) => {
            // Calculate derived values for the enhanced component
            const utilization = calculateUtilization(
              card.balance,
              card.creditLimit
            );
            const daysUntilDue = getDaysUntilDue(card.dueDate);

            // Create enhanced card data object
            const enhancedCard = {
              ...card,
              utilization,
              daysUntilDue,
            };

            return (
              <EnhancedCreditCard
                key={card.id}
                card={enhancedCard}
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
            className='fixed bg-black/50 backdrop-blur-sm flex items-center justify-center z-50'
            style={{
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
            }}
            onClick={e => {
              if (e.target === e.currentTarget) {
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
              }
            }}
          >
            <div className='liquid-glass rounded-2xl p-8 w-full max-w-md space-y-6'>
              <h2 className='text-xl font-semibold text-white'>
                {editingCard ? 'Edit Credit Card' : 'Add Credit Card'}
              </h2>

              <div className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium text-white mb-2'>
                    Name
                  </label>
                  <input
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
                  <label className='block text-sm font-medium text-white mb-2'>
                    Current Balance
                  </label>
                  <input
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
                  <label className='block text-sm font-medium text-white mb-2'>
                    Credit Limit
                  </label>
                  <input
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
                  <label className='block text-sm font-medium text-white mb-2'>
                    Interest Rate (%)
                  </label>
                  <input
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
                  <label className='block text-sm font-medium text-white mb-2'>
                    Due Date
                  </label>
                  <input
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
                  <label className='block text-sm font-medium text-white mb-2'>
                    Statement Closing Date (Optional)
                  </label>
                  <input
                    type='date'
                    value={formData.statementClosingDate}
                    onChange={e =>
                      handleInputChange('statementClosingDate', e.target.value)
                    }
                    className='w-full px-4 py-3 glass-input rounded-xl text-white'
                  />
                </div>

                <div>
                  <label className='block text-sm font-medium text-white mb-2'>
                    Minimum Payment
                  </label>
                  <input
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
              </div>

              <div className='flex space-x-3'>
                <button
                  onClick={handleSave}
                  className='flex-1 px-4 py-3 glass-button bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                >
                  {editingCard ? 'Update' : 'Add'} Credit Card
                </button>
                <button
                  onClick={() => {
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
                  }}
                  className='flex-1 px-4 py-3 glass-button bg-white/10 text-white/70 hover:bg-white/20'
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
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
    </div>
  );
};

export default CreditCards;
