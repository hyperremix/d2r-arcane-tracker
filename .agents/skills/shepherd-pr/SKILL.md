---
name: shepherd-pr
description: Monitor a GitHub PR and coordinate address-pr-feedback and pr-review sub-agents until it reaches verified 5/5 merge confidence or cannot progress without external intervention. Use when the user wants one main agent to manage ongoing monitoring, fixes, and independent re-reviews.
---

# Shepherd PR

Act as the single coordinator for one PR. Delegate implementation to address-pr-feedback and review to pr-review, repeating until the current remote PR head satisfies the 5/5 completion gate. Creating or editing this skill does not start monitoring.

A user request to shepherd a PR includes publishing the resulting review verdicts as PR comments, managing its confidence label, and resolving verified bot review threads unless the user explicitly restricts those actions. Draft-only or read-only requests exclude all three; a no-comments request excludes comments and thread resolution without excluding labels. Record this authorization in coordinator state and worker assignments. The coordinator publishes, manages labels, and resolves threads; delegated reviewers return drafts.

Read [address-pr-feedback](../address-pr-feedback/SKILL.md), [pr-review](../pr-review/SKILL.md), and this skill's [monitoring protocol](references/monitoring.md). Use the workers' delegated modes, pr-review's confidence scale, and the protocol's polling, persistence, authorization, and completion rules. All ongoing monitoring belongs to this coordinator.

## Execution model

Run shepherd-pr, pr-review, address-pr-feedback, and their nested workers with **`gpt-5.6-terra` and `high` reasoning effort**. This includes the coordinator and code-review's Standards and Spec agents. Apply this rule to direct invocations, delegated passes, retries, and active-loop resumes. A later explicit user model instruction takes precedence.

Before operational work, check the effective runtime settings or the successful explicit launch configuration. If they match, execute in place without routing the skill again. Otherwise, delegate the entire requested skill to one internal agent with explicit `model: "gpt-5.6-terra"`, `reasoning_effort: "high"`, and `fork_turns: "none"` when using `spawn_agent`. Supply a self-contained assignment with the skill path, invocation mode, repository instructions, PR/spec/SHAs, worktree, authorization, and durable state. Use equivalent explicit settings for another supported launcher; a prose claim or skill metadata alone does not select a model.

Before routing a resumed shepherd, inspect the saved coordinator ID and actual status. Reuse an active coordinator with matching launch settings instead of spawning another one. Persist each successful routed launch's ID and explicit settings in the containing task's durable state, and pass that evidence to the routed agent. The active coordinator must reconcile this handoff before dispatch; an unknown containing-task model is not a reason to duplicate an existing coordinator.

The outer caller only dispatches, waits, and relays the routed agent's result. Preserve direct versus delegated behavior: a directly invoked reviewer still publishes its authorized verdict, while a shepherd's reviewer still returns a draft. The routed shepherd owns coordination, publication, labels, and the single monitor; routing must not create a competing coordinator or branch writer. If scheduling tools are restricted to the containing task, that task may relay the coordinator's scheduling request.

Every nested launch must retain Terra/high. Reuse a worker only when its launch settings match; before replacing a mismatched active worker, stop it and reconcile its worktree and remote state. Record actual launch settings with worker IDs in durable state. If the requested settings cannot be selected or verified, report the limitation and preserve pending work instead of silently using another model or effort.

## Establish ownership

Resolve the PR and current head/base; read repository instructions and inspect local changes. Keep the PR URL, unresolved findings, worktree paths, authorization, current phase, worker IDs, last successful snapshot, and review evidence in the coordinator's durable state.

Assign fixes to the verified PR branch. Honor an explicit request to use the current branch; otherwise use an isolated worktree when the current checkout is unrelated or contains changes that cannot be safely separated. Give the worker the exact head repository and branch, including for fork PRs. Install dependencies in a scratch worktree before running gates so the pre-commit hook (`typecheck` + `lint-staged`) works. Commit or push with `--no-verify` only when the user authorizes it; otherwise report the hook failure as a blocker. Every layer stops only processes it started, by recorded PID, and never uses pattern kills such as `pkill -f`, which can stop other sessions' servers.

Use the available sub-agent tools, such as spawn_agent, send_message, and followup_task. These are internal workers in this task, not separate user-owned tasks. Discover the actual APIs and apply the execution model rule above with explicit launch settings. If sub-agents are unavailable, report that limitation; do not claim delegation occurred.

Run one active coordinator loop for this PR. Do not create a heartbeat, cron job, automation, or other scheduled task. Reconcile any active worker before taking over. Only the coordinator waits, polls, notifies the user, publishes review verdicts, manages confidence labels, and decides completion. Workers return blockers to the coordinator instead of asking the user independently. Assign an authorized push to the fixer explicitly. Carry existing authorization through every cycle without asking again.

