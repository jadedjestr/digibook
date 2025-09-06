import React, { useState, useCallback } from 'react';
import CollapsibleCard from './CollapsibleCard';

const CollapsibleCardGroup = ({ 
  cards, 
  defaultExpanded = null,
  className = '',
  exclusive = true 
}) => {
  const [expandedCard, setExpandedCard] = useState(defaultExpanded);

  const handleExclusiveToggle = useCallback((cardTitle) => {
    if (exclusive) {
      setExpandedCard(cardTitle);
    }
  }, [exclusive]);

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

export default CollapsibleCardGroup;
