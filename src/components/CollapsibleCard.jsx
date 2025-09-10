import { ChevronDown } from 'lucide-react';
import PropTypes from 'prop-types';
import { useState, useRef, useEffect } from 'react';

const CollapsibleCard = ({
  title,
  icon: Icon,
  children,
  defaultExpanded = false,
  onToggle,
  className = '',
  headerClassName = '',
  contentClassName = '',
  exclusive = false,
  onExclusiveToggle,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef(null);

  // Update content height when children change
  useEffect(() => {
    if (contentRef.current && isExpanded) {
      const observer = new ResizeObserver(entries => {
        for (let entry of entries) {
          setContentHeight(entry.target.scrollHeight);
        }
      });

      observer.observe(contentRef.current);

      // Initial height setting
      setContentHeight(contentRef.current.scrollHeight);

      return () => observer.disconnect();
    }
  }, [children, isExpanded]);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    // Call onToggle callback if provided
    if (onToggle) {
      onToggle(newExpanded);
    }

    // Handle exclusive expansion
    if (exclusive && onExclusiveToggle) {
      onExclusiveToggle(newExpanded ? title : null);
    }
  };

  const handleKeyDown = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleToggle();
    }
  };

  return (
    <div className={`glass-panel ${className}`}>
      {/* Header */}
      <div
        className={`
          collapsible-card-header
          flex items-center justify-between cursor-pointer
          rounded-lg p-2 -m-2
          focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-transparent
          ${headerClassName}
        `}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role='button'
        aria-expanded={isExpanded}
        aria-controls={`collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
        <div className='flex items-center space-x-3'>
          {Icon && <Icon size={20} className='text-primary' />}
          <h3 className='text-lg font-semibold text-primary'>{title}</h3>
        </div>

        <ChevronDown
          size={20}
          className={`
            collapsible-card-chevron text-primary
            ${isExpanded ? 'expanded' : 'collapsed'}
          `}
          aria-hidden='true'
        />
      </div>

      {/* Content */}
      <div
        id={`collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
        className={`
          collapsible-card-content
          ${isExpanded ? 'opacity-100' : 'opacity-0'}
          ${contentClassName}
        `}
        style={{
          maxHeight: isExpanded
            ? contentHeight > 0
              ? `${contentHeight}px`
              : 'none'
            : '0px',
          marginTop: isExpanded ? '1rem' : '0px',
          overflow: isExpanded ? 'visible' : 'hidden',
        }}
      >
        <div ref={contentRef} className='space-y-4'>
          {children}
        </div>
      </div>
    </div>
  );
};

CollapsibleCard.propTypes = {
  title: PropTypes.string.isRequired,
  icon: PropTypes.elementType,
  children: PropTypes.node.isRequired,
  defaultExpanded: PropTypes.bool,
  onToggle: PropTypes.func,
  className: PropTypes.string,
  headerClassName: PropTypes.string,
  contentClassName: PropTypes.string,
  exclusive: PropTypes.bool,
  onExclusiveToggle: PropTypes.func,
};

export default CollapsibleCard;
