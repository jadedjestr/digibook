import PropTypes from 'prop-types';

const StatusBadge = ({ status, className = '', variant = 'default' }) => {
  const getStatusColor = (status, variant) => {
    // Credit card specific statuses
    if (variant === 'credit-card') {
      switch (status) {
        case 'High Usage':
          return 'badge-danger';
        case 'Above Ideal':
          return 'badge-warning';
        case 'Good Standing':
          return 'badge-success';
        case 'Due Soon':
          return 'badge-danger';
        case 'Overdue':
          return 'badge-danger';
        case 'Payment Due':
          return 'badge-info';
        case 'Credit Balance':
          return 'badge-success';
        case 'Paid Off':
          return 'badge-success';
        default:
          return 'badge-info';
      }
    }

    // Loan specific statuses
    if (variant === 'loan') {
      switch (status) {
        case 'Paid Off':
          return 'badge-success';
        case 'Good Standing':
          return 'badge-success';
        case 'Due Soon':
          return 'badge-danger';
        case 'Overdue':
          return 'badge-danger';
        case 'Payment Due':
          return 'badge-info';
        default:
          return 'badge-info';
      }
    }

    // Original statuses for backward compatibility
    switch (status) {
      case 'Paid':
        return 'badge-success';
      case 'Resolved':
        return 'badge-success';
      case 'Balance Due':
        return 'badge-warning';
      case 'Partially Paid':
        return 'badge-warning';
      case 'Overdue':
        return 'badge-danger';
      case 'Pay This Week':
        return 'badge-warning';
      case 'Pay with Next Check':
        return 'badge-info';
      case 'Pay with Following Check':
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const baseClasses = (() => {
    if (variant === 'credit-card') return 'credit-card-badge';
    if (variant === 'loan') return 'loan-card-badge';
    return 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border status-badge';
  })();

  return (
    <span
      className={`${baseClasses} ${getStatusColor(status, variant)} ${className}`}
    >
      {status}
    </span>
  );
};

StatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
  className: PropTypes.string,
  variant: PropTypes.string,
};

export default StatusBadge;
