/**
 * Recurring Expense Service
 * Handles recurring expense template management and generation
 */

import { dbHelpers } from '../db/database-clean';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';

export class RecurringExpenseService {
  constructor() {
    this.frequencyOptions = [
      { value: 'monthly', label: 'Every month', months: 1 },
      { value: 'quarterly', label: 'Every 3 months', months: 3 },
      { value: 'biannually', label: 'Every 6 months', months: 6 },
      { value: 'annually', label: 'Every year', months: 12 },
      { value: 'custom', label: 'Custom interval', months: null },
    ];
  }

  /**
   * Get all frequency options for UI
   */
  getFrequencyOptions() {
    return this.frequencyOptions;
  }

  /**
   * Get frequency label by value
   */
  getFrequencyLabel(frequency) {
    const option = this.frequencyOptions.find(opt => opt.value === frequency);
    return option ? option.label : 'Unknown frequency';
  }

  /**
   * Create a new recurring expense template
   */
  async createTemplate(templateData) {
    try {
      // Validate required fields
      const requiredFields = [
        'name',
        'baseAmount',
        'frequency',
        'startDate',
        'category',
      ];
      for (const field of requiredFields) {
        if (!templateData[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Validate amount
      if (templateData.baseAmount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      // Validate start date
      if (!DateUtils.isValidDate(templateData.startDate)) {
        throw new Error('Invalid start date');
      }

      // Validate frequency
      const isValidFrequency = this.frequencyOptions.some(
        opt => opt.value === templateData.frequency
      );
      if (!isValidFrequency) {
        throw new Error('Invalid frequency');
      }

      // For custom frequency, validate interval value
      if (templateData.frequency === 'custom') {
        if (!templateData.intervalValue || templateData.intervalValue < 1) {
          throw new Error('Custom frequency requires valid interval value');
        }
      }

      const templateId =
        await dbHelpers.addRecurringExpenseTemplate(templateData);
      logger.success(
        `Created recurring expense template: ${templateData.name}`
      );
      return templateId;
    } catch (error) {
      logger.error('Error creating recurring expense template:', error);
      throw error;
    }
  }

  /**
   * Update an existing recurring expense template
   */
  async updateTemplate(templateId, updates) {
    try {
      await dbHelpers.updateRecurringExpenseTemplate(templateId, updates);
      logger.success(`Updated recurring expense template: ${templateId}`);
    } catch (error) {
      logger.error('Error updating recurring expense template:', error);
      throw error;
    }
  }

  /**
   * Delete a recurring expense template
   */
  async deleteTemplate(templateId) {
    try {
      await dbHelpers.deleteRecurringExpenseTemplate(templateId);
      logger.success(`Deleted recurring expense template: ${templateId}`);
    } catch (error) {
      logger.error('Error deleting recurring expense template:', error);
      throw error;
    }
  }

  /**
   * Get all active recurring expense templates
   */
  async getActiveTemplates() {
    try {
      return await dbHelpers.getRecurringExpenseTemplates();
    } catch (error) {
      logger.error('Error fetching recurring expense templates:', error);
      throw error;
    }
  }

  /**
   * Get a specific recurring expense template
   */
  async getTemplate(templateId) {
    try {
      return await dbHelpers.getRecurringExpenseTemplate(templateId);
    } catch (error) {
      logger.error('Error fetching recurring expense template:', error);
      throw error;
    }
  }

  /**
   * Check for templates that are due for generation
   * Returns templates where nextDueDate is today or in the past
   */
  async getTemplatesDueForGeneration() {
    try {
      const templates = await this.getActiveTemplates();
      const today = DateUtils.today();

      return templates.filter(template => {
        if (!template.nextDueDate) return false;
        return DateUtils.daysBetween(template.nextDueDate, today) >= 0;
      });
    } catch (error) {
      logger.error('Error checking templates due for generation:', error);
      throw error;
    }
  }

  /**
   * Get upcoming recurring expenses (next occurrence only)
   */
  async getUpcomingRecurringExpenses() {
    try {
      const templates = await this.getActiveTemplates();

      return templates.map(template => ({
        id: template.id,
        name: template.name,
        amount: template.baseAmount,
        nextDueDate: template.nextDueDate,
        frequency: template.frequency,
        frequencyLabel: this.getFrequencyLabel(template.frequency),
        isVariableAmount: template.isVariableAmount,
        category: template.category,
      }));
    } catch (error) {
      logger.error('Error fetching upcoming recurring expenses:', error);
      throw error;
    }
  }

  /**
   * Generate the next occurrence of a recurring expense
   */
  async generateNextOccurrence(templateId) {
    try {
      const expenseId = await dbHelpers.generateRecurringExpense(templateId);
      logger.success(`Generated next occurrence for template: ${templateId}`);
      return expenseId;
    } catch (error) {
      logger.error('Error generating next occurrence:', error);
      throw error;
    }
  }

  /**
   * Auto-generate all recurring expenses that are due
   * This can be called on app startup or periodically
   */
  async autoGenerateDueExpenses() {
    try {
      const dueTemplates = await this.getTemplatesDueForGeneration();
      const results = [];

      for (const template of dueTemplates) {
        try {
          const expenseId = await this.generateNextOccurrence(template.id);
          results.push({
            templateId: template.id,
            templateName: template.name,
            expenseId,
            success: true,
          });
        } catch (error) {
          results.push({
            templateId: template.id,
            templateName: template.name,
            error: error.message,
            success: false,
          });
        }
      }

      if (results.length > 0) {
        const successCount = results.filter(r => r.success).length;
        logger.success(`Auto-generated ${successCount} recurring expenses`);
      }

      return results;
    } catch (error) {
      logger.error('Error auto-generating recurring expenses:', error);
      throw error;
    }
  }

  /**
   * Convert existing expense to recurring template
   */
  async convertExpenseToRecurring(expense, recurringData) {
    try {
      const templateData = {
        name: recurringData.name || expense.name,
        baseAmount: recurringData.baseAmount || expense.amount,
        frequency: recurringData.frequency,
        intervalValue: recurringData.intervalValue,
        startDate: recurringData.startDate || expense.dueDate,
        category: expense.category,
        accountId: expense.accountId,
        notes: recurringData.notes || '',
        isVariableAmount: recurringData.isVariableAmount || false,
      };

      const templateId = await this.createTemplate(templateData);

      // Update the original expense to link it to the template
      await dbHelpers.updateFixedExpense(expense.id, {
        recurringTemplateId: templateId,
      });

      logger.success(
        `Converted expense to recurring template: ${expense.name}`
      );
      return templateId;
    } catch (error) {
      logger.error('Error converting expense to recurring:', error);
      throw error;
    }
  }

  /**
   * Calculate when the next N occurrences will be due
   */
  calculateUpcomingOccurrences(template, count = 3) {
    try {
      const occurrences = [];
      let currentDate = template.nextDueDate;

      for (let i = 0; i < count; i++) {
        occurrences.push({
          date: currentDate,
          displayDate: DateUtils.formatDisplayDate(currentDate),
          shortDate: DateUtils.formatShortDate(currentDate),
        });

        // Calculate next date
        currentDate = dbHelpers.calculateNextDueDate(
          currentDate,
          template.frequency,
          template.intervalValue || 1
        );
      }

      return occurrences;
    } catch (error) {
      logger.error('Error calculating upcoming occurrences:', error);
      return [];
    }
  }
}

// Create singleton instance
export const recurringExpenseService = new RecurringExpenseService();
