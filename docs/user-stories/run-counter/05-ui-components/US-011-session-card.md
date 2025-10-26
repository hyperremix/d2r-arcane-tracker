# US-011: Session Card Component

## User Story
As a user, I want to see my current session statistics and controls so that I can monitor my farming session.

## Description
Create a SessionCard component that displays the active session information including session time, run count, items found, and provides controls to end or archive the session.

## Acceptance Criteria
- [ ] Display session time with real-time updates
- [ ] Show run count and average run time
- [ ] Display items found count
- [ ] Show efficiency percentage (run time / session time)
- [ ] Provide end session button
- [ ] Provide archive session button
- [ ] Include notes editor
- [ ] Real-time timer updates

## Technical Notes
Display session statistics card with live timer updates and session management controls.

### Files to Create
- `src/components/runtracker/SessionCard.tsx`

## Dependencies
- US-009: Zustand Store

## Estimated Complexity
Medium

## Testing Considerations
- Test real-time timer updates
- Test session statistics display
- Test control buttons
- Test notes editor
- Test empty state handling
