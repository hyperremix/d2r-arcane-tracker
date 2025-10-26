# US-017: Statistics Database Queries

## User Story
As a developer, I want database queries for analytics so that we can provide comprehensive run statistics.

## Description
Implement database queries for calculating session and run statistics including averages, totals, trends, and character-specific analytics.

## Acceptance Criteria
- [ ] Implement session statistics queries
- [ ] Implement run statistics queries
- [ ] Add character-specific statistics
- [ ] Optimize query performance
- [ ] Use indexes effectively
- [ ] Handle large datasets
- [ ] Provide aggregate functions

## Technical Notes
Database queries for analytics in GrailDatabase class.

### Files to Modify
- `electron/database/database.ts`

## Dependencies
- US-004: Database Methods

## Estimated Complexity
Medium

## Testing Considerations
- Test query accuracy
- Test query performance
- Test with large datasets
- Test index usage
