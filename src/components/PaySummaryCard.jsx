import React from 'react';
import { DollarSign } from 'lucide-react';

const PaySummaryCard = ({ payThisWeekTotal, payNextCheckTotal }) => {
  return (
    <div className="glass-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-secondary">Payment Summary</h3>
        <DollarSign size={16} className="text-secondary" />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-300 mb-1">
            ${payThisWeekTotal.toFixed(2)}
          </div>
          <div className="text-xs text-secondary">Pay This Week</div>
        </div>
        
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-300 mb-1">
            ${payNextCheckTotal.toFixed(2)}
          </div>
          <div className="text-xs text-secondary">Pay with Next Check</div>
        </div>
      </div>
    </div>
  );
};

export default PaySummaryCard; 