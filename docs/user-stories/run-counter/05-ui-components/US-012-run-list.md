# US-012: Run List Component

## User Story
As a user, I want to see a history of my runs with details so that I can review past farming sessions.

## Description
Create a RunList component that displays a list of runs with their duration, type, and items found.

## Acceptance Criteria
- [ ] Display runs in chronological order
- [ ] Show run duration, type, and items
- [ ] Implement pagination for large lists
- [ ] Add filtering by run type
- [ ] Add sorting options
- [ ] Click to expand run details
- [ ] Visual indicators for runs with items

## Technical Notes
List component with pagination, filtering, and sorting capabilities.

### Files to Create
- `src/components/runtracker/RunList.tsx`

## Dependencies
- US-009: Zustand Store

## Estimated Complexity
Medium

## Testing Considerations
- Test list rendering
- Test pagination
- Test filtering and sorting
- Test click interactions
- Test with large datasets
