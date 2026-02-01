# Antigravity Agent Rules

This file contains the consolidated rules and guidelines for working on the D2R Arcane Tracker project. These rules are derived from `CLAUDE.md` and `.cursor/rules/`.

## 1. Project Overview

**Diablo 2 Resurrected Arcane Tracker** is an Electron application built with Vite, React, TypeScript, and Tailwind CSS.

### Key Features
- **Holy Grail Tracking**: Track unique items, sets, runes, and runewords.
- **Save File Monitoring**: Automatic detection/parsing of D2R save files.
- **Runeword Calculator**: Crafting possibilities based on available runes.
- **Terror Zone Config**: Customize active terror zones.
- **Statistics**: Analytics and progress tracking.

### Technology Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS v4.
- **Backend**: Electron main process (Node.js).
- **Build**: Vite, electron-vite.
- **UI**: shadcn/ui (New York style), Radix UI.
- **State**: Zustand.
- **Database**: `better-sqlite3` (Electron), `sqlc` for queries.
- **Testing**: Vitest.
- **Linting/Formatting**: Biome.
- **Package Manager**: Yarn.

---

## 2. Development Workflow

### Task Completion Criteria
**All** of the following must pass before a task is complete:
1. `yarn typecheck` (Web & Node)
2. `yarn format` (Biome)
3. `yarn lint` (Biome)
4. `yarn run check` (Combined)
5. `yarn test:run` (All tests)

### Common Commands
- `yarn dev`: Start dev server.
- `yarn build`: Production build.
- `yarn typecheck`: Run TypeScript checks.
- `yarn check:fix`: Fix linting/formatting issues.
- `yarn test`: Run tests in watch mode.

### Git Workflow
- Use descriptive branch names (`feature/`, `fix/`, `refactor/`).
- Write clear commit messages.

---

## 3. Project Structure

### Directory Layout
- `src/components/grail/`: Core grail tracking components.
- `src/components/settings/`: Settings components.
- `src/components/ui/`: Reusable shadcn/ui components.
- `src/stores/`: Zustand stores.
- `src/hooks/`: Custom React hooks.
- `src/lib/`: Utilities.
- `electron/`: Main process code.
- `electron/database/`: SQLite management.
- `electron/ipc-handlers/`: IPC handlers.
- `electron/services/`: Background services.

### Naming Conventions
- **Components**: PascalCase (`ItemCard.tsx`).
- **Utilities/Hooks**: camelCase (`utils.ts`, `useGrail.ts`).
- **Types**: camelCase (`grail.ts`).

### Import Patterns
- Use absolute imports with `@/` (maps to `./src/`).
- Group imports: External -> Internal -> Relative.

---

## 4. Component Patterns (React)

### Structure
```typescript
import type { ComponentProps } from 'electron/types/grail';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  // ...
}

export function Component({ prop1 }: Props) {
  return <div>...</div>;
}
```

### Guidelines
- **Single Responsibility**: One clear purpose per component.
- **Props**: Always define interfaces. Use default params, not `defaultProps`.
- **State**: `useState` for local, Zustand for global.
- **Performance**: `useMemo`/`useCallback` for expensive ops or stable references.
- **Accessibility**: Semantic HTML, ARIA labels.

---

## 5. UI Components (Shadcn/Tailwind)

- **Base**: Use shadcn/ui. Extend with custom styles.
- **Styling**: Tailwind CSS. Use `cn()` for class merging.
- **Responsive**: `sm:`, `md:`, `lg:`, `xl:` prefixes.
- **Dark Mode**: `dark:` prefix.
- **Structure**: Forward refs for DOM elements.

---

## 6. Electron Patterns

### IPC Communication
- **Main**: Handle in `electron/ipc-handlers/`.
- **Renderer**: Use preload script.
- **Types**: Define in `electron/types/electron.d.ts`.

### Database
- **Library**: `better-sqlite3`.
- **Queries**: Use `sqlc` for type safety.
- **Migrations**: `sqlc/migrations/`.

### Services
- Implement background logic in `electron/services/`.
- Use `EventEmitter` for communication.

---

## 7. TypeScript Patterns

- **Interfaces**: Use for object shapes.
- **Types**: Use for unions/intersections.
- **Exports**: Named exports preferred.
- **Nullability**: Prefer `undefined` over `null`.
- **Async**: Use `async/await` and `try/catch`.

---

## 8. Holy Grail Domain Logic

### Core Models
- **HolyGrailItem**: Static item data.
- **GrailProgress**: User progress (found status).
- **Settings**: App config (ethereal, hardcore, etc.).

### Data Flow
1. **Save Monitor**: Watch `.d2s` files.
2. **Detection**: Parse file -> Match items.
3. **Update**: DB update -> UI refresh -> Stats recalc.

---

## 9. Unit Testing (Vitest)

### Structure ("When, If, Then")
```typescript
describe('When [Function]', () => {
  describe('If [Condition]', () => {
    it('Then [Expected Result]', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### Guidelines
- **AAA Pattern**: Arrange, Act, Assert.
- **Single Assertion**: One logical assertion per test.
- **Mocking**: Use `vi.mock` for dependencies.
- **Testing Library**: `render`, `screen`, `fireEvent` for components.
