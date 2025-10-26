# US-019: Settings Integration

## User Story
As a user, I want to configure run tracker settings so that I can customize the tracking behavior.

## Description
Add run tracker settings to the Settings component and database, allowing users to configure auto-start, thresholds, and display options.

## Acceptance Criteria
- [ ] Add run tracker settings to Settings type
- [ ] Create settings UI section
- [ ] Implement settings persistence
- [ ] Add default values
- [ ] Provide tooltips for settings
- [ ] Validate setting values

## Technical Notes
Settings integration in Settings component.

### Files to Modify
- `electron/types/grail.ts` (Settings type)
- `src/components/settings/Settings.tsx`
- `electron/database/database.ts`

## Dependencies
- US-009: Zustand Store

## Estimated Complexity
Medium

## Testing Considerations
- Test settings persistence
- Test default values
- Test validation
- Test UI display
