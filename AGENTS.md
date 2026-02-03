# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 1. Project Overview

**Diablo 2 Resurrected Arcane Tracker** is an Electron application built with Vite, React, TypeScript, and Tailwind CSS. The project uses a dual-tsconfig setup for web (renderer) and Node.js (main) processes.

### Main Features

- **Holy Grail Tracking**: Track unique items, set items, runes, and runewords
- **Save File Monitoring**: Automatic detection and parsing of D2R save files
- **Runeword Calculator**: View all runewords and see which ones you can craft based on available runes
- **Terror Zone Configuration**: Customize which terror zones are active in your D2R installation
- **Statistics Dashboard**: Comprehensive analytics and progress tracking
- **Smart Notifications**: In-app and native notifications for new item discoveries

### Technology Stack

- **Frontend**: React 18 with TypeScript, styled with Tailwind CSS v4
- **Backend**: Electron main process (Node.js environment)
- **Build System**: Vite with electron-vite for development and building
- **UI Components**: shadcn/ui components (New York style) using Radix UI primitives and class-variance-authority
- **State Management**: Zustand for global state
- **Database**: better-sqlite3 with Drizzle ORM
- **Internationalization**: i18next with browser language detection
- **Testing**: Vitest for unit and component testing
- **Code Quality**: Biome for linting, formatting, and static analysis
- **Package Manager**: Bun (specified in packageManager field)

## 2. Quick Start & Commands

### Development

- **`bun run dev`**: Start development server with Electron rebuild for better-sqlite3
- **`bun run preview`**: Preview the built application

### Building

- **`bun run build`**: Type check, build, and package for all platforms
- **`bun run build:win`**: Build and package for Windows
- **`bun run build:mac`**: Build and package for macOS
- **`bun run build:linux`**: Build and package for Linux

### Code Quality (must pass before task completion)

- **`bun run typecheck`**: Run TypeScript type checking for both web and node configs
- **`bun run typecheck:web`**: Type check web TypeScript files only
- **`bun run typecheck:node`**: Type check Node.js TypeScript files only
- **`bun run format`**: Check code formatting with Biome
- **`bun run format:fix`**: Fix code formatting issues
- **`bun run lint`**: Check code for linting issues
- **`bun run lint:fix`**: Fix linting issues automatically
- **`bun run check`**: Run both linting and formatting checks
- **`bun run check:fix`**: Fix both linting and formatting issues

### Testing

- **`bun run test`**: Run tests in watch mode
- **`bun run test:ui`**: Run tests with UI interface
- **`bun run test:run`**: Run tests once and exit
- **`bun run test:coverage`**: Run tests with coverage report

### Setup & Utilities

- **`bun run prepare`**: Setup Husky git hooks
- **`bun run seed:test`**: Setup native modules and seed test data

### Task Completion Criteria

**All of the following commands MUST pass successfully before any task can be considered complete:**

1. **`bun run typecheck`** - TypeScript type checking must pass without errors
2. **`bun run format`** - Code formatting check must pass (no formatting issues)
3. **`bun run lint`** - Linting check must pass without warnings or errors
4. **`bun run check`** - Combined linting and formatting check must pass
5. **`bun run test:run`** - All tests must pass without failures

**Note**: These commands should be run in sequence and all must succeed. If any command fails, the task is not complete and the issues must be resolved before proceeding.

## 3. TypeScript Configuration

- `tsconfig.json` - Web/renderer configuration (includes src/, electron/)
- `tsconfig.node.json` - Node.js configuration for build tools
- Both configs use path mapping `@/*` → `./src/*` for imports

### Import/Export Patterns

- Use named exports for components and utilities
- Group imports: external libraries, internal modules, relative imports
- Use absolute imports with `@/` prefix for internal modules
- Import types with `type` keyword when possible

**Example:**

```typescript
import type { ComponentProps } from 'electron/types/grail';
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useGrailStore } from '@/stores/grailStore';
```

### Type Definitions

- Define interfaces in the same file as components when used only locally
- Export interfaces from `electron/types/` for shared types
- Use `type` for unions and intersections, `interface` for object shapes
- Prefer `undefined` over `null` for optional values

## 4. Project Structure

### Directory Layout

