import React from 'react';
import EnhancedCreditCard from './EnhancedCreditCard';

const CreditCardDemo = () => {
  // Sample data to demonstrate different status scenarios
  const demoCards = [
    {
      id: 'demo-1',
      name: 'Apple Card',
      balance: 2833.82,
      creditLimit: 3150.00,
      interestRate: 26.24,
      dueDate: '2025-01-15',
      minimumPayment: 160.00,
      statementClosingDate: '2025-01-10',
      utilization: 89.96,
      daysUntilDue: 9
    },
    {
      id: 'demo-2',
      name: 'Chase Freedom',
      balance: 1250.00,
      creditLimit: 5000.00,
      interestRate: 18.99,
      dueDate: '2025-01-25',
      minimumPayment: 35.00,
      statementClosingDate: '2025-01-20',
      utilization: 25.00,
      daysUntilDue: 19
    },
    {
      id: 'demo-3',
      name: 'Amex Gold',
      balance: 4500.00,
      creditLimit: 8000.00,
      interestRate: 22.99,
      dueDate: '2025-01-08',
      minimumPayment: 150.00,
      statementClosingDate: '2025-01-03',
      utilization: 56.25,
      daysUntilDue: 2
    }
  ];

  const handleEdit = (card) => {
    console.log('Edit card:', card.name);
  };

  const handleDelete = (card) => {
    console.log('Delete card:', card.name);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white mb-4">Credit Card Design Demo</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {demoCards.map((card, index) => (
          <EnhancedCreditCard
            key={card.id}
            card={card}
            onEdit={handleEdit}
            onDelete={handleDelete}
            index={index}
          />
        ))}
      </div>
    </div>
  );
};

export default CreditCardDemo;
