---
name: address-pr-feedback
description: Inspect and implement GitHub PR feedback on the current branch, or apply a supplied finding set in delegated mode. Use when the user asks to address review feedback or shepherd-pr assigns a fix pass. Do not use for review-only or merge-confidence requests.
---

# Address PR feedback

Apply the newest review feedback to the current branch without losing work already in progress.

## Execution model

Before direct or delegated execution, follow the shared [execution model rule](../shepherd-pr/SKILL.md#execution-model): run this skill and any nested workers with **`gpt-5.6-terra` and `high` reasoning effort**. Route the whole skill when the current runtime differs; when already running with the required settings, execute here without routing again. Preserve the original invocation mode, assigned worktree, and commit/push authorization.

## Delegated pass

When shepherd-pr assigns fixes, perform the workflow below once with these differences:

- Use the exact PR and assigned worktree. Reconcile the parent's entire outstanding finding set, including Minor suggestions and older unfinished items, rather than selecting only the newest comment. Map each actionable item to an acceptance check. Return unsupported or contradictory suggestions with evidence rather than marking them fixed.
- Fetch and compare the remote head before editing. If it differs from the assigned SHA, reconcile incoming commits without overwriting unrelated work and reassess the findings. If that cannot be done safely, return the divergence as a blocker.
- After required checks and the final audit pass, commit and push only if the parent explicitly assigns those actions within the user's authorization. Commit only this pass's changes and push to the verified PR head repository and branch. Re-read the remote head before pushing; on divergence or rejection, reconcile and rerun affected checks rather than force-pushing. Confirm the remote SHA after publication. If publishing is unauthorized, preserve the validated local fixes and return the missing authorization to the parent.
- Return each finding's disposition, changed files, exact checks and results, starting and ending local/remote SHAs, any commit/push result, and new feedback or blockers. Do not post review replies, resolve threads, start a scheduler, invoke a reviewer, wait for future events, or declare 5/5. The parent owns subsequent passes and user questions.

Direct invocations retain the workflow below. Ongoing monitoring and repeated fix/review cycles belong to shepherd-pr.

## Inspect the right feedback

1. Read `AGENTS.md` and any deeper instructions that cover files likely to change.
2. Inspect `git status --short --branch` before touching files. Preserve all existing changes unless the feedback explicitly supersedes them.
3. Resolve the pull request from an explicit number, or infer it from the current branch with `gh pr view`.
4. Read all three GitHub feedback sources because the newest item may be in any one of them:
   - issue comments: `repos/{owner}/{repo}/issues/{pr}/comments`
   - reviews: `repos/{owner}/{repo}/pulls/{pr}/reviews`
   - inline review comments: `repos/{owner}/{repo}/pulls/{pr}/comments`
5. Compare timestamps across those sources and read the newest feedback in full. For a re-review, use its Fixed, Still open, and New sections rather than reopening findings it explicitly verifies as fixed.

Map every suggestion to a concrete acceptance check before editing. When the user asks for all suggestions, include Minor and non-blocking suggestions. Skip only items the comment clearly presents as informational, already fixed, or not a requested change.

## Trace before changing

Read the cited code, its callers, and relevant tests. Confirm the review's description against the current branch instead of treating it as infallible.

If a suggestion combines code paths with different semantics, fix the real duplication or defect while preserving those differences. For example, do not replace a guarded bulk database operation with per-record transactions just to force unlike paths through one helper. State that distinction in a progress update and continue with the smallest sound change.

Use repository and domain-specific skills when they apply. Do not invoke the PR review workflow merely to address feedback, and do not create an isolated worktree when the user explicitly asked to change the current branch.

## Implement and verify

- For bugs and behavior changes, add the smallest failing regression test first and confirm the expected failure before changing production code.
- For a behavior-preserving refactor, run focused characterization tests before the edit and again afterward.
- Keep every changed line tied to a suggestion. Avoid adjacent cleanup.
- Apply explicit PR metadata suggestions, such as correcting the title, when they are part of the feedback. Do not post review replies, resolve threads, commit, or push unless the user asks.

Run focused tests while iterating. Then run every quality gate required by `AGENTS.md`. If a gate fails, fix it and rerun from the failed step onward. Supply temporary non-secret environment values at the command line when a build requires configuration; do not edit environment files for validation.

## Final audit

Before finishing:

1. Run `git diff --check` and inspect `git status`, the diff, and the changed-file list.
2. Confirm prior fixes and unrelated user changes remain intact.
3. Query the PR feedback sources again to catch a comment that arrived during validation.
4. Report the implemented suggestions, files changed, and exact verification results. Mention any intentionally unimplemented item and why.