- `src/components/grail/` - Core grail tracking components (ItemCard, ItemGrid, GrailTracker, etc.)
- `src/components/settings/` - Settings-related components (Settings, Database, GameModeSettings, etc.)
- `src/components/ui/` - Reusable shadcn/ui components (Button, Card, Tooltip, etc.)
- `src/stores/` - Zustand state management
- `src/hooks/` - Custom React hooks
- `src/lib/` - Utility functions and helpers
- `electron/` - Electron main process code
- `electron/database/` - SQLite database management with Drizzle ORM
- `electron/ipc-handlers/` - IPC communication handlers
- `electron/services/` - Background services (item detection, save file monitoring)

### File Naming Conventions

- **Components**: PascalCase (e.g., `ItemCard.tsx`)
- **Utilities/Hooks**: camelCase (e.g., `utils.ts`, `useGrail.ts`)
- **Types**: camelCase (e.g., `grail.ts`)

### Import Patterns by Directory

- UI components: `@/components/ui/*`
- Grail components: `@/components/grail/*`
- Settings components: `@/components/settings/*`
- Stores: `@/stores/*`
- Utils: `@/lib/*`
- Electron types: `electron/types/*`

## 5. React Component Patterns

### Component Structure

```typescript
// 1. Imports (external, internal, relative)
import type { ComponentProps } from 'electron/types/grail';
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useGrailStore } from '@/stores/grailStore';

// 2. Interfaces
interface ComponentProps {
  // Define props here
}

// 3. Helper functions (if needed)
function helperFunction() {
  // Helper logic
}

// 4. Main component
export function Component({ prop1, prop2 }: ComponentProps) {
  // Component logic
  return (
    // JSX
  );
}
```

### Component Guidelines

- **Single Responsibility**: Each component should have one clear purpose
- **Props Interface**: Always define TypeScript interfaces for component props
- **Default Props**: Use default parameters instead of defaultProps
- **Event Handlers**: Use `useCallback` for event handlers passed to children
- **Conditional Rendering**: Use early returns for conditional rendering
- **Fragment Usage**: Use `<>` for simple fragments, `<Fragment>` when keys are needed

### State Management

- **Local State**: Use `useState` for component-specific state
- **Global State**: Use Zustand store for shared state
- **Derived State**: Use `useMemo` for computed values
- **Side Effects**: Use `useEffect` with proper dependency arrays
- **Custom Hooks**: Create custom hooks for complex state logic (e.g., `useProgressLookup`)

### Performance Optimization

- **Memoization**: Use `useMemo` for expensive calculations
- **Callback Memoization**: Use `useCallback` for stable function references
- **Component Memoization**: Use `React.memo` for components with stable props
- **Avoid Inline Objects**: Don't create objects/arrays in render methods

### Accessibility

- **Semantic HTML**: Use appropriate HTML elements
- **ARIA Labels**: Add ARIA labels for screen readers
- **Keyboard Navigation**: Support keyboard interactions
- **Focus Management**: Handle focus appropriately

### Error Boundaries

- **Error Handling**: Wrap components in error boundaries when appropriate
- **Loading States**: Show loading indicators for async operations
- **Error States**: Display meaningful error messages
- **Fallback UI**: Provide fallback content for failed operations

## 6. UI Components (shadcn/Tailwind)

### Shadcn/UI Integration

- **Base Components**: Use shadcn/ui as the foundation
- **Customization**: Extend shadcn components with custom styling
- **Consistency**: Maintain consistent design patterns
- **Accessibility**: Preserve accessibility features from shadcn

### Component Structure for UI Components

```typescript
import * as React from 'react';
import { cn } from '@/lib/utils';

interface ComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  // Component-specific props
}

const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('base-classes', className)}
        {...props}
      />
    );
  }
);

Component.displayName = 'Component';

export { Component };
```

### Styling Conventions

- **Tailwind CSS**: Use Tailwind for all styling
- **Class Merging**: Use `cn()` utility for conditional classes
- **Responsive Design**: Use responsive prefixes (sm:, md:, lg:, xl:)
- **Dark Mode**: Support dark mode with `dark:` prefix
- **Consistent Spacing**: Use consistent spacing scale

### UI Component Patterns

- **Forward Refs**: Always use `React.forwardRef` for components that render DOM elements
- **Display Names**: Set display names for better debugging
- **Props Spreading**: Spread HTML attributes for flexibility
- **Class Merging**: Merge custom classes with base classes

## 7. Electron Patterns

### IPC Communication

