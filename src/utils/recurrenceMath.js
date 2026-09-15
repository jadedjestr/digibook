import { DateUtils } from './dateUtils';

/**
 * Pure date math: advance startDate by one cycle of (frequency,
 * intervalValue, intervalUnit). No DB dependency, deliberately - both
 * dbHelpers.calculateNextDueDate (src/db/database-clean.js) and the
 * Virtual Ledger (src/utils/virtualLedger.js) import this same function so
 * "what does this cadence imply" is computed in exactly one place. Keeping
 * it here, rather than inside database-clean.js, means a caller that only
 * needs this pure math never transitively pulls in Dexie / opens a live
 * database connection just by importing it.
 */
export function calculateNextDueDate(
  startDate,
  frequency,
  intervalValue = 1,
  intervalUnit = 'months',
) {
  // Ensure intervalValue is a valid number
  const validIntervalValue =
    Number.isInteger(intervalValue) && intervalValue > 0 ? intervalValue : 1;

  // Ensure intervalUnit is valid
  const validIntervalUnit = ['days', 'weeks', 'months', 'years'].includes(
    intervalUnit,
  )
    ? intervalUnit
    : 'months';

  const date = DateUtils.parseDate(startDate);
  if (!date || isNaN(date.getTime())) {
    throw new Error(`Invalid start date for recurring expense: ${startDate}`);
  }

  switch (frequency) {
    case 'monthly':
      date.setMonth(date.getMonth() + validIntervalValue);
      break;
    case 'quarterly': {
      const addMonths = 3 * validIntervalValue;
      date.setMonth(date.getMonth() + addMonths);
      break;
    }
    case 'biannually': {
      const addMonths = 6 * validIntervalValue;
      date.setMonth(date.getMonth() + addMonths);
      break;
    }
    case 'annually':
      date.setFullYear(date.getFullYear() + validIntervalValue);
      break;
    case 'custom':
      // Handle different interval units
      switch (validIntervalUnit) {
        case 'days':
          date.setDate(date.getDate() + validIntervalValue);
          break;
        case 'weeks': {
          const addDays = validIntervalValue * 7;
          date.setDate(date.getDate() + addDays);
          break;
        }
        case 'months':
          date.setMonth(date.getMonth() + validIntervalValue);
          break;
        case 'years':
          date.setFullYear(date.getFullYear() + validIntervalValue);
          break;
        default:
          // Fallback to months for backward compatibility
          date.setMonth(date.getMonth() + validIntervalValue);
      }
      break;
    default:
      throw new Error(`Unsupported frequency: ${frequency}`);
  }

  return DateUtils.formatDate(date);
}
