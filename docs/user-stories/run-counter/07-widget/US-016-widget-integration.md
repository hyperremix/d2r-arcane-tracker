# US-016: Widget Integration

## User Story
As a user, I want to see run counter information in the widget overlay so that I can monitor my runs without switching tabs.

## Description
Integrate run counter display into the widget overlay with configurable display modes (overall, split, run-only).

## Acceptance Criteria
- [ ] Add run counter display to widget
- [ ] Implement split display mode
- [ ] Implement run-only display mode
- [ ] Add widget settings for run counter
- [ ] Real-time widget updates
- [ ] Compact display design
- [ ] Update widget on run state changes

## Technical Notes
Widget component modifications for run counter integration.

### Files to Modify
- `src/components/Widget.tsx`
- `electron/window/widgetWindow.ts`

## Dependencies
- US-009: Zustand Store
- US-011: Session Card

## Estimated Complexity
Medium

## Testing Considerations
- Test widget display modes
- Test real-time updates
- Test widget settings
- Test compact layout
