# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Diablo 2 Resurrected Arcane Tracker - an Electron application built with Vite, React, TypeScript, and Tailwind CSS. The project uses a dual-tsconfig setup for web (renderer) and Node.js (main) processes.

## Architecture

- **Frontend**: React 18 with TypeScript, styled with Tailwind CSS v4
- **Backend**: Electron main process (Node.js environment)
- **Build System**: Vite with electron-vite for development and building
- **UI Components**: shadcn/ui components (New York style) using Radix UI primitives and class-variance-authority
- **Internationalization**: i18next with browser language detection
- **Code Quality**: Biome for linting, formatting, and static analysis
- **Package Manager**: Yarn (specified in packageManager field)

## Development Commands

```bash
# Development server (starts Vite + Electron)
yarn dev

# Type checking (both web and node)
yarn typecheck

# Individual type checking
yarn typecheck:web    # Web/renderer code
yarn typecheck:node   # Node/main code

# Code quality
yarn check           # Run all Biome checks
yarn check:fix       # Fix auto-fixable issues
yarn lint            # Lint only
yarn lint:fix        # Fix linting issues
yarn format          # Format code
yarn format:fix      # Format and write changes

# Build and preview
yarn build           # Full build (typecheck + vite build + electron-builder)
yarn preview         # Preview built app
```

## Project Structure

- `src/` - React renderer code (web environment)

  - `components/` - UI components (uses shadcn/ui pattern)
  - `lib/` - Utility functions
  - `i18n/` - Internationalization setup and translations
  - `types/` - TypeScript type definitions

- `electron/` - Electron main process code (Node.js environment)

  - `main.ts` - Main electron process
  - `preload.ts` - Preload script

- `public/` - Static assets

## TypeScript Configuration

- `tsconfig.json` - Web/renderer configuration (includes src/, electron/)
- `tsconfig.node.json` - Node.js configuration for build tools

Both configs use path mapping `@/*` → `./src/*` for imports.

## Code Quality Standards

The project uses Biome with strict rules including:

- Accessibility rules enabled
- React-specific rules for hooks and dependencies
- Security rules (no dangerouslySetInnerHTML, no eval)
- Node.js import protocol enforcement (except in main process)
- Consistent code style with 100 character line width

## Pre-commit Hooks

Lint-staged runs on commit with different rule sets:

- Renderer files: Biome check + TypeScript check + lint + format
- Main process files: Biome check + TypeScript check + lint + format
- Other files: Biome check + lint + format as appropriate

## Development Notes

- The main process uses standard Node.js imports (no protocol enforcement)
- Renderer process enforces Node.js import protocols
- Uses ESM modules throughout
- Vite handles HMR for renderer, electron-vite handles main process reloading
- The app icon is located at `public/logo.svg`

## Cursor Rules

This project includes comprehensive development rules in the `.cursor/rules/` directory:

- **project-structure.mdc** - Project structure and organization guidelines (always applied)
- **component-patterns.mdc** - React component patterns and best practices (applied to *.tsx files)
- **development-workflow.mdc** - Development workflow and best practices
- **electron-patterns.mdc** - Electron-specific patterns and conventions
- **grail-specific.mdc** - Holy Grail tracking specific patterns and conventions
- **typescript-patterns.mdc** - TypeScript coding patterns and conventions
- **ui-components.mdc** - UI component patterns and conventions
- **unit-testing.mdc** - Unit testing patterns and best practices using Vitest

These rules provide detailed guidance for:
- Component architecture and organization
- State management with Zustand
- Electron main/renderer process communication
- Database operations and IPC handlers
- UI component development with shadcn/ui
- Testing strategies and patterns
- TypeScript best practices

Refer to these rules for specific implementation patterns and conventions used throughout the project.