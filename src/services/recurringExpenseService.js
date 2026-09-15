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
 * Materialize a template's current cycle as a real expense, if it's due
 * and doesn't already exist. Named generateNextOccurrence for backward
 * compatibility with existing callers (e.g. AddExpensePanel's "first
 * occurrence is due now" check) - it's a thin wrapper over
 * dbHelpers.materializeCurrentCycle, which is idempotent and returns null
 * rather than creating anything when the cycle isn't due yet.
 */
export async function generateNextOccurrence(templateId) {
  try {
    const generatedId = await dbHelpers.materializeCurrentCycle(templateId);
    if (generatedId) {
      logger.success(`Generated next occurrence for template ${templateId}`);
    }
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

// preGenerateOccurrences and regenerateUnpaidOccurrences (the bulk
// "pre-generate N months of real rows" mechanism) have been removed.
// Recurring templates now materialize one cycle at a time, lazily, via
// dbHelpers.materializeCurrentCycle/materializeDueTemplates - see the
// "One Bill at a Time" redesign. Neither function had a production
// caller left once useAppStore.js, FixedExpenses.jsx, AddExpensePanel.jsx,
// and createExpenseForCard were switched to the lazy path.
