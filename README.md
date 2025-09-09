# Digibook - Local-First Finance Tracker

A modern, privacy-focused finance tracker built with React and IndexedDB for local-first data storage. Track your accounts, manage expenses, and plan your financial future with beautiful, intuitive design.

## ✨ Features

### 🏦 **Account Management**
- **Multiple Account Types**: Checking, savings, and credit card accounts
- **Real-time Balance Tracking**: Current balances with projected calculations
- **Smart Account Selection**: Context-aware account filtering for different expense types
- **Default Account**: Set your primary account for quick access

### 💳 **Credit Card Management**
- **Credit Card Tracking**: Monitor balances, limits, and utilization
- **Smart Link Expenses**: Automatically create fixed expenses for credit card payments
- **Debt Payoff Calculator**: Calculate payoff time and total interest
- **Payment Logic**: Proper money movement simulation (funding account → credit card)

### 📊 **Expense Management**
- **Fixed Expenses**: Track recurring bills and payments
- **Category System**: Organize expenses with customizable categories
- **Due Date Tracking**: Never miss a payment with smart due date management
- **Payment Status**: Track paid, pending, and overdue expenses

### 💰 **Financial Planning**
- **Projected Balance**: See your discretionary spending amount after bills
- **Paycheck Integration**: Plan expenses around your pay schedule
- **Overpayment Analysis**: Track budget vs. actual spending
- **Monthly Trends**: Visualize your spending patterns

### 🔒 **Privacy & Security**
- **Local-First**: All data stored locally in your browser using IndexedDB
- **PIN Protection**: Secure your financial data with a PIN-based privacy lock
- **No Cloud Sync**: Your financial data never leaves your device
- **Audit Logging**: Track all changes with detailed activity logs

### 🎨 **User Experience**
- **Liquid Glass UI**: Modern iOS-inspired design with glass morphism effects
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Inline Editing**: Click on table cells to edit values directly
- **Smart Notifications**: Contextual alerts and status updates

### 📁 **Data Management**
- **Import/Export**: Backup and restore your data with JSON/CSV support
- **Data Integrity**: Automatic backup creation with integrity verification
- **Category Management**: Create and customize expense categories
- **Performance Optimized**: Fast, responsive interface with memoized calculations

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS with custom Liquid Glass design system
- **Database**: IndexedDB via Dexie.js
- **State Management**: Zustand for global state
- **Icons**: Lucide React
- **CSV Processing**: PapaParse
- **Testing**: Vitest + React Testing Library
- **Code Quality**: ESLint + Prettier + Husky
- **Documentation**: Storybook for component documentation

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/jadedjestr/digibook.git
cd digibook
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

### Building for Production

```bash
npm run build
```

## 🚀 Usage

### First Time Setup

1. **Set PIN**: Create a PIN to secure your financial data
2. **Add Accounts**: Create your first account (checking, savings, etc.)
3. **Add Credit Cards**: Track credit card balances and limits
4. **Set Paycheck Schedule**: Configure your pay frequency for expense planning
5. **Add Fixed Expenses**: Set up recurring bills and payments

### Key Workflows

#### 💳 **Credit Card Management**
1. **Add Credit Card**: Enter card details, balance, and credit limit
2. **Smart Link Expenses**: Use the "Smart Link Expenses" button to auto-create payment expenses
3. **Debt Payoff Calculator**: Calculate payoff time and total interest
4. **Payment Tracking**: Mark payments as paid to update balances

#### 📊 **Expense Management**
1. **Add Fixed Expenses**: Create recurring bills with due dates
2. **Category Organization**: Use categories to organize your expenses
3. **Payment Status**: Track paid, pending, and overdue expenses
4. **Account Selection**: Choose funding accounts for each expense

#### 💰 **Financial Planning**
1. **Projected Balance**: View your discretionary spending amount after bills
2. **Paycheck Integration**: Plan expenses around your pay schedule
3. **Overpayment Analysis**: Monitor budget vs. actual spending
4. **Monthly Trends**: Analyze spending patterns over time

### Advanced Features

- **Smart Account Selection**: Context-aware filtering (credit card payments only use checking/savings)
- **Inline Editing**: Click on table cells to edit values directly
- **Data Export**: Export your data as JSON or CSV for backup
- **Audit Trail**: View detailed logs of all changes in Settings
- **Performance Monitoring**: Built-in performance tracking for optimal user experience

## Design System

Digibook uses a custom "Liquid Glass" design system inspired by iOS 26:

- **Glass Morphism**: `backdrop-filter: blur(14px)` with subtle transparency
- **Modern Typography**: High contrast text with proper hierarchy
- **Micro-interactions**: Smooth animations and hover effects
- **Accessibility**: WCAG AA compliant with proper focus indicators

## Data Privacy

- **Local Storage**: All data stays on your device
- **No Cloud Sync**: Your financial data never leaves your browser
- **PIN Protection**: Optional PIN lock for privacy
- **Export Control**: Full control over your data export

## Development

### Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Main application pages
├── db/           # Database configuration and helpers
└── index.css     # Global styles and Liquid Glass system
```

### Database Schema

- **Accounts**: Name, type, current balance, default status, creation date
- **Credit Cards**: Name, balance, credit limit, interest rate, due date, minimum payment
- **Fixed Expenses**: Name, due date, amount, account, category, payment status, overpayment tracking
- **Categories**: Name, color, icon, default status for expense organization
- **Pending Transactions**: Account, amount, category, description, creation date
- **Paycheck Settings**: Last paycheck date, frequency for expense planning
- **User Preferences**: Component-specific settings and customizations
- **Monthly Expense History**: Budget vs. actual tracking with overpayment analysis
- **Audit Logs**: Comprehensive change tracking with action types and entity details

## 🔄 Recent Improvements

### Version 2.0 Features
- **Smart Account Selection**: Fixed account selection logic to prioritize regular accounts over credit cards
- **Debt Payoff Calculator**: Fixed "N/A" months display and added proper payoff date calculations
- **Projected Balance Card**: Now shows actual discretionary spending amount from default account
- **Backup System**: Fixed checksum mismatch errors in import/export functionality
- **Credit Card Integration**: Enhanced payment logic with proper money movement simulation
- **Performance Optimization**: Added memoized calculations and performance monitoring
- **UI/UX Improvements**: Fixed dropdown cropping issues and improved button states

### Bug Fixes
- ✅ Account selection now correctly prioritizes checking/savings accounts
- ✅ Debt payoff calculator displays actual months instead of "N/A"
- ✅ Projected balance shows real discretionary spending amount
- ✅ Import/export system works without integrity verification errors
- ✅ Credit card payment logic properly simulates money movement
- ✅ Dropdown menus no longer get cropped in tables

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run Storybook for component development
npm run storybook
```

## 📚 Documentation

- **API Documentation**: See [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- **Development Guide**: See [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)
- **Code Style Guide**: See [CODE_STYLE_GUIDE.md](CODE_STYLE_GUIDE.md)
- **Testing Guide**: See [TESTING_GUIDE_PHASE_3.md](TESTING_GUIDE_PHASE_3.md)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Dexie.js** for IndexedDB wrapper and local-first data storage
- **Lucide React** for beautiful, consistent icons
- **Tailwind CSS** for utility-first styling and rapid development
- **Vite** for lightning-fast development experience
- **React 18** for modern component architecture
- **Zustand** for lightweight state management
- **Vitest** for fast, modern testing
- **Storybook** for component documentation and development
- **PapaParse** for robust CSV processing
- **Husky** for git hooks and code quality
