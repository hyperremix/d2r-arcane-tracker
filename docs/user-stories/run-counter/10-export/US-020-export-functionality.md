# US-020: Export Functionality

## User Story
As a user, I want to export my run data so that I can analyze it in spreadsheets or share with others.

## Description
Implement export functionality for sessions and runs in multiple formats (CSV, JSON, text summary).

## Acceptance Criteria
- [ ] Implement CSV export
- [ ] Implement JSON export
- [ ] Implement text summary export
- [ ] Add export dialog
- [ ] Support clipboard export
- [ ] Include all session data
- [ ] Format export nicely

## Technical Notes
Export functionality with dialog component.

### Files to Create
- `src/components/runtracker/ExportDialog.tsx`
- `electron/utils/exportRunData.ts`

## Dependencies
- US-004: Database Methods
- US-009: Zustand Store

## Estimated Complexity
Medium

## Testing Considerations
- Test all export formats
- Test export data completeness
- Test file downloads
- Test clipboard functionality
