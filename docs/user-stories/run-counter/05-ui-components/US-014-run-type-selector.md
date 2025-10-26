# US-014: Run Type Selector Component

## User Story
As a user, I want to categorize my runs by type so that I can analyze which run types are most effective.

## Description
Create a RunTypeSelector component with a dropdown of common run types (Mephisto, Chaos, Cows, etc.) and the ability to add custom run types.

## Acceptance Criteria
- [ ] Dropdown with preset run types
- [ ] Custom run type input field
- [ ] Persist recent run types
- [ ] Icons for common run types
- [ ] Auto-complete functionality
- [ ] Validation for run type names

## Technical Notes
Combobox component with presets and custom input.

### Files to Create
- `src/components/runtracker/RunTypeSelector.tsx`

## Dependencies
- US-009: Zustand Store

## Estimated Complexity
Small

## Testing Considerations
- Test dropdown functionality
- Test custom input
- Test persistence
- Test auto-complete
