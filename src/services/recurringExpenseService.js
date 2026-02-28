/**
 * Recurring Expense Service
 * Handles recurring expense template management and generation
 */

import { dbHelpers } from '../db/database-clean';
import { DateUtils } from '../utils/dateUtils';
import { logger } from '../utils/logger';

// Static constant for frequency options - no service instantiation needed
export const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Every month', months: 1 },
  { value: 'quarterly', label: 'Every 3 months', months: 3 },
  { value: 'biannually', label: 'Every 6 months', months: 6 },
  { value: 'annually', label: 'Every year', months: 12 },
  { value: 'custom', label: 'Custom interval', months: null },
];

// Standalone function for frequency labels - uses static constant
export function getFrequencyLabel(frequency) {
  const option = FREQUENCY_OPTIONS.find(opt => opt.value === frequency);
  return option ? option.label : 'Unknown frequency';
}

// ============================================================================
// STANDALONE FUNCTIONAL API (Phase 1: New functional exports)
// ============================================================================

/**
 * Create a new recurring expense template
 */
export async function createTemplate(templateData) {
  try {
    const template = {
      name: templateData.name,
      baseAmount: templateData.baseAmount,
      frequency: templateData.frequency,
      intervalValue: templateData.intervalValue || 1,
      intervalUnit: templateData.intervalUnit || 'months',
      startDate: templateData.startDate,
      endDate: templateData.endDate || null,
      nextDueDate: templateData.startDate, // First occurrence
      category: templateData.category,
      accountId: templateData.accountId || null, // V4 format: can be null
      creditCardId: templateData.creditCardId || null,
      targetCreditCardId: templateData.targetCreditCardId || null, // For credit card payments
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
export async function updateTemplate(templateId, updates) {
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
export async function deleteTemplate(templateId) {
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
export async function getActiveTemplates() {
  try {
    const result = await dbHelpers.getRecurringExpenseTemplates();
    return result;
  } catch (error) {
    logger.error('Error fetching recurring expense templates:', error);
    throw error;
  }
}

/**
 * Get a specific recurring expense template
 */
export async function getTemplate(templateId) {
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
export async function getTemplatesDueForGeneration() {
  try {
    const templates = await getActiveTemplates();
    const todayString = DateUtils.today();
    const today = DateUtils.parseDate(todayString);

    if (!today) {
      // eslint-disable-next-line quotes -- string contains apostrophe, Prettier uses double quotes
      logger.error("Error parsing today's date");
      return [];
    }

    return templates.filter(template => {
      // Check if template has passed its end date
      if (template.endDate) {
        const endDate = DateUtils.parseDate(template.endDate);
        if (endDate && endDate < today) {
          return false; // Template has expired
        }
      }

      const nextDue = DateUtils.parseDate(template.nextDueDate);
      if (!nextDue) return false;

      // Compare Date objects directly for accurate comparison
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
export async function getUpcomingRecurringExpenses() {
  try {
    const templates = await getActiveTemplates();
    const todayString = DateUtils.today();
    const today = DateUtils.parseDate(todayString);

    const result = templates
      .filter(template => {
        // Filter out invalid templates
        if (!template || !template.id) return false;

        // Filter out templates that have passed their end date
        if (template.endDate) {
          const endDate = DateUtils.parseDate(template.endDate);
          if (endDate && today && endDate < today) {
            return false; // Template has expired
          }
        }

        return true;
      })
      .map(template => ({
        id: template.id,
        name: template.name || 'Unnamed',
        amount: template.baseAmount || 0,
        nextDueDate: template.nextDueDate || null,
        frequency: template.frequency || 'monthly',
        frequencyLabel: getFrequencyLabel(template.frequency || 'monthly'),
        isVariableAmount: template.isVariableAmount || false,
        category: template.category || '',
      }));

    return result;
  } catch (error) {
    logger.error('Error fetching upcoming recurring expenses:', error);
    throw error;
  }
}

/**
 * Generate the next occurrence of a recurring expense
 */
export async function generateNextOccurrence(templateId) {
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
export async function autoGenerateDueExpenses() {
  try {
    const dueTemplates = await getTemplatesDueForGeneration();
    const generated = [];

    for (const template of dueTemplates) {
      try {
        const expenseId = await generateNextOccurrence(template.id);
        generated.push({
          templateId: template.id,
          templateName: template.name,
          expenseId,
        });
      } catch (error) {
        logger.error(
          `Failed to generate expense for template ${template.id}:`,
          error,
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
export async function convertFixedExpenseToRecurring(expenseId, recurringData) {
  try {
    // Get the original expense
    const expense = await dbHelpers.getFixedExpenseV4(expenseId);
    if (!expense) {
      throw new Error('Expense not found');
    }

    // Create the recurring template with V4 format support
    const templateData = {
      name: recurringData.name,
      baseAmount: expense.amount,
      frequency: recurringData.frequency,
      intervalValue: recurringData.intervalValue || 1,
      intervalUnit: recurringData.intervalUnit || 'months',
      startDate: recurringData.startDate,
      endDate: recurringData.endDate || null,
      category: expense.category,
      accountId: expense.accountId || null, // V4 format
      creditCardId: expense.creditCardId || null, // V4 format: preserve credit card payment source
      notes: recurringData.notes || '',
      isVariableAmount: recurringData.isVariableAmount || false,
    };

    const templateId = await createTemplate(templateData);

    // Link the original expense to the template using V4 format
    await dbHelpers.updateFixedExpenseV4(expenseId, {
      recurringTemplateId: templateId,
    });

    logger.success(
      `Converted expense ${expenseId} to recurring template ${templateId}`,
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
export async function convertExpenseToRecurring(expense, recurringData) {
  return convertFixedExpenseToRecurring(expense.id, recurringData);
}

/**
 * Calculate when the next N occurrences will be due
 */
export function calculateUpcomingOccurrences(template, count = 3) {
  try {
    // Normalize template to ensure intervalUnit is set
    const normalizedTemplate = {
      ...template,
      intervalUnit: template.intervalUnit || 'months',
      intervalValue: template.intervalValue || 1,
    };

    const occurrences = [];
    let currentDate = normalizedTemplate.nextDueDate;

    for (let i = 0; i < count; i++) {
      occurrences.push({
        date: currentDate,
        displayDate: DateUtils.formatDisplayDate(currentDate),
        shortDate: DateUtils.formatShortDate(currentDate),
      });

      // Calculate next date
      currentDate = dbHelpers.calculateNextDueDate(
        currentDate,
        normalizedTemplate.frequency,
        normalizedTemplate.intervalValue,
        normalizedTemplate.intervalUnit,
      );
    }

    return occurrences;
  } catch (error) {
    logger.error('Error calculating upcoming occurrences:', error);
    return [];
  }
}

/**
 * Pre-generate multiple occurrences of a recurring expense template
 * Generates expenses up to a specified horizon (e.g., 6 months ahead)
 */
export async function preGenerateOccurrences(templateId, monthsAhead = 6) {
  try {
    const template = await getTemplate(templateId);
    if (!template || !template.isActive) {
      return { generated: 0, skipped: 0 };
    }

    const today = DateUtils.today();
    const todayDate = DateUtils.parseDate(today);
    const horizonDate = new Date(todayDate);
    horizonDate.setMonth(horizonDate.getMonth() + monthsAhead);

    // Get all existing expenses for this template to check for duplicates
    const allExpenses = await dbHelpers.getFixedExpenses();
    const existingExpenses = allExpenses.filter(
      expense => expense.recurringTemplateId === templateId,
    );
    const existingDates = new Set(
      existingExpenses.map(expense => expense.dueDate),
    );

    let generated = 0;
    let skipped = 0;

    // Determine starting date
    let currentDueDate = template.nextDueDate || template.startDate;
    let currentDueDateObj = DateUtils.parseDate(currentDueDate);

    // If nextDueDate is in the future, start from startDate instead
    if (!currentDueDateObj || currentDueDateObj > todayDate) {
      currentDueDate = template.startDate;
      currentDueDateObj = DateUtils.parseDate(currentDueDate);
    }

    // Check if template has an end date
    const endDate = template.endDate
      ? DateUtils.parseDate(template.endDate)
      : null;

    // Generate occurrences until we reach the horizon or end date
    while (currentDueDateObj && currentDueDateObj <= horizonDate) {
      // Stop if we've passed the end date
      if (endDate && currentDueDateObj > endDate) {
        break;
      }

      const dateString = DateUtils.formatDate(currentDueDateObj);

      // Check if this occurrence already exists
      if (existingDates.has(dateString)) {
        skipped++;

        // Calculate next date manually since we skipped this one
        currentDueDate = dbHelpers.calculateNextDueDate(
          dateString,
          template.frequency,
          template.intervalValue || 1,
          template.intervalUnit || 'months',
        );
      } else {
        try {
          // Temporarily update template's nextDueDate to generate this occurrence
          await dbHelpers.updateRecurringExpenseTemplate(templateId, {
            nextDueDate: dateString,
          });

          // Generate the occurrence (this will update nextDueDate to the next occurrence)
          await generateNextOccurrence(templateId);

          // Refresh template to get updated nextDueDate
          const updatedTemplate = await getTemplate(templateId);
          currentDueDate = updatedTemplate.nextDueDate || currentDueDate;
          generated++;
        } catch (error) {
          logger.warn(
            `Failed to generate occurrence for ${dateString}:`,
            error,
          );
          skipped++;

          // Calculate next date manually if generation failed
          currentDueDate = dbHelpers.calculateNextDueDate(
            dateString,
            template.frequency,
            template.intervalValue || 1,
            template.intervalUnit || 'months',
          );
        }
      }

      currentDueDateObj = DateUtils.parseDate(currentDueDate);

      // Safety check to prevent infinite loops
      if (!currentDueDateObj || isNaN(currentDueDateObj.getTime())) {
        logger.error(`Invalid date calculated: ${currentDueDate}`);
        break;
      }
    }

    logger.success(
      `Pre-generated ${generated} occurrences for template ${templateId} (${skipped} skipped)`,
    );
    return { generated, skipped };
  } catch (error) {
    logger.error('Error pre-generating occurrences:', error);
    throw error;
  }
}

/**
 * Regenerate unpaid future occurrences when a template is edited
 * Deletes unpaid future expenses and regenerates them with updated template data
 */
export async function regenerateUnpaidOccurrences(templateId) {
  try {
    const template = await getTemplate(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    const today = DateUtils.today();
    const allExpenses = await dbHelpers.getFixedExpenses();

    // Find unpaid future expenses for this template
    const unpaidFutureExpenses = allExpenses.filter(
      expense =>
        expense.recurringTemplateId === templateId &&
        expense.dueDate > today &&
        (expense.paidAmount || 0) === 0,
    );

    // Delete unpaid future expenses
    let deleted = 0;
    for (const expense of unpaidFutureExpenses) {
      try {
        await dbHelpers.deleteFixedExpense(expense.id);
        deleted++;
      } catch (error) {
        logger.warn(`Failed to delete expense ${expense.id}:`, error);
      }
    }

    logger.info(
      `Deleted ${deleted} unpaid future expenses for template ${templateId}`,
    );

    // Regenerate occurrences with updated template data
    const result = await preGenerateOccurrences(templateId, 6);

    logger.success(
      `Regenerated ${result.generated} occurrences for template ${templateId}`,
    );
    return { deleted, ...result };
  } catch (error) {
    logger.error('Error regenerating unpaid occurrences:', error);
    throw error;
  }
}