- **Main Process**: Handle IPC events in `electron/ipc-handlers/`
- **Renderer Process**: Use preload script for secure IPC communication
- **Type Safety**: Define IPC types in `electron/types/electron.d.ts`
- **Error Handling**: Always handle errors in IPC handlers

### Database Management

- **SQLite**: Use `better-sqlite3` for database operations
- **ORM**: Use Drizzle ORM for type-safe database queries
- **Schema**: Define database schema in `electron/database/drizzle/schema/`
- **Migrations**: Use migration files for schema changes
- **Transactions**: Use database transactions for multi-step operations

### File System Operations

- **Path Handling**: Use `node:path` for cross-platform path operations
- **File Watching**: Use `chokidar` for file system monitoring
- **Error Handling**: Handle file system errors gracefully
- **Permissions**: Check file permissions before operations

### Service Architecture

- **Background Services**: Implement services in `electron/services/`
- **Event Emission**: Use EventEmitter for service communication
- **Lifecycle Management**: Properly initialize and cleanup services
- **Error Recovery**: Implement retry logic for failed operations

### Security Considerations

- **Preload Script**: Expose only necessary APIs to renderer
- **Context Isolation**: Keep main and renderer processes isolated
- **Input Validation**: Validate all inputs from renderer process
- **File Access**: Restrict file access to necessary directories

### Performance

- **Async Operations**: Use async/await for non-blocking operations
- **Memory Management**: Properly dispose of resources
- **Event Cleanup**: Remove event listeners to prevent memory leaks
- **Database Optimization**: Use prepared statements for repeated queries

### Key Development Notes

- The main process uses standard Node.js imports (no protocol enforcement)
- Renderer process enforces Node.js import protocols
- Uses ESM modules throughout
- Vite handles HMR for renderer, electron-vite handles main process reloading
- The app icon is located at `public/logo.png`

## 8. Holy Grail Domain Logic

### Core Data Models

- **HolyGrailItem**: Static item data structure (id, name, type, category, etc.)
- **GrailProgress**: User progress tracking for items (found status, character attribution)
- **Character**: Character information
- **Settings**: Application configuration (grailEthereal, game mode, notifications, etc.)

### Item Detection Flow

1. **Save File Monitoring**: Watch for D2R save file changes (.d2s, .sss, .d2x, .d2i)
2. **Item Detection**: Parse and extract items from save files
3. **Item Matching**: Match detected items to grail items
4. **Progress Update**: Update database with new discoveries
5. **UI Update**: Refresh UI with new progress data
6. **Statistics Update**: Recalculate completion statistics

### Database Schema

- **Items Table**: Static grail items data
- **Characters Table**: Character information
- **Grail Progress Table**: Item discovery progress (normal and ethereal tracked separately)
- **Settings Table**: Application settings

### Settings Integration

- **Grail Configuration**: Normal/ethereal, runes, runewords
- **Game Mode**: Softcore, hardcore, both, manual
- **Game Version**: Classic vs Resurrected
- **Notifications**: Sound, in-app, native notifications

### UI Patterns

- **Item Cards**: Display items with progress indicators
- **Grid/List Views**: Toggle between grid and list layouts
- **Status Indicators**: Show completion status and recent discoveries
- **Character Attribution**: Show which character found items

### Performance Considerations

- **Large Datasets**: Handle thousands of items efficiently
- **Real-time Updates**: Update UI when new items are discovered
- **Filtering**: Efficient filtering based on multiple criteria
- **Grouping**: Group items by category, type, or completion status

### Error Handling

- **Save File Errors**: Handle corrupted or invalid save files
- **Database Errors**: Handle constraint violations and connection issues
- **Item Detection Errors**: Handle parsing and matching errors
- **UI Errors**: Handle rendering and state errors gracefully

## 9. Unit Testing (Vitest)

### Test Structure - "When, If, Then" Pattern

