# User Story Implementation Prompt Template

Use this template when implementing a user story. Copy and fill in the specific details for the story you're working on.

## Template

```
I'm implementing [USER_STORY_ID]: [STORY_TITLE] from the Run Counter epic.

**Story Details:**
- Story: [paste full story description]
- File path: [story file path]
- Dependencies: [list of prerequisite stories that must be complete]
- Complexity: [Small/Medium/Large]

**Requirements:**
Please implement this story according to the acceptance criteria and technical notes in the user story document.

**Context:**
- [Provide any relevant context about the current state of the codebase]
- [Mention any related files or components that might be relevant]
- [Note any specific patterns or conventions to follow]

**Deliverables:**
- [ ] All acceptance criteria met
- [ ] Code follows existing patterns and conventions
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] No regressions in existing functionality

**Additional Context:**
[Any other relevant information, constraints, or special considerations]
```

## Quick Reference Checklist

When implementing any story:

- [ ] Read the full user story document
- [ ] Understand all acceptance criteria
- [ ] Review technical notes and code examples
- [ ] Check dependencies (are prerequisite stories complete?)
- [ ] Follow existing code patterns and conventions
- [ ] Write tests for new functionality
- [ ] Update related documentation
- [ ] Ensure no regressions
- [ ] Run quality checks (typecheck, lint, format, test)
- [ ] Mark acceptance criteria as complete

## Phase-Specific Guidance

### Phase 1 (Database Foundation)

- Focus on data integrity and schema correctness
- Test migrations carefully
- Ensure backwards compatibility

### Phase 2 (Core Services)

- Integrate with existing services cleanly
- Handle edge cases in save file monitoring
- Test state management thoroughly

### Phase 3 (IPC Layer)

- Follow existing IPC patterns
- Ensure proper error handling
- Test event emission and cleanup

### Phase 4 (Frontend State)

- Follow Zustand store patterns from grailStore
- Handle loading and error states
- Test IPC event listeners

### Phase 5 (UI Components)

- Use shadcn/ui components
- Follow design system patterns
- Ensure responsive layout
- Handle empty states

### Phase 6-7 (Integration)

- Don't break existing navigation/widget functionality
- Test tab switching and widget display modes

### Phase 8 (Analytics)

- Optimize queries for performance
- Test with large datasets
- Ensure chart rendering works well

### Phase 9-10 (Settings & Export)

- Follow existing settings patterns
- Test export formats thoroughly
- Handle file operations safely

### Phase 11 (Quality)

- Achieve good test coverage
- Add helpful UX improvements
- Optimize performance

## Common Patterns to Follow

1. **Error Handling**: Always handle errors gracefully with user-friendly messages
2. **Loading States**: Show loading indicators during async operations
3. **Empty States**: Handle cases with no data gracefully
4. **Type Safety**: Use TypeScript types consistently
5. **Event Cleanup**: Always clean up event listeners in useEffect cleanup
6. **Code Formatting**: Follow Biome formatting rules
7. **Testing**: Write tests for critical paths
8. **Documentation**: Add JSDoc comments for public functions

## Pre-Implementation Checklist

Before starting implementation:

1. Review the user story document
2. Check if all dependencies are complete
3. Understand the acceptance criteria
4. Review related files in the codebase
5. Understand the existing patterns to follow
6. Set up testing approach
7. Plan the implementation steps

## Post-Implementation Checklist

After implementation:

1. Verify all acceptance criteria are met
2. Run `yarn typecheck` - must pass
3. Run `yarn format` - must pass
4. Run `yarn lint` - must pass
5. Run `yarn run check` - must pass
6. Run `yarn test:run` - must pass
7. Update any relevant documentation
8. Commit with clear message referencing story ID
