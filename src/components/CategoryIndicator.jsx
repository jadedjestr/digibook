import PropTypes from 'prop-types';
import { useMemo } from 'react';

import { useCategories } from '../stores/useAppStore';
import { getCategoryDisplay } from '../utils/categoryDisplay';

/**
 * The category's look for a bill: a picture chip (CategoryChip) and the
 * category word as a small tag (CategoryTag). They read the categories
 * straight from the store rather than taking them as a prop, so a list can
 * drop them in without threading the categories through every layer.
 *
 * The chip carries the accessible name; the tag repeats it as plain text for
 * sighted scanning, so it is hidden from screen readers rather than read
 * twice. Both are tinted with the category's own color, but the tag's words
 * stay the normal text color: a user-picked color can be too dark or too
 * light to read as text on this background.
 */
export const useCategoryDisplay = expense => {
  const categories = useCategories();
  return useMemo(
    () => getCategoryDisplay(expense, categories),
    [expense, categories],
  );
};

export const CategoryChip = ({ expense }) => {
  const display = useCategoryDisplay(expense);
  return (
    <span
      className='category-chip'
      role='img'
      aria-label={`Category: ${display.name}`}
      style={{ '--category-rgb': display.rgb }}
    >
      {display.icon}
    </span>
  );
};

export const CategoryTag = ({ expense }) => {
  const display = useCategoryDisplay(expense);
  return (
    <span
      className='category-tag'
      title={display.name}
      aria-hidden='true'
      style={{ '--category-rgb': display.rgb }}
    >
      {display.name}
    </span>
  );
};

const expenseShape = PropTypes.shape({
  category: PropTypes.string,
  categoryId: PropTypes.string,
}).isRequired;

CategoryChip.propTypes = { expense: expenseShape };
CategoryTag.propTypes = { expense: expenseShape };