```typescript
describe('When [FUNCTION_NAME] is called', () => {
  describe('If [CONDITION_1]', () => {
    it('Then [EXPECTED_OUTCOME_1]', () => {
      // Arrange - Set up test data, mocks, and initial state
      // Act - Execute the function or action being tested
      // Assert - Verify the expected outcome
    });
  });

  describe('If [CONDITION_2]', () => {
    it('Then [EXPECTED_OUTCOME_2]', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### AAA Pattern (Arrange, Act, Assert)

Every test function must be structured with clear sections:

```typescript
it('Then should return expected result', () => {
  // Arrange - Set up test data, mocks, and initial state
  const input = 'test input';
  const expectedOutput = 'expected output';

  // Act - Execute the function or action being tested
  const result = functionUnderTest(input);

  // Assert - Verify the expected outcome
  expect(result).toBe(expectedOutput);
});
```

### Single Assertion Rule

Each test should verify only one specific behavior:

```typescript
// ✅ Good - Single assertion
it('Then should return true for valid input', () => {
  // Arrange
  const input = 'valid';

  // Act
  const result = isValid(input);

  // Assert
  expect(result).toBe(true);
});

// ❌ Bad - Multiple assertions testing different scenarios
it('Then should handle various inputs', () => {
  expect(isValid('valid')).toBe(true);    // First scenario
  expect(isValid('invalid')).toBe(false); // Second scenario - violates rule
});
```

### Test Setup and Mocking

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Use vi for mocking
const mockFunction = vi.fn();

// Use beforeEach/afterEach for setup/cleanup
beforeEach(() => {
  // Setup before each test
});

afterEach(() => {
  // Cleanup after each test
  vi.clearAllMocks();
});

// Mock external dependencies
vi.mock('@/stores/grailStore', () => ({
  useGrailStore: vi.fn(() => ({
    settings: { grailEthereal: false },
    setSettings: vi.fn(),
  })),
}));
```

### Component Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

describe('When ItemCard component is rendered', () => {
  describe('If item has no progress', () => {
    it('Then should display item name', () => {
      // Arrange
      const item = { id: 'test-item', name: 'Test Item', type: 'unique' };
      const props = { item, normalProgress: [], etherealProgress: [] };

      // Act
      render(<ItemCard {...props} />);

      // Assert
      expect(screen.getByText('Test Item')).toBeInTheDocument();
    });
  });
});
```

### Test Data Builder Pattern

When test fixtures are necessary, use the builder pattern for complex data structures:

```typescript
class HolyGrailItemBuilder {
  private item: HolyGrailItem = {
    id: 'default-item',
    name: 'Default Item',
    type: 'unique',
    // ... other default properties
  };

  static new(): HolyGrailItemBuilder {
    return new HolyGrailItemBuilder();
  }

  withId(id: string): this {
    this.item.id = id;
    return this;
  }

  withName(name: string): this {
    this.item.name = name;
    return this;
  }

  build(): HolyGrailItem {
    return this.item;
  }
}

// Usage
const testItem = HolyGrailItemBuilder.new()
  .withId('test-item')
  .withName('Test Item')
  .build();
```

### Test Organization

- **File Naming**: Use `.test.ts` or `.test.tsx` extensions
- **File Location**: Place tests in the same directory as source files or in a `__tests__` directory
- **Test Categories**: Group related tests in describe blocks

### Best Practices

- **Descriptive Names**: Test names should clearly describe the scenario
- **Independent Tests**: Each test should be able to run independently
- **Fast Execution**: Tests should run quickly (< 100ms per test)
- **Deterministic**: Tests should produce consistent results
- **Coverage**: Test happy paths, edge cases, and error scenarios

## 10. Internationalization

- **Centralized Translations**: Manage all user-facing strings through `@/i18n` translations (`src/i18n`)
- **No Inline Text**: Do not render plain text literals in frontend components; always use `t(translations.some.path)` or equivalent helpers
- **Phrase Ownership**: Add or update entries in `translations.ts` (and locale files) whenever new copy is needed, keeping keys descriptive and organized
- **Consistency**: Reuse existing translation keys instead of duplicating phrases, and ensure locale files remain in sync

## 11. Code Quality Standards

- **Linting**: Use Biome for linting and formatting
- **Type Checking**: Run TypeScript compiler for type checking
- **Testing**: Write tests for critical functionality
- **Code Review**: Review code before merging
- **Documentation**: Write clear, concise comments when necessary

## 12. Git Workflow

- **Branch Naming**: Use descriptive branch names (feature/, fix/, refactor/)
- **Commit Messages**: Write clear, descriptive commit messages
- **Pull Requests**: Create PRs for all changes
- **Code Review**: Require code review before merging

## 13. Security

- **Input Validation**: Validate all user inputs
- **File Access**: Restrict file access to necessary directories
- **IPC Security**: Secure IPC communication
- **Dependencies**: Keep dependencies up to date
