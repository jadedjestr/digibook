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
      const template = {
        name: templateData.name,
        baseAmount: templateData.baseAmount,
        frequency: templateData.frequency,
        intervalValue: templateData.intervalValue || 1,
        startDate: templateData.startDate,
        nextDueDate: templateData.startDate, // First occurrence
        category: templateData.category,
        accountId: templateData.accountId,
        notes: templateData.notes || '',
        isActive: true,
        isVariableAmount: templateData.isVariableAmount || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const templateId = await dbHelpers.addRecurringExpenseTemplate(template);
      logger.success(`Created recurring expense template: ${template.name}`);
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
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await dbHelpers.updateRecurringExpenseTemplate(templateId, updateData);
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
   * Get templates that are due for generation
   */
  async getTemplatesDueForGeneration() {
    try {
      const templates = await this.getActiveTemplates();
      const today = DateUtils.today();

      return templates.filter(template => {
        const nextDue = DateUtils.parseDate(template.nextDueDate);
        return nextDue <= today;
      });
    } catch (error) {
      logger.error('Error fetching templates due for generation:', error);
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
      const generatedId = await dbHelpers.generateRecurringExpense(templateId);
      logger.success(`Generated next occurrence for template ${templateId}`);
      return generatedId;
    } catch (error) {
      logger.error('Error generating next occurrence:', error);
      throw error;
    }
  }

  /**
   * Auto-generate expenses for all due templates
   */
  async autoGenerateDueExpenses() {
    try {
      const dueTemplates = await this.getTemplatesDueForGeneration();
      const generated = [];

      for (const template of dueTemplates) {
        try {
          const expenseId = await this.generateNextOccurrence(template.id);
          generated.push({
            templateId: template.id,
            templateName: template.name,
            expenseId,
          });
        } catch (error) {
          logger.error(
            `Failed to generate expense for template ${template.id}:`,
            error
          );
        }
      }

      logger.success(`Auto-generated ${generated.length} recurring expenses`);
      return generated;
    } catch (error) {
      logger.error('Error auto-generating due expenses:', error);
      throw error;
    }
  }

  /**
   * Convert an existing fixed expense to a recurring expense
   */
  async convertFixedExpenseToRecurring(expenseId, recurringData) {
    try {
      // Get the original expense
      const expense = await dbHelpers.getFixedExpense(expenseId);
      if (!expense) {
        throw new Error('Expense not found');
      }

      // Create the recurring template
      const templateData = {
        name: recurringData.name,
        baseAmount: expense.amount,
        frequency: recurringData.frequency,
        intervalValue: recurringData.intervalValue || 1,
        startDate: recurringData.startDate,
        category: expense.category,
        accountId: expense.accountId,
        notes: recurringData.notes || '',
        isVariableAmount: recurringData.isVariableAmount || false,
      };

      const templateId = await this.createTemplate(templateData);

      // Link the original expense to the template
      await dbHelpers.updateFixedExpense(expenseId, {
        recurringTemplateId: templateId,
      });

      logger.success(
        `Converted expense ${expenseId} to recurring template ${templateId}`
      );
      return templateId;
    } catch (error) {
      logger.error('Error converting expense to recurring:', error);
      throw error;
    }
  }

  /**
   * Convert an existing expense to recurring (alias for backward compatibility)
   */
  async convertExpenseToRecurring(expense, recurringData) {
    return this.convertFixedExpenseToRecurring(expense.id, recurringData);
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
