# Digibook - Local-First Finance Tracker

A modern, privacy-focused finance tracker built with React and IndexedDB for local-first data storage.

## Features

- **Local-First**: All data stored locally in your browser using IndexedDB
- **PIN Protection**: Secure your financial data with a PIN-based privacy lock
- **Account Management**: Track multiple accounts with projected balance calculations
- **Pending Transactions**: Manage upcoming financial movements
- **Liquid Glass UI**: Modern iOS-inspired design with glass morphism effects
- **Import/Export**: Backup and restore your data with JSON/CSV support
- **Audit Logging**: Track all changes with detailed activity logs

## Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS with custom Liquid Glass design system
- **Database**: IndexedDB via Dexie.js
- **Icons**: Lucide React
- **CSV Processing**: PapaParse

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

## Usage

### First Time Setup

1. **Set PIN**: Create a PIN to secure your financial data
2. **Add Accounts**: Create your first account (checking, savings, etc.)
3. **Add Transactions**: Track pending transactions for accurate balance projections

### Key Features

- **Sidebar Navigation**: Persistent sidebar with account overview and navigation
- **Inline Editing**: Click on table cells to edit values directly
- **Default Account**: Set a default account for quick access
- **Projected Balances**: See future balances based on pending transactions
- **Data Export**: Export your data as JSON or CSV for backup
- **Audit Trail**: View detailed logs of all changes

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

- **Accounts**: Name, type, current balance, default status
- **Pending Transactions**: Account, amount, category, description, date
- **Fixed Expenses**: Recurring expense tracking (planned)
- **Audit Logs**: Change tracking and activity history

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Dexie.js** for IndexedDB wrapper
- **Lucide React** for beautiful icons
- **Tailwind CSS** for utility-first styling
- **Vite** for fast development experience 