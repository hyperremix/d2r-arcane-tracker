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

## Think before coding
- State assumptions explicitly; if uncertain, ask before implementing.
- If a request has multiple interpretations, present them instead of picking one silently.
- If a simpler approach exists, say so and push back when warranted.
- If something is unclear, stop, name what is confusing, and ask.
- These rules favor caution over speed; use judgment for trivial tasks.

## Agent workflow expectations
- Keep edits minimal, task-scoped, and reversible; every changed line should trace directly to the request.
- Prefer root-cause fixes over superficial workarounds.
- Preserve existing architecture, naming conventions, and style unless the task explicitly requires refactoring.
- Do not "improve" adjacent code, comments, or formatting, and do not refactor code that is not broken.
- Mention unrelated dead code instead of deleting it; remove only the imports, variables, and functions your own change made unused.
- Update tests when behavior changes.
- Update the matching guide in `docs/` when user-facing behavior changes; link to existing docs instead of duplicating them.
- Always use `git rebase` instead of `git merge` to integrate changes from the base branch; this keeps a linear commit history.

## Simplicity
- Write the minimum code that solves the problem; add no features, abstractions, or configurability beyond what was asked.
- Do not add abstractions for single-use code.
- Do not add error handling for impossible scenarios. This does not relax the IPC, filesystem, and database error-handling rules below.
- If the solution could be much shorter, rewrite it. Ask: "Would a senior engineer say this is overcomplicated?"

## Goal-driven execution
- Turn tasks into verifiable goals before implementing:
  - Bug fix → write a test that reproduces it, then make it pass.
  - Add validation → write tests for invalid inputs, then make them pass.
  - Refactor → ensure tests pass before and after.
- For multi-step tasks, state a brief plan with a verification check for each step.
- Loop until the success criteria are verified; the required quality gates are the baseline check.

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
- `website/` (the GitHub Pages site) is an English-only static page outside the app renderer; it is exempt from the `t(...)` and translation-key rules.
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
