import React from 'react';

const StatusBadge = ({ status, className = '' }) => {
  const getStatusColor = (status) => {
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

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border status-badge ${getStatusColor(status)} ${className}`}>
      {status}
    </span>
  );
};

export default StatusBadge; 