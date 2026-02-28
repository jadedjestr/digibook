import PropTypes from 'prop-types';
import { useState, useCallback } from 'react';

import CollapsibleCard from './CollapsibleCard';

const CollapsibleCardGroup = ({
  cards,
  defaultExpanded = null,
  className = '',
  exclusive = true,
}) => {
  const [_expandedCard, setExpandedCard] = useState(defaultExpanded);

  const handleExclusiveToggle = useCallback(
    cardTitle => {
      if (exclusive) {
        setExpandedCard(cardTitle);
      }
    },
    [exclusive],
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {cards.map((card, index) => (
        <CollapsibleCard
          key={card.title || index}
          title={card.title}
          icon={card.icon}
          defaultExpanded={card.defaultExpanded || false}
          exclusive={exclusive}
          onExclusiveToggle={handleExclusiveToggle}
          className={card.className}
          headerClassName={card.headerClassName}
          contentClassName={card.contentClassName}
        >
          {card.content}
        </CollapsibleCard>
      ))}
    </div>
  );
};

CollapsibleCardGroup.propTypes = {
  cards: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string,
      icon: PropTypes.elementType,
      defaultExpanded: PropTypes.bool,
      content: PropTypes.node,
      className: PropTypes.string,
      headerClassName: PropTypes.string,
      contentClassName: PropTypes.string,
    }),
  ).isRequired,
  defaultExpanded: PropTypes.string,
  className: PropTypes.string,
  exclusive: PropTypes.bool,
};

CollapsibleCardGroup.defaultProps = {
  defaultExpanded: null,
  className: '',
  exclusive: true,
};

export default CollapsibleCardGroup;
