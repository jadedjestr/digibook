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
- **Performance Tab**: Performance profiling
- **Application/Storage Tab**: Inspect IndexedDB (`DigibookDB_Fresh`) and localStorage directly
- **Console**: Enhanced logging with custom logger

Note: the Zustand store (`src/stores/useAppStore.js`) only wires up the `persist` middleware, not `devtools` - Redux DevTools won't show anything for it.

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
4. **Virtual Scrolling** for large lists (not currently implemented; can be added if needed for 100+ items)
5. **Lazy Loading** for route components

## 🔍 **Code Quality**

### **Automated Quality Checks**
- **ESLint**: Code quality and consistency
- **Prettier**: Code formatting
- **Husky**: Pre-commit hooks
- **Commitlint**: Commit message validation
- **TypeScript**: Type checking (when enabled)

### **Quality Gates**
Enforced by `npm run quality` (lint → format:check → test:run):
- [ ] ESLint checks (0 errors, 0 warnings) - `--max-warnings 0`, so any warning fails the command
- [ ] Prettier formatting
- [ ] Full test suite passing

Not currently enforced by any script or CI: test coverage thresholds, performance benchmarks, accessibility audits. Run manually if needed (`npm run test:coverage`, Storybook's a11y addon).

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
- **JSDoc**: Function and component documentation, read directly from source (there's no JSDoc-extraction build step)
- **README**: Project overview and setup
- **Component Docs**: Storybook stories
- **PRD.md**: Full architecture, database schema, and feature reference

### **Architecture Documentation**
See `PRD.md` for component structure, state management, database schema, and service layer architecture.

## 🔒 **Security**

Digibook is local-first with no backend - there's no server session, no cookies, and no network calls for data, so CSRF and HTTP security headers don't apply here. What's actually relevant:

### **Development Security**
- **Input Validation**: All user inputs validated (`src/utils/validation.js`)
- **XSS Prevention**: Sanitized user content

### **Data Protection**
- **PIN Protection**: PIN encrypted at rest via Web Crypto API (`src/utils/crypto.js`)
- **Backup Integrity**: SHA-256 checksums on local backups

## 🎯 **Best Practices**

### **Code Organization**
1. **Single Responsibility**: Each function/component has one purpose
2. **DRY Principle**: Don't repeat yourself
3. **Consistent Naming**: Follow established conventions
4. **Proper Imports**: Organized import statements

### **Performance**
1. **Lazy Loading**: Load components when needed
2. **Memoization**: Cache expensive calculations
3. **Virtual Scrolling**: Consider for very large datasets (100+ items) - not currently implemented
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