## Delegate bounded work

Give every worker a self-contained assignment containing:

- Its skill's absolute path and the instruction to use **delegated pass** mode.
- The required model `gpt-5.6-terra` and reasoning effort `high`, also applied to any nested workers.
- Exact PR URL, head repository/branch, expected head and base SHAs, and assigned worktree or review scratch location.
- Applicable repository instructions, PR title/body as the spec, all outstanding findings with source IDs, and the feedback snapshot it must reconcile.
- Its permitted actions and required quality gates. State whether committing and pushing are authorized; review workers return drafts and never publish them. Workers stop only processes they started, by recorded PID.
- The required result: completed or blocked, starting and ending SHAs, finding dispositions with code evidence, checks run and their results, new feedback, and any remote changes. A reviewer also returns the score and complete draft verdict with pr-review's SHA marker.

Use distinct reviewer and fixer contexts. Pass previous findings and verification evidence to the reviewer, but require it to independently verify fixes rather than accepting the fixer's assertions or aiming for a requested score.

Run the fix and review passes sequentially. Allow only one writer to the PR branch. A reviewer works in its own isolated checkout of the pinned commit. While a worker runs, the coordinator may collect remote feedback and CI results for context, but must not edit that worker's checkout or launch a competing pass. Relay relevant changes to the worker and invalidate results that no longer cover the current snapshot.

Reserve capacity for the review skill's Standards and Spec sub-agents. Do not keep a fixer running while that review is in progress. If capacity prevents parallel review axes, run those axes sequentially with separate contexts and disclose the execution change; never omit an axis solely to obtain a verdict. Reuse workers when available, or recreate them with the persisted assignment and findings after a restart.

## Coordinate the loop

1. Take a complete snapshot using the monitoring protocol. Reconcile existing findings and confidence labels before dispatch, removing stale ratings as specified in the protocol. If current actionable findings need implementation, assign one address-pr-feedback pass; otherwise assign one pr-review pass when current review evidence is missing or invalidated. If all current evidence already meets the completion gate, proceed to the final verification.
2. Wait for the worker result using available agent waits, keeping individual waits bounded to 60 seconds and the user informed during active work. After each timeout, inspect the worker's actual status and continue waiting rather than handing the loop to a scheduler. Do not confuse an idle worker, an interrupted turn, or a timeout with successful completion. If a worker is gone, inspect its worktree and remote state before retrying or recreating it.
3. After a fix pass, inspect the diff and verification report, and confirm any reported push against the remote head. Keep unaddressed findings open. If authorization or another prerequisite is missing, surface the concrete prepared result and blocker; preserve pending work. Review remote fixes only after publication succeeds. Never use a local-only fix to claim the remote PR has improved.
4. Assign the reviewer to the resulting remote head and current base. After it returns, re-fetch the PR and feedback. Reconcile changes before publishing its draft or using its score. Publish each completed current assessment, including scores below 5/5, before the next fix pass. Post only once for the same assessment, using pr-review's marker and body-file convention; after an uncertain response, look for the existing comment before retrying. Record the comment ID and URL. When the user explicitly excludes posting, keep the verdict in this task. If authorized publication fails, preserve it as pending and report the concrete failure instead of silently treating the local draft as published.
5. Synchronize the confidence label with the current verified assessment using the monitoring protocol. Feed a score below 5/5 and all remaining findings into the next fixer pass when there is actionable work. If required local verification or a designated external review is missing rather than a code finding, apply the protocol's distinction between useful waiting and an external blocker. GitHub CI is supplemental. A persistent disputed finding needs evidence or a user decision, not repetitive no-op pushes or weaker scoring.
6. Continue through new comments, new commits, changed requirements, and relevant CI changes until the completion gate passes or the protocol requires a blocked stop. While waiting for local verification or an external review that can advance the result, keep the coordinator active with bounded waits and fresh snapshots; workers do not remain in independent polling loops. GitHub CI is context only. When no authorized action can advance the PR and progress requires external intervention, end with the blocker and resume condition. Do not re-review unchanged code or react to your own summary comments as new requests.

## Finish

Apply the monitoring protocol's full completion gate yourself against a fresh remote snapshot. A worker's 5/5 alone is insufficient: require its current head/base, reconciled feedback, passed required local gates, and any user-designated reviewer's verdict. GitHub CI/status contexts are supplemental. New evidence returns the PR to the loop.

On verified success, report the PR, reviewed SHA, verdict URL when posted, and verification summary. On an external blocker with no useful remaining action, preserve pending work and report a blocked result with the concrete prerequisite for resuming; do not claim success. On cancellation or a closed/merged PR, report that state without inventing a 5/5. Interrupt remaining workers before cleanup; remove only owned scratch worktrees and preserve uncommitted or unpublished fixes. Never merge the PR as part of this skill.
