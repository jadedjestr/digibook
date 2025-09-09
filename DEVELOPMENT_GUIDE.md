# Digibook Development Guide

## 🚀 **Getting Started**

### **Prerequisites**
- Node.js 18+
- npm 9+
- Git

### **Initial Setup**
```bash
# Clone the repository
git clone <repository-url>
cd digibook

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Run quality checks
npm run quality
```

## 🛠️ **Development Tools**

### **Available Scripts**
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests in watch mode
- `npm run test:ui` - Run tests with UI
- `npm run test:run` - Run tests once
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Check code quality
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run quality` - Run all quality checks
- `npm run storybook` - Start Storybook for component documentation
- `npm run build-storybook` - Build Storybook for deployment

### **Development Environment**
- **Hot Reload**: Automatic reload on file changes
- **Source Maps**: Full source mapping for debugging
- **Error Overlay**: Detailed error information in browser
- **Performance Monitoring**: Built-in performance tracking

## 🔧 **Debugging Tools**

### **Browser DevTools**
- **React DevTools**: Component tree inspection
- **Redux DevTools**: State management debugging (Zustand compatible)
- **Performance Tab**: Performance profiling
- **Network Tab**: API call monitoring
- **Console**: Enhanced logging with custom logger

### **VS Code Extensions**
Recommended extensions for optimal development experience:

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode.vscode-markdown"
  ]
}
```

### **VS Code Settings**
Create `.vscode/settings.json` for consistent development:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": ["javascript", "javascriptreact"],
  "prettier.requireConfig": true,
  "tailwindCSS.includeLanguages": {
    "javascript": "javascript",
    "html": "HTML"
  },
  "emmet.includeLanguages": {
    "javascript": "javascriptreact"
  }
}
```

## 🧪 **Testing Strategy**

### **Test Structure**
```
src/
├── components/
│   ├── __tests__/
│   │   ├── ComponentName.test.jsx
│   │   └── ComponentName.performance.test.jsx
│   └── ComponentName.jsx
├── utils/
│   ├── __tests__/
│   │   └── utilityName.test.js
│   └── utilityName.js
└── test/
    └── setup.js
```

### **Testing Commands**
```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test -- ComponentName.test.jsx

# Run tests in watch mode
npm run test -- --watch

# Run performance tests
npm run test -- --grep "performance"
```

### **Test Utilities**
- **Mock Database**: `src/db/__tests__/mock-database.js`
- **Test Setup**: `src/test/setup.js`
- **Custom Matchers**: Enhanced assertions for React components

## 📊 **Performance Monitoring**

### **Built-in Performance Tools**
- **Performance Dashboard**: Real-time performance metrics
- **Memory Usage Tracking**: Monitor memory consumption
- **Render Time Analysis**: Component render performance
- **Bundle Size Analysis**: Track bundle size changes

### **Performance Best Practices**
1. **Use React.memo()** for expensive components
2. **Implement useMemo()** for expensive calculations
3. **Use useCallback()** for event handlers
4. **Virtual Scrolling** for large lists
5. **Lazy Loading** for route components

## 🔍 **Code Quality**

### **Automated Quality Checks**
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting
- **Husky**: Pre-commit hooks
- **Commitlint**: Commit message validation
- **TypeScript**: Type checking (when enabled)

### **Quality Gates**
All code must pass:
- [ ] ESLint checks (0 errors, 0 warnings)
- [ ] Prettier formatting
- [ ] Test coverage (80%+)
- [ ] Performance benchmarks
- [ ] Accessibility compliance

## 🚀 **Deployment**

### **Build Process**
```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Build Storybook
npm run build-storybook
```

### **Environment Variables**
Create `.env.local` for local development:
```env
VITE_APP_ENV=development
VITE_APP_DEBUG=true
VITE_APP_LOG_LEVEL=debug
```

## 🐛 **Debugging Common Issues**

### **Build Issues**
- **Import Errors**: Check file paths and extensions
- **Type Errors**: Verify prop types and function signatures
- **Bundle Size**: Use bundle analyzer to identify large dependencies

### **Runtime Issues**
- **State Issues**: Use React DevTools to inspect state
- **Performance Issues**: Use Performance tab in DevTools
- **Network Issues**: Check Network tab for failed requests

### **Test Issues**
- **Mock Issues**: Verify mock implementations
- **Async Issues**: Use proper async/await patterns
- **Component Issues**: Check component props and state

## 📚 **Documentation**

### **Code Documentation**
- **JSDoc**: Function and component documentation
- **README**: Project overview and setup
- **API Docs**: Generated from JSDoc comments
- **Component Docs**: Storybook stories

### **Architecture Documentation**
- **Component Structure**: Component hierarchy and relationships
- **State Management**: Zustand store structure
- **Database Schema**: IndexedDB schema and relationships
- **API Design**: Service layer architecture

## 🔒 **Security**

### **Development Security**
- **Input Validation**: All user inputs validated
- **XSS Prevention**: Sanitized user content
- **CSRF Protection**: Token-based protection
- **Secure Headers**: Security headers configured

### **Data Protection**
- **Local Storage**: Encrypted sensitive data
- **PIN Protection**: Secure PIN storage
- **Backup Security**: Encrypted backups

## 🎯 **Best Practices**

### **Code Organization**
1. **Single Responsibility**: Each function/component has one purpose
2. **DRY Principle**: Don't repeat yourself
3. **Consistent Naming**: Follow established conventions
4. **Proper Imports**: Organized import statements

### **Performance**
1. **Lazy Loading**: Load components when needed
2. **Memoization**: Cache expensive calculations
3. **Virtual Scrolling**: Handle large datasets efficiently
4. **Bundle Optimization**: Minimize bundle size

### **Testing**
1. **Test Coverage**: Aim for 80%+ coverage
2. **Test Quality**: Write meaningful tests
3. **Mock External Dependencies**: Isolate units under test
4. **Performance Testing**: Test component performance

## 🆘 **Getting Help**

### **Resources**
- **Documentation**: Check project documentation first
- **Code Comments**: Read inline code comments
- **Test Examples**: Look at existing tests for patterns
- **Storybook**: Component usage examples

### **Debugging Steps**
1. **Check Console**: Look for error messages
2. **Check Network**: Verify API calls
3. **Check State**: Inspect component state
4. **Check Props**: Verify component props
5. **Check Tests**: Run tests to isolate issues

---

*This guide is continuously updated as the project evolves.*
