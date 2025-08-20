import React, { useState, useEffect } from 'react';
import { logger } from "../utils/logger";
import { dbHelpers } from '../db/database';
import { Plus, CreditCard } from 'lucide-react';
import { notify } from '../utils/notifications';
import EnhancedCreditCard from '../components/EnhancedCreditCard';

const CreditCards = ({ onDataChange }) => {
  const [creditCards, setCreditCards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    balance: '',
    creditLimit: '',
    interestRate: '',
    dueDate: '',
    statementClosingDate: '',
    minimumPayment: ''
  });
  const [errors, setErrors] = useState({});

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
        minimumPayment: parseFloat(formData.minimumPayment)
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
        minimumPayment: ''
      });
      setErrors({});
      loadCreditCards();
      onDataChange();
    } catch (error) {
      logger.error('Error saving credit card:', error);
      notify.error('Failed to save credit card');
    }
  };

  const handleEdit = (card) => {
    setEditingCard(card);
    setFormData({
      name: card.name,
      balance: card.balance.toString(),
      creditLimit: card.creditLimit.toString(),
      interestRate: card.interestRate.toString(),
      dueDate: card.dueDate,
      statementClosingDate: card.statementClosingDate || '',
      minimumPayment: card.minimumPayment.toString()
    });
    setIsAddModalOpen(true);
  };

  const handleDelete = async (card) => {
    const confirmed = await notify.showConfirmation(
      `Are you sure you want to delete "${card.name}"? This action cannot be undone.`
    );
    
    if (confirmed) {
      try {
        await dbHelpers.deleteCreditCard(card.id);
        notify.success('Credit card deleted successfully');
        loadCreditCards();
        onDataChange();
      } catch (error) {
        logger.error('Error deleting credit card:', error);
        notify.error('Failed to delete credit card');
      }
    }
  };

  const calculateUtilization = (balance, limit) => {
    if (!limit || limit === 0) return 0;
    return (balance / limit) * 100;
  };

  const getDaysUntilDue = (dueDate) => {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Loading credit cards...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-semibold text-white text-shadow">Credit Cards</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="glass-button flex items-center space-x-2 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
        >
          <Plus size={16} />
          <span>Add Credit Card</span>
        </button>
      </div>

      {/* Credit Cards Grid */}
      {creditCards.length === 0 ? (
        <div className="text-center py-12">
          <CreditCard size={48} className="mx-auto text-white/50 mb-4" />
          <h3 className="text-lg font-medium text-white/70 mb-2">No Credit Cards</h3>
          <p className="text-white/50 mb-4">Add your first credit card to start tracking your debt</p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="glass-button"
          >
            Add Credit Card
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {creditCards.map((card, index) => {
            // Calculate derived values for the enhanced component
            const utilization = calculateUtilization(card.balance, card.creditLimit);
            const daysUntilDue = getDaysUntilDue(card.dueDate);
            
            // Create enhanced card data object
            const enhancedCard = {
              ...card,
              utilization,
              daysUntilDue
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
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="liquid-glass rounded-2xl p-8 w-full max-w-md space-y-6">
            <h2 className="text-xl font-semibold text-white">
              {editingCard ? 'Edit Credit Card' : 'Add Credit Card'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl text-white"
                  placeholder="Credit card name"
                />
                {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Current Balance</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.balance}
                  onChange={(e) => handleInputChange('balance', e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl text-white"
                  placeholder="0.00"
                />
                {errors.balance && <p className="text-red-400 text-sm mt-1">{errors.balance}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Credit Limit</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.creditLimit}
                  onChange={(e) => handleInputChange('creditLimit', e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl text-white"
                  placeholder="0.00"
                />
                {errors.creditLimit && <p className="text-red-400 text-sm mt-1">{errors.creditLimit}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.interestRate}
                  onChange={(e) => handleInputChange('interestRate', e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl text-white"
                  placeholder="0.00"
                />
                {errors.interestRate && <p className="text-red-400 text-sm mt-1">{errors.interestRate}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Due Date</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl text-white"
                />
                {errors.dueDate && <p className="text-red-400 text-sm mt-1">{errors.dueDate}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Statement Closing Date (Optional)</label>
                <input
                  type="date"
                  value={formData.statementClosingDate}
                  onChange={(e) => handleInputChange('statementClosingDate', e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Minimum Payment</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.minimumPayment}
                  onChange={(e) => handleInputChange('minimumPayment', e.target.value)}
                  className="w-full px-4 py-3 glass-input rounded-xl text-white"
                  placeholder="0.00"
                />
                {errors.minimumPayment && <p className="text-red-400 text-sm mt-1">{errors.minimumPayment}</p>}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-3 glass-button bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
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
                    minimumPayment: ''
                  });
                  setErrors({});
                }}
                className="flex-1 px-4 py-3 glass-button bg-white/10 text-white/70 hover:bg-white/20"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreditCards;
