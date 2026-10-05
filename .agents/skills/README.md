# Agent Skills

Skills shared by Claude Code (`.claude/skills/`, symlinked here) and Codex (`.agents/skills/`).

## Installed from skills.sh

Pinned in `skills-lock.json` and gitignored; their `.claude/skills/` symlinks are committed and resolve once restored. Restore them after cloning with:

```sh
bunx skills experimental_install
```

Add a new one with `bunx skills add <owner/repo> --skill <name> -a claude-code -a codex`, then commit the updated `skills-lock.json` and the new `.claude/skills/<name>` symlink.

- `code-review`, `grill-me` from `mattpocock/skills`
- `find-skills` from `vercel-labs/skills`
- `security-review` from `getsentry/skills`
- `shadcn` from `shadcn/ui`
- `systematic-debugging`, `test-driven-development` from `obra/superpowers`
- `unslop` from `cursor/plugins`
- `vercel-react-best-practices`, `web-design-guidelines` from `vercel-labs/agent-skills`

## Locally maintained

Committed in this directory, adapted from the ChessCue repository:

- `address-pr-feedback`, `pr-review`, `shepherd-pr`: PR feedback, merge-confidence review, and the coordinator loop that runs both.
- `resolving-merge-conflicts`: originally from `mattpocock/skills`, which no longer publishes it.
