/**
 * What to show for a bill's category: its name, icon and color.
 *
 * A bill points at its category two ways: `categoryId` (stable) and
 * `category` (the name as text). Neither is always usable, which is why this
 * is not just a lookup:
 *
 * - `categoryId` is null on a bill created before ids existed, and on one
 *   whose category name had no match when it was created. Recurring bills
 *   materialized from a template never get one.
 * - The auto-created bills for a credit card or a loan are labeled
 *   'Credit Card Payment' / 'Loan Payment'. Those are not rows in the
 *   categories table, so they match nothing and get built-in looks.
 * - A bill can name a category that was deleted or never existed.
 *
 * Order: the id, then the name (ignoring case and spaces), then the two
 * built-ins, then the bill's own text shown as an uncolored tag, then
 * "No category". A stored category color is user data, so it is validated
 * before use and an unusable one falls back to neutral.
 */

export const NEUTRAL_RGB = '162, 169, 180';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

// The auto-created payment bills. Neutral on purpose: they are not a
// user-picked category, so they don't borrow one's color.
const BUILT_IN = {
  'credit card payment': { name: 'Card payment', icon: '💳' },
  'loan payment': { name: 'Loan payment', icon: '🏦' },
};

const normalize = text =>
  String(text ?? '')
    .trim()
    .toLowerCase();

/** '#EC4899' -> '236, 72, 153', or neutral if it isn't a usable hex color. */
export const hexToRgb = hex => {
  if (typeof hex !== 'string' || !HEX_COLOR.test(hex)) return NEUTRAL_RGB;
  const value = parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
};

/**
 * @param {Object} expense - a fixedExpenses row
 * @param {Array} categories - the categories table rows
 * @returns {{ name: string, icon: string, rgb: string, kind: 'category' |
 *   'built-in' | 'unlisted' | 'none' }}
 */
export const getCategoryDisplay = (expense, categories = []) => {
  const live = categories.filter(category => !category.deletedAt);

  const byId = expense.categoryId
    ? live.find(category => category.id === expense.categoryId)
    : null;
  const wanted = normalize(expense.category);
  const found =
    byId ??
    (wanted
      ? live.find(category => normalize(category.name) === wanted)
      : null);

  if (found) {
    return {
      name: found.name,
      icon: found.icon || '🏷️',
      rgb: hexToRgb(found.color),
      kind: 'category',
    };
  }

  const builtIn = BUILT_IN[wanted];
  if (builtIn) return { ...builtIn, rgb: NEUTRAL_RGB, kind: 'built-in' };

  if (wanted) {
    return {
      name: String(expense.category).trim(),
      icon: '🏷️',
      rgb: NEUTRAL_RGB,
      kind: 'unlisted',
    };
  }

  return { name: 'No category', icon: '🏷️', rgb: NEUTRAL_RGB, kind: 'none' };
};
