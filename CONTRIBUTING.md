# Contributing to D2R Arcane Tracker

Thank you for your interest in contributing to D2R Arcane Tracker! This document provides guidelines and information for contributors.

## 🤝 How to Contribute

We welcome contributions in many forms:

- 🐛 Bug reports
- ✨ Feature requests
- 📝 Documentation improvements
- 🧪 Test cases
- 🔧 Code improvements
- 🌐 Translation updates

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have:

- **Node.js** (v18 or higher)
- **Yarn** package manager
- **Git** for version control
- **Diablo II: Resurrected** (for testing game-related features)

### Technology Stack

This project uses modern web technologies:

- **Frontend**: React 18 + TypeScript + Tailwind CSS v4
- **Desktop**: Electron 30
- **Build Tool**: Vite + electron-vite
- **UI Components**: shadcn/ui (Radix UI primitives)
- **State Management**: Zustand
- **Database**: SQLite with better-sqlite3
- **Internationalization**: i18next
- **Code Quality**: Biome (linting, formatting, type checking)
- **Testing**: Vitest + Testing Library

### Development Setup

1. **Fork the repository**

   ```bash
   # Click the "Fork" button on GitHub, then clone your fork
   git clone https://github.com/YOUR_USERNAME/d2r-arcane-tracker.git
   cd d2r-arcane-tracker
   ```

2. **Add upstream remote**

   ```bash
   git remote add upstream https://github.com/hyperremix/d2r-arcane-tracker.git
   ```

3. **Install dependencies**

   ```bash
   yarn install
   ```

4. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   # or for bug fixes
   git checkout -b fix/your-bug-description
   ```

5. **Start development server**

   ```bash
   yarn dev
   ```

## 📦 Building

### Development Build

```bash
yarn build
```

### Production Build

```bash
yarn build
```

Built applications will be available in the `dist/` directory.

## 🛠️ Development Workflow

### Code Quality Standards

This project maintains high code quality standards using:

- **TypeScript**: Strict type checking enabled
- **Biome**: Linting, formatting, and static analysis
- **Vitest**: Comprehensive testing
- **Pre-commit hooks**: Automatic quality checks

### Available Scripts

| Command | Description |
|---------|-------------|
| `yarn dev` | Start development server with Electron |
| `yarn build` | Build the application for production |
| `yarn typecheck` | Run TypeScript type checking |
| `yarn test` | Run tests with Vitest |
| `yarn test:ui` | Open Vitest UI for interactive testing |
| `yarn test:coverage` | Run tests with coverage report |
| `yarn lint` | Run Biome linter |
| `yarn lint:fix` | Fix linting issues automatically |
| `yarn format` | Format code with Biome |
| `yarn format:fix` | Format and write changes |
| `yarn check` | Run all code quality checks |
| `yarn check:fix` | Fix all auto-fixable issues |

### Project Structure

```
d2r-arcane-tracker/
├── src/                    # React renderer process
│   ├── components/         # UI components
│   │   ├── grail/         # Holy Grail tracking components
│   │   ├── settings/      # Settings and configuration
│   │   └── ui/            # Reusable UI components (shadcn/ui)
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utility functions
│   ├── stores/            # Zustand state management
│   ├── i18n/              # Internationalization
│   └── fixtures/          # Test fixtures and builders
├── electron/              # Electron main process
│   ├── database/          # SQLite database management
│   ├── ipc-handlers/      # IPC communication handlers
│   └── services/          # Background services
├── public/                # Static assets
└── scripts/               # Build and utility scripts
```

## 📝 Making Changes

### Before You Start

1. **Check existing issues**: Look for similar issues or feature requests
2. **Discuss large changes**: Open an issue first for significant features
3. **Keep changes focused**: One feature/fix per pull request

### Code Style Guidelines

#### TypeScript

- Use strict TypeScript settings
- Prefer explicit types over `any`
- Use interfaces for object shapes
- Follow the existing naming conventions

#### React Components

- Use functional components with hooks
- Follow the component patterns in existing code
- Use proper prop typing
- Implement proper error boundaries

#### Styling

- Use Tailwind CSS classes
- Follow the shadcn/ui component patterns
- Maintain consistent spacing and typography
- Ensure responsive design

#### File Organization

- Place components in appropriate directories
- Use index files for clean exports
- Follow the established import patterns
- Use absolute imports with `@/` prefix

### Testing Requirements

All contributions must include appropriate tests:

```bash
# Run tests before committing
yarn test

# Check test coverage
yarn test:coverage

