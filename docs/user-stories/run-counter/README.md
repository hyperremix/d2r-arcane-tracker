# Run Counter Epic

## Epic Overview

The Run Counter feature enables users to track their Diablo II: Resurrected gaming sessions, measure run times, and associate discovered grail items with specific runs. This provides detailed statistics about farming efficiency and helps users understand their gameplay patterns.

**Inspired by**: [MF_run_counter](https://github.com/oskros/MF_run_counter)

## User Value

Players need to:

- Track their farming efficiency and session productivity
- Identify which sessions and routes are most effective for finding items
- Understand how much time they spend in-game vs idle
- Maintain statistics about their farming sessions
- Export and analyze their run data

## Feature Summary

The Run Counter will provide:

- Automatic game state detection via save file monitoring
- Manual session and run management with controls
- Real-time tracking of active sessions and runs
- Association of grail items with specific runs
- Session archiving and history management
- Comprehensive statistics and analytics
- Export functionality for data analysis
- Widget integration for overlay display

## Story Map

```
Database Foundation
├── US-001: Database Schema
├── US-002: TypeScript Types
├── US-003: Database Mappers
└── US-004: Database Methods

Core Services
├── US-005: Run Tracker Service (depends on US-001-US-004)
└── US-006: Item-Run Association (depends on US-005)

IPC Layer
├── US-007: IPC Handlers (depends on US-005)
└── US-008: IPC Events (depends on US-007)

Frontend State
└── US-009: Zustand Store (depends on US-008)

UI Components
├── US-010: Run Tracker Main (depends on US-009)
├── US-011: Session Card (depends on US-009)
├── US-012: Run List (depends on US-009)
├── US-013: Session Controls (depends on US-009)
└── US-014: (Retired) Run Type Selector (depends on US-009)

Integration
├── US-015: Navigation (depends on US-010)
└── US-016: Widget (depends on US-009, US-011)

Analytics
├── US-017: Statistics Queries (depends on US-004)
└── US-018: Analytics UI (depends on US-017, US-010)

Settings & Export
├── US-019: Settings (depends on US-009)
└── US-020: Export (depends on US-004, US-009)

Polish
├── US-021: Testing (depends on all)
└── US-022: Polish (depends on all)
```

## Implementation Order

### Phase 1: Foundation (US-001 to US-004)

Build the database layer and type system that everything else depends on.

### Phase 2: Core Logic (US-005 to US-006)

Implement the run tracking service and integrate with item detection.

### Phase 3: Communication (US-007 to US-008)

Set up IPC handlers and event system for frontend-backend communication.

### Phase 4: State Management (US-009)

Create the frontend store for managing run counter state.

### Phase 5: Core UI (US-010 to US-014)

Build the main user interface components.

### Phase 6: Integration (US-015 to US-016)

Add navigation and widget support.

### Phase 7: Analytics (US-017 to US-018)

Implement statistics and analytics features.

### Phase 8: Configuration (US-019 to US-020)

Add settings and export functionality.

### Phase 9: Quality (US-021 to US-022)

Testing, polish, and UX improvements.

## Story Index

### Phase 1: Database Foundation

- [US-001: Database Schema](./01-database-foundation/US-001-database-schema.md)
- [US-002: TypeScript Types](./01-database-foundation/US-002-typescript-types.md)
- [US-003: Database Mappers](./01-database-foundation/US-003-database-mappers.md)
- [US-004: Database Methods](./01-database-foundation/US-004-database-methods.md)

### Phase 2: Core Services

- [US-005: Run Tracker Service](./02-core-services/US-005-run-tracker-service.md)
- [US-006: Item-Run Association](./02-core-services/US-006-item-run-association.md)

### Phase 3: IPC Layer

- [US-007: IPC Handlers](./03-ipc-layer/US-007-ipc-handlers.md)
- [US-008: IPC Events](./03-ipc-layer/US-008-ipc-events.md)

### Phase 4: Frontend State

- [US-009: Zustand Store](./04-frontend-state/US-009-zustand-store.md)

### Phase 5: UI Components

- [US-010: Run Tracker Main](./05-ui-components/US-010-run-tracker-main.md)
- [US-011: Session Card](./05-ui-components/US-011-session-card.md)
- [US-012: Run List](./05-ui-components/US-012-run-list.md)
- [US-013: Session Controls](./05-ui-components/US-013-session-controls.md)
- [US-014: (Retired) Run Type Selector](./05-ui-components/US-014-run-type-selector.md)

### Phase 6: Navigation

- [US-015: Navigation Integration](./06-navigation/US-015-navigation-integration.md)

### Phase 7: Widget

- [US-016: Widget Integration](./07-widget/US-016-widget-integration.md)

### Phase 8: Analytics

- [US-017: Statistics Queries](./08-analytics/US-017-statistics-queries.md)
- [US-018: Analytics UI](./08-analytics/US-018-analytics-ui.md)

### Phase 9: Settings

- [US-019: Settings Integration](./09-settings/US-019-settings-integration.md)

### Phase 10: Export

- [US-020: Export Functionality](./10-export/US-020-export-functionality.md)

### Phase 11: Polish

- [US-021: Testing](./11-polish/US-021-testing.md)
- [US-022: Polish Features](./11-polish/US-022-polish-features.md)

## Technical Architecture

### Database Schema

- `sessions` table - Tracks gaming sessions
- `runs` table - Tracks individual game runs within sessions
- `run_items` table - Associates grail items with runs

### Key Services

- `RunTrackerService` - Core run tracking logic
- `ItemDetectionService` - Existing service integrated with run tracking

### IPC Communication

- Handlers for session/run management commands
- Events for run state changes and updates

### Frontend Components

- Zustand store for state management
- React components for UI
- Widget integration for overlay display

See the [implementation plan](../../../run-counter-implementation.plan.md) for detailed technical specifications.

## Definition of Done

A user story is considered complete when:

1. All acceptance criteria are met
2. Code is written, reviewed, and merged
3. Unit tests are written and passing
4. Integration tests pass (if applicable)
5. No regressions in existing functionality
6. Documentation is updated
7. UI follows design system patterns
8. Error handling is implemented
9. Edge cases are handled
10. Performance is acceptable

## Epic Completion Criteria

The Run Counter epic is complete when:

1. All 22 user stories are implemented
2. Database schema supports all run tracking features
3. Automatic game state detection works reliably
4. Manual controls allow full session/run management
5. Items are correctly associated with runs
6. Statistics and analytics are accurate
7. Export functionality works for all formats
8. Widget integration is complete
9. Settings allow customization of all features
10. All tests pass
11. Documentation is complete
12. No critical bugs remain

## Related Documentation

- [Implementation Plan](../../../run-counter-implementation.plan.md)
- [Project Structure Rules](../../../../.cursor/rules/project-structure.mdc)
- [Component Patterns Rules](../../../../.cursor/rules/component-patterns.mdc)
- [Electron Patterns Rules](../../../../.cursor/rules/electron-patterns.mdc)

## Status

**Epic Status**: Not Started  
**Last Updated**: 2025-01-15  
**Total Stories**: 22  
**Completed Stories**: 0  
**In Progress**: 0  
**Blocked**: 0
