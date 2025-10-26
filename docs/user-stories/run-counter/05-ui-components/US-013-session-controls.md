# US-013: Session Controls Component

## User Story

As a user, I want controls to start, stop, pause, and resume runs so that I have full control over my tracking.

## Description

Create a SessionControls component that provides buttons and keyboard shortcuts for managing run tracking, including start, stop, pause, and resume functionality.

## Acceptance Criteria

- [ ] Add start run button
- [ ] Add pause/resume button
- [ ] Add end run button
- [ ] Implement keyboard shortcuts
- [ ] Add visual state indicators (running, paused)
- [ ] Handle edge cases (no session, no active run)
- [ ] Show confirmation dialogs for destructive actions
- [ ] Disable buttons when appropriate

## Technical Notes

Component with action buttons, keyboard shortcuts, and state-aware button states.

### Files to Create

- `src/components/runtracker/SessionControls.tsx`

## Dependencies

- US-009: Zustand Store

## Estimated Complexity

Medium

## Testing Considerations

- Test button clicks
- Test keyboard shortcuts
- Test disabled states
- Test confirmation dialogs
- Test edge cases
