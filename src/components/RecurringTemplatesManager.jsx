import { Edit, Pause, Play, Trash2 } from 'lucide-react';
import { useMemo, useState, useEffect, useCallback } from 'react';

import { db } from '../db/database-clean';
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
  getFrequencyLabel,
} from '../services/recurringExpenseService';
import {
  useAccounts,
  useCreditCards,
  useFixedExpenses,
  useReloadExpenses,
  useRefreshTemplates,
} from '../stores/useAppStore';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';
import { notify } from '../utils/notifications';

import RecurringExpenseModal from './RecurringExpenseModal';

const RecurringTemplatesManager = () => {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const fixedExpenses = useFixedExpenses();
  const accounts = useAccounts();
  const creditCards = useCreditCards();
  const reloadExpenses = useReloadExpenses();
  const refreshTemplates = useRefreshTemplates();

  // Calculate statistics for each template
  const templatesWithStats = useMemo(() => {
    return templates.map(template => {
      const linkedExpenses = fixedExpenses.filter(
        expense => expense.recurringTemplateId === template.id,
      );

      const totalGenerated = linkedExpenses.length;
      const lastGenerated =
        linkedExpenses.length > 0
          ? linkedExpenses.reduce((latest, expense) => {
              const expenseDate = DateUtils.parseDate(expense.dueDate);
              const latestDate = DateUtils.parseDate(latest);
              return expenseDate > latestDate ? expense.dueDate : latest;
            }, linkedExpenses[0].dueDate)
          : null;
      const linkedCount = linkedExpenses.length;

      return {
        ...template,
        totalGenerated,
        lastGenerated,
        linkedCount,
      };
    });
  }, [templates, fixedExpenses]);

  // Load templates
  const loadTemplates = useCallback(async () => {
    try {
      setIsLoading(true);

      // Get all templates including paused ones by accessing the database directly
      const allTemplates = await db.recurringExpenseTemplates.toArray();

      // Normalize intervalUnit for backward compatibility
      const normalizedTemplates = allTemplates.map(template => ({
        ...template,
        intervalUnit: template.intervalUnit || 'months',
      }));
      setTemplates(normalizedTemplates);
    } catch (error) {
      logger.error('Error loading templates:', error);
      notify.error('Failed to load recurring templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Handle edit
  const handleEdit = useCallback(async template => {
    try {
      const fullTemplate = await getTemplate(template.id);
      setEditingTemplate(fullTemplate);
      setShowEditModal(true);
    } catch (error) {
      logger.error('Error loading template for editing:', error);
      notify.error('Failed to load template');
    }
  }, []);

  // Handle save edit
  const handleSaveEdit = useCallback(
    async recurringData => {
      if (!editingTemplate) return;

      try {
        const updateData = {
          name: recurringData.name,
          baseAmount:
            recurringData.amount !== undefined
              ? parseFloat(recurringData.amount)
              : editingTemplate.baseAmount,
          category: recurringData.category || editingTemplate.category,
          accountId: recurringData.paymentSource?.accountId || null,
          creditCardId: recurringData.paymentSource?.creditCardId || null,
          targetCreditCardId: recurringData.targetCreditCardId || null, // For credit card payments
          frequency: recurringData.frequency,
          intervalValue: recurringData.intervalValue || 1,
          intervalUnit: recurringData.intervalUnit || 'months',
          startDate: recurringData.startDate,
          endDate: recurringData.endDate || null,
          isVariableAmount: recurringData.isVariableAmount || false,
          notes: recurringData.notes || '',
        };

        await updateTemplate(editingTemplate.id, updateData);
        setShowEditModal(false);
        setEditingTemplate(null);
        await loadTemplates();
        await reloadExpenses();
        refreshTemplates();
        notify.success('Template updated successfully');
      } catch (error) {
        logger.error('Error updating template:', error);
        notify.error('Failed to update template');
        throw error;
      }
    },
    [editingTemplate, loadTemplates, reloadExpenses, refreshTemplates],
  );

  // Handle pause/resume
  const handleTogglePause = useCallback(
    async template => {
      try {
        await updateTemplate(template.id, {
          isActive: !template.isActive,
        });
        await loadTemplates();
        await reloadExpenses();
        refreshTemplates();
        notify.success(
          `Template ${template.isActive ? 'paused' : 'resumed'} successfully`,
        );
      } catch (error) {
        logger.error('Error toggling template pause state:', error);
        notify.error('Failed to toggle template');
      }
    },
    [loadTemplates, reloadExpenses, refreshTemplates],
  );

  // Handle delete
  const handleDelete = useCallback(
    async template => {
      if (
        !window.confirm(
          'Are you sure you want to delete this recurring template? This will stop generating future expenses, but existing expenses will remain.',
        )
      ) {
        return;
      }

      try {
        await deleteTemplate(template.id);
        await loadTemplates();
        await reloadExpenses();
        refreshTemplates();
        notify.success('Template deleted successfully');
      } catch (error) {
        logger.error('Error deleting template:', error);
        notify.error('Failed to delete template');
      }
    },
    [loadTemplates, reloadExpenses, refreshTemplates],
  );

  if (isLoading) {
    return (
      <div className='flex items-center justify-center p-8'>
        <div className='text-white/70'>Loading templates...</div>
      </div>
    );
  }

  if (templatesWithStats.length === 0) {
    return (
      <div className='text-center p-8'>
        <div className='text-white/70 mb-4'>No recurring templates found</div>
        <p className='text-white/50 text-sm'>
          Create recurring templates from fixed expenses to automatically
          generate future occurrences.
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='overflow-x-auto'>
        <table className='w-full'>
          <thead>
            <tr className='border-b border-white/10'>
              <th className='text-left p-3 text-white/70 font-medium'>Name</th>
              <th className='text-left p-3 text-white/70 font-medium'>
                Frequency
              </th>
              <th className='text-left p-3 text-white/70 font-medium'>
                Next Due Date
              </th>
              <th className='text-left p-3 text-white/70 font-medium'>
                Status
              </th>
              <th className='text-left p-3 text-white/70 font-medium'>
                Total Generated
              </th>
              <th className='text-left p-3 text-white/70 font-medium'>
                Last Generated
              </th>
              <th className='text-left p-3 text-white/70 font-medium'>
                Linked Count
              </th>
              <th className='text-left p-3 text-white/70 font-medium'>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {templatesWithStats.map(template => (
              <tr
                key={template.id}
                className='border-b border-white/5 hover:bg-white/5'
              >
                <td className='p-3 text-white'>{template.name}</td>
                <td className='p-3 text-white/70'>
                  {getFrequencyLabel(template.frequency)}
                </td>
                <td className='p-3 text-white/70'>
                  {template.nextDueDate
                    ? DateUtils.formatShortDate(template.nextDueDate)
                    : 'N/A'}
                </td>
                <td className='p-3'>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      template.isActive
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}
                  >
                    {template.isActive ? 'Active' : 'Paused'}
                  </span>
                </td>
                <td className='p-3 text-white/70'>{template.totalGenerated}</td>
                <td className='p-3 text-white/70'>
                  {template.lastGenerated
                    ? DateUtils.formatShortDate(template.lastGenerated)
                    : 'Never'}
                </td>
                <td className='p-3 text-white/70'>{template.linkedCount}</td>
                <td className='p-3'>
                  <div className='flex items-center space-x-2'>
                    <button
                      onClick={() => handleEdit(template)}
                      className='p-1 text-blue-400 hover:text-blue-300'
                      title='Edit template'
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleTogglePause(template)}
                      className='p-1 text-yellow-400 hover:text-yellow-300'
                      title={
                        template.isActive ? 'Pause template' : 'Resume template'
                      }
                    >
                      {template.isActive ? (
                        <Pause size={16} />
                      ) : (
                        <Play size={16} />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(template)}
                      className='p-1 text-red-400 hover:text-red-300'
                      title='Delete template'
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingTemplate && (
        <RecurringExpenseModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingTemplate(null);
          }}
          mode='edit'
          templateId={editingTemplate.id}
          initialData={editingTemplate}
          onSave={handleSaveEdit}
          accounts={accounts}
          creditCards={creditCards}
        />
      )}
    </div>
  );
};

export default RecurringTemplatesManager;
