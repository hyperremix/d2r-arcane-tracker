# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Diablo 2 Resurrected Arcane Tracker - an Electron application built with Vite, React, TypeScript, and Tailwind CSS. The project uses a dual-tsconfig setup for web (renderer) and Node.js (main) processes.

### Main Features

- **Holy Grail Tracking**: Track unique items, set items, runes, and runewords
- **Save File Monitoring**: Automatic detection and parsing of D2R save files
- **Runeword Calculator**: View all runewords and see which ones you can craft based on available runes
- **Terror Zone Configuration**: Customize which terror zones are active in your D2R installation
- **Statistics Dashboard**: Comprehensive analytics and progress tracking
- **Smart Notifications**: In-app and native notifications for new item discoveries

## Technology Stack

- **Frontend**: React 18 with TypeScript, styled with Tailwind CSS v4
- **Backend**: Electron main process (Node.js environment)
- **Build System**: Vite with electron-vite for development and building
- **UI Components**: shadcn/ui components (New York style) using Radix UI primitives and class-variance-authority
- **Internationalization**: i18next with browser language detection
- **Code Quality**: Biome for linting, formatting, and static analysis
- **Package Manager**: Bun (specified in packageManager field)

## TypeScript Configuration

- `tsconfig.json` - Web/renderer configuration (includes src/, electron/)
- `tsconfig.node.json` - Node.js configuration for build tools
- Both configs use path mapping `@/*` → `./src/*` for imports

## Quick Start

```bash
# Development
bun run dev           # Start development server

# Code Quality (must pass before task completion)
bun run typecheck     # Type check both web and node
bun run check         # Run all Biome checks
bun run lint          # Lint only
bun run format        # Format check
bun run test:run      # Run all tests

# Build
bun run build         # Full production build
```

## Comprehensive Documentation

This project includes detailed development rules in `.cursor/rules/`:

- **[development-workflow.mdc](.cursor/rules/development-workflow.mdc)** - Complete list of npm scripts, task completion criteria, testing strategy, and workflow best practices (always applied)
- **[project-structure.mdc](.cursor/rules/project-structure.mdc)** - Full directory structure, import patterns, file naming conventions, and component organization (always applied)
- **[component-patterns.mdc](.cursor/rules/component-patterns.mdc)** - React component patterns and best practices
- **[electron-patterns.mdc](.cursor/rules/electron-patterns.mdc)** - Electron-specific patterns and IPC conventions
- **[typescript-patterns.mdc](.cursor/rules/typescript-patterns.mdc)** - TypeScript coding patterns and conventions
- **[ui-components.mdc](.cursor/rules/ui-components.mdc)** - UI component patterns with shadcn/ui
- **[grail-specific.mdc](.cursor/rules/grail-specific.mdc)** - Holy Grail tracking specific patterns
- **[unit-testing.mdc](.cursor/rules/unit-testing.mdc)** - Testing patterns with Vitest

**Please refer to these rule files for detailed guidance on:**
- All available npm scripts and commands
- Complete project directory structure
- Component architecture and organization
- State management with Zustand
- Electron main/renderer process communication
- Database operations and IPC handlers
- Testing strategies and patterns
- Code quality standards and pre-commit hooks

## Key Development Notes

- The main process uses standard Node.js imports (no protocol enforcement)
- Renderer process enforces Node.js import protocols
- Uses ESM modules throughout
- Vite handles HMR for renderer, electron-vite handles main process reloading
- The app icon is located at `public/logo.png`
