---
name: pr-review
description: Review a GitHub pull request and post a merge-confidence verdict, or return a draft in delegated mode. Use when the user asks to review a PR, rate merge confidence, re-check new commits, or when shepherd-pr assigns a review pass.
---

Merge-confidence review of a GitHub PR, posted as a single comment:

- **Merge confidence** — a 1 to 5 rating.
- **Findings** — the Critical, Major, and Minor changes needed to reach a 5.

The diff review itself is delegated to the `code-review` skill's Standards + Spec dual-axis report, run as parallel sub-agents. This skill isolates the PR, verifies that report against the running codebase, and posts the aggregated verdict as a PR comment.

## Execution model

Before direct or delegated execution, follow the shared [execution model rule](../shepherd-pr/SKILL.md#execution-model): run this skill and its nested Standards and Spec agents with **`gpt-5.6-terra` and `high` reasoning effort**. Route the whole skill when the current runtime differs; when already running with the required settings, execute here without routing again. Preserve the original invocation mode and publication authorization.

## Delegated pass

When shepherd-pr assigns a review, perform the process below once with these differences:

- Use the parent's pinned head and base SHAs and complete outstanding finding set, including all supplied feedback sources. Verify earlier findings against current code. Fetch the PR head ref or exact commit into an isolated review worktree; do not assume a fork's branch exists on origin. Use the assigned base SHA as code-review's fixed point.
- Pass an explicitly supplied spec directly to code-review and skip its issue-tracker discovery and setup. A missing tracker document is not a blocker when the spec is supplied. Preserve both review axes; if agent capacity requires running them sequentially, keep their contexts separate and report that change.
- Run the required repository quality gates locally. Missing local verification prerequisites remain explicit limitations and cannot support 5/5, even when they are not code findings. GitHub CI/status contexts are supplemental.
- Return the full draft verdict with the reviewed-sha marker instead of posting it. Include reviewed head/base SHAs, full findings and dispositions with code evidence, exact verification results, and feedback coverage. Re-fetch remote head/base and feedback before returning; report changes so the parent can reconcile stale results. The parent coordinator owns publication under shepherd-pr's authorization rules, including verdicts below 5/5; the worker's no-posting restriction does not prohibit coordinator publication.
- Do not implement fixes, publish comments, change PR labels, create a scheduler, wait for future events, or declare the overall PR workflow complete. Return blockers to the parent. Clean up only owned review resources, keeping the draft available to the parent.

Direct invocations retain the process below. Ongoing monitoring and repeated fix/review cycles belong to shepherd-pr.

## Process

### 1. Isolate the PR

Never touch the user's current working directory — it almost certainly has unrelated work in progress. Fetch and check the PR's head out into a throwaway worktree, never the main working tree:

```
git fetch origin <base-branch> <head-branch>
git worktree add <scratchpad>/pr<N>-review origin/<head-branch>
```

Retry once on an SSH agent error (`sign_and_send_pubkey`, `Permission denied (publickey)`) — usually transient. Remove the worktree when done, success or failure.

### 2. Resolve the PR and detect a re-review

`gh pr view <N> --json title,body,url,headRefName,baseRefName,state,mergeable,author,commits` — fail clearly if the PR doesn't exist or isn't open.

Search the PR's comments for this skill's marker (left behind in step 5):

```
gh api repos/{owner}/{repo}/issues/<N>/comments --jq '.[].body' | grep -o 'pr-review-skill: reviewed-sha=[0-9a-f]*'
```

- **No marker** — fresh review.
- **Marker found** — re-review. Read that previous comment in full; you'll hand its Critical/Major/Minor list to `code-review` in step 3 so findings get checked off instead of re-derived.

### 3. Run `code-review` against the PR's base, from inside the worktree

Invoke the `code-review` skill (`Skill(code-review)`) with `args` covering what it would otherwise have to search for:

- The fixed point: `origin/<base-branch>`.
- The spec source, direct: "the PR body below (this repo generally has no separate issue tracker or spec docs)" plus the PR title and body text.
- For a re-review only: the previous comment's full finding list, with the instruction that both sub-agents should classify each item as Fixed / Still Open / New Regression against the current diff — quoting current code, not the commit message's claim about it.

Let `code-review`'s own process run as written — pinning the fixed point, spawning the Standards and Spec sub-agents (including its smell baseline), and aggregating their reports under `## Standards` / `## Spec`. Don't re-implement any of that here.

### 4. Verify before rating

This is where a false claim gets caught — "749/749 passed" when a test is actually flaky, "100% deterministic" when a timeout silently falls back to a heuristic. In the worktree, install deps and run every required quality gate (see AGENTS.md > Required quality gates). Run twice if anything in the `code-review` report looks flaky or order-dependent — one green run doesn't rule out cross-test pollution.

A build/typecheck failure that's purely local-environment (a native module such as `better-sqlite3` not built for the local Node/Electron ABI, missing code-signing credentials) isn't a finding — note it as unverifiable and move on. Trace any load-bearing claim (determinism, idempotency, rate limiting, auth checks, "non-destructive") through the actual code path rather than accepting the description — this is usually where Critical findings live.

### 5. Rate and post

Reclassify every surviving Standards/Spec finding, plus anything step 4 disproved, into:

- **Critical** — auth/security bugs (missing ownership checks, dropped rate limits), data-integrity bugs, functionality that contradicts an explicit spec claim, or a verification claim you disproved by running it.
- **Major** — AGENTS.md rule violations, real regressions, incomplete fixes, undocumented scope creep needing a decision, functionally-relevant dead/duplicated code.
- **Minor** — dead code with no functional impact, orphaned exports/keys, small spec/doc mismatches, baseline-smell judgement calls.

Pick the rating holistically from the worst class present and how much of the PR is otherwise solid — don't average mechanically:

- **5** — no open findings; everything claimed is verified.
- **4** — Minor findings only.
- **3** — Major findings present, no Critical.
- **2** — Critical findings present, but the PR shows real, verifiable progress.
- **1** — Critical findings present and largely unaddressed, or the diff doesn't do what it claims.

For a re-review, structure the comment as **Fixed, verified** / **Still open** / **New** rather than restating the full finding set, citing the diff (not the commit message) for each "Fixed" item.

Write the report to a scratch file and post it:

```
gh pr comment <N> --body-file <file>
```

End the body with a marker so future invocations can find it (invisible in rendered Markdown):

```
<!-- pr-review-skill: reviewed-sha=<head-sha> -->
```

### 6. Clean up

Remove the review worktree and any local tracking branch it created. Reply with the comment URL and a one-line verdict summary — don't restate the full report, the user can open the link.

## Why verify before rating

A rating built only from `code-review`'s Standards/Spec report inherits every overstatement in the PR description that the sub-agents didn't happen to catch:

- Trusting "tests pass" instead of running them → a flaky test ships silently.
- Trusting "deterministic" instead of tracing the code path → a timeout fallback breaks the guarantee in production.

Running the suite and tracing the claim is what makes the rating reflect the codebase, not a restatement of the PR body.
