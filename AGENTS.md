# AGENTS.md

This file defines **AI-agent behavior** for this repository. Keep content limited to instructions that guide agent decisions while planning, editing, testing, and validating changes.

## Scope
- Applies to the entire repository.
- A deeper `AGENTS.md` overrides this file for files in that subtree.

## Required quality gates (must pass before completion)
Run these commands in order and ensure all succeed:
1. `bun run typecheck`
2. `bun run format`
3. `bun run lint`
4. `bun run check`
5. `bun run test:run`

If any command fails, fix the issue and re-run from the failing step onward.

## Agent workflow expectations
- Keep edits minimal, task-scoped, and reversible.
- Prefer root-cause fixes over superficial workarounds.
- Preserve existing architecture and naming conventions unless the task explicitly requires refactoring.
- Update tests when behavior changes.

## Coding conventions agents must follow
- Use TypeScript and prefer named exports for components/utilities.
- Use `@/` imports for renderer internal modules when available.
- Use `import type` for type-only imports.
- Prefer `interface` for object shapes and `type` for unions/intersections.
- Prefer `undefined` over `null` for optional values unless existing APIs require `null`.
- Never wrap imports in `try/catch`.

## Frontend rules and edge cases
- All user-facing frontend strings must be internationalized.
- Do not add inline UI copy; use `t(...)` with keys from `src/i18n/translations.ts` and keep locale files in sync.
- Reuse existing translation keys whenever possible.
- Preserve accessibility behavior (semantic elements, keyboard support, ARIA where needed).

## Testing rules
- Use Vitest for unit/component tests.
- Write deterministic and independent tests.
- Prefer descriptive scenario naming (`When / If / Then`).
- Structure test bodies with clear Arrange / Act / Assert sections.

## Electron/runtime safety requirements
- Validate renderer-provided inputs at IPC boundaries.
- Handle filesystem/database error paths gracefully.
- Keep renderer/main isolation secure; expose only necessary preload APIs.
- Clean up listeners/resources to avoid leaks in long-running services.

## Completion checklist
Before finishing:
- Confirm required quality gates passed.
- Ensure related tests were updated/added for behavior changes.
- Confirm no unintended file changes remain.
