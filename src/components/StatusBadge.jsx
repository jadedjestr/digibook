import React from 'react';

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
        case 'Payment Due':
          return 'badge-info';
        default:
          return 'badge-info';
      }
    }

    // Original statuses for backward compatibility
    switch (status) {
      case 'Paid':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'Partially Paid':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'Overdue':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'Pay This Week':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'Pay with Next Check':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Pay with Following Check':
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const baseClasses =
    variant === 'credit-card'
      ? 'credit-card-badge'
      : 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border status-badge';

  return (
    <span
      className={`${baseClasses} ${getStatusColor(status, variant)} ${className}`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
