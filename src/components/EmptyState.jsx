import PropTypes from 'prop-types';

const EmptyState = ({ illustration, title, subtitle, action }) => {
  return (
    <div className='flex flex-col items-center justify-center text-center py-12 px-6'>
      <div className='mb-6 opacity-90'>{illustration}</div>
      <h3 className='text-lg font-semibold text-white/90 mb-2 tracking-tight'>
        {title}
      </h3>
      {subtitle && (
        <p className='text-sm text-white/50 max-w-xs leading-relaxed mb-6'>
          {subtitle}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className='glass-button glass-button--primary flex items-center space-x-2'
        >
          {action.icon && action.icon}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
};

EmptyState.propTypes = {
  illustration: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  action: PropTypes.shape({
    label: PropTypes.string.isRequired,
    onClick: PropTypes.func.isRequired,
    icon: PropTypes.node,
  }),
};

EmptyState.defaultProps = {
  subtitle: null,
  action: null,
};

export default EmptyState;
