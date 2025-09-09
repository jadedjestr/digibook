/**
 * Unified Date Utilities for Digibook
 * Handles all date operations consistently in local time
 */

export class DateUtils {
  /**
   * Parse a date string (YYYY-MM-DD) to a Date object in local time
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @returns {Date} Date object in local time
   */
  static parseDate(dateString) {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed
  }

  /**
   * Format a Date object to YYYY-MM-DD string
   * @param {Date} date - Date object
   * @returns {string} Date in YYYY-MM-DD format
   */
  static formatDate(date) {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Format a date string for display (e.g., "Wednesday, Aug 6, 2025")
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @returns {string} Formatted date string
   */
  static formatDisplayDate(dateString) {
    if (!dateString) return 'Not set';
    const date = this.parseDate(dateString);
    if (!date) return 'Invalid date';

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  /**
   * Format a date string for short display (e.g., "Aug 6, 2025")
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @returns {string} Short formatted date string
   */
  static formatShortDate(dateString) {
    if (!dateString) return 'Not set';
    const date = this.parseDate(dateString);
    if (!date) return 'Invalid date';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  /**
   * Add days to a date string
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @param {number} days - Number of days to add
   * @returns {string} New date in YYYY-MM-DD format
   */
  static addDays(dateString, days) {
    const date = this.parseDate(dateString);
    if (!date) return null;

    date.setDate(date.getDate() + days);
    return this.formatDate(date);
  }

  /**
   * Calculate days between two date strings
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {number} Number of days between dates
   */
  static daysBetween(startDate, endDate) {
    const start = this.parseDate(startDate);
    const end = this.parseDate(endDate);

    if (!start || !end) return null;

    // Reset time to start of day for accurate calculation
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diffTime = end - start;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Get today's date as YYYY-MM-DD string
   * @returns {string} Today's date
   */
  static today() {
    return this.formatDate(new Date());
  }

  /**
   * Check if a date string is in the past
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @returns {boolean} True if date is in the past
   */
  static isPast(dateString) {
    const date = this.parseDate(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return date < today;
  }

  /**
   * Check if a date string is today
   * @param {string} dateString - Date in YYYY-MM-DD format
   * @returns {boolean} True if date is today
   */
  static isToday(dateString) {
    const date = this.parseDate(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return date.getTime() === today.getTime();
  }

  /**
   * Validate if a string is a valid date in YYYY-MM-DD format
   * @param {string} dateString - Date string to validate
   * @returns {boolean} True if valid date
   */
  static isValidDate(dateString) {
    if (!dateString || typeof dateString !== 'string') return false;

    const date = this.parseDate(dateString);
    if (!date) return false;

    // Check if the parsed date matches the original string
    return this.formatDate(date) === dateString;
  }
}