# Run tests in watch mode during development
yarn test --watch
```

#### Test Guidelines

- Write unit tests for utility functions
- Test React components with Testing Library
- Mock external dependencies appropriately
- Aim for meaningful test coverage
- Include edge cases and error conditions

### Commit Message Format

Use conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(grail): add advanced search functionality
fix(database): resolve SQLite connection issue
docs(readme): update installation instructions
test(utils): add tests for ethereal item detection
```

## 🔄 Pull Request Process

### Before Submitting

1. **Run quality checks**

   ```bash
   yarn check
   yarn test
   yarn typecheck
   ```

2. **Update documentation** if needed
3. **Add tests** for new functionality
4. **Update CHANGELOG.md** for significant changes

### Submitting a Pull Request

1. **Push your changes**

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request** on GitHub with:
   - Clear, descriptive title
   - Detailed description of changes
   - Reference to related issues
   - Screenshots for UI changes
   - Testing instructions

3. **Fill out the PR template** completely

### Pull Request Review Process

1. **Automated checks** must pass (CI/CD)
2. **Code review** by maintainers
3. **Testing** by maintainers
4. **Approval** from at least one maintainer
5. **Merge** by maintainers

### PR Requirements

- ✅ All tests pass
- ✅ Code quality checks pass
- ✅ TypeScript compilation successful
- ✅ No linting errors
- ✅ Documentation updated if needed
- ✅ Commits follow conventional format
- ✅ PR description is complete

## 🐛 Reporting Issues

### Bug Reports

When reporting bugs, please include:

1. **Clear title** describing the issue
2. **Steps to reproduce** the problem
3. **Expected behavior** vs actual behavior
4. **Environment details**:
   - Operating system
   - Node.js version
   - App version
   - D2R version
5. **Screenshots** or error messages
6. **Log files** if available

### Feature Requests

For feature requests, please provide:

1. **Clear description** of the feature
2. **Use case** and motivation
3. **Proposed solution** (if you have one)
4. **Alternatives considered**
5. **Additional context** or examples

## 🧪 Testing

### Running Tests

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test --watch

# Run tests with UI
yarn test:ui

# Generate coverage report
yarn test:coverage
```

### Writing Tests

- Use **Vitest** as the test runner
- Use **Testing Library** for React component testing
- Place tests next to the code they test (`.test.ts` or `.test.tsx`)
- Use descriptive test names
- Follow the AAA pattern (Arrange, Act, Assert)

### Test Structure

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComponentName } from './ComponentName'

describe('ComponentName', () => {
  it('should render correctly', () => {
    // Arrange
    const props = { /* test props */ }
    
    // Act
    render(<ComponentName {...props} />)
    
    // Assert
    expect(screen.getByText('Expected text')).toBeInTheDocument()
  })
})
```

## 🌐 Internationalization

### Adding Translations

1. **Update translation files** in `src/i18n/locales/`
2. **Use translation keys** in components:

   ```typescript
   import { useTranslation } from 'react-i18next'
   
   const { t } = useTranslation()
   return <div>{t('common.welcome')}</div>
   ```

3. **Test with different languages**
4. **Update translation types** if needed

## 🔧 Development Tools

### Debugging

- Use Electron DevTools for renderer debugging
- Use Node.js debugging for main process
- Check console logs for runtime errors
- Use React Developer Tools

## 📚 Additional Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vitest Documentation](https://vitest.dev/)
- [shadcn/ui Documentation](https://ui.shadcn.com/)

## 🤝 Community Guidelines

### Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:

- Be respectful and constructive
- Focus on the issue, not the person
- Help others learn and improve
- Follow the [Contributor Covenant](https://www.contributor-covenant.org/)

### Getting Help

- 💬 **Discussions**: Use GitHub Discussions for questions
- 🐛 **Issues**: Report bugs and feature requests
- 📖 **Documentation**: Check existing docs first
- 🔍 **Search**: Look for existing issues and discussions

## 🏆 Recognition

Contributors will be:

- Listed in the project's AUTHORS.md
- Recognized in release notes for significant contributions
- Given credit in the application's about section

## 📞 Contact

- **Maintainer**: [hyperremix](https://github.com/hyperremix)
- **Issues**: [GitHub Issues](https://github.com/hyperremix/d2r-arcane-tracker/issues)
- **Discussions**: [GitHub Discussions](https://github.com/hyperremix/d2r-arcane-tracker/discussions)

---

Thank you for contributing to D2R Arcane Tracker! 🎮✨
