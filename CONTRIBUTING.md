# Contributing

Bug reports, feature ideas, docs fixes and pull requests are welcome. For larger changes, open an issue first so we can agree on the approach. By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Setup

You need [Bun](https://bun.sh) 1.3.8 (pinned in `package.json`), Node.js 20 or later for the helper scripts, and Git. D2R is only needed to test game-related features. Auto mode and the installer are Windows-only. Everything else runs on macOS and Linux too.

```bash
git clone https://github.com/<you>/d2r-arcane-tracker.git
cd d2r-arcane-tracker
bun install
bun run rebuild   # compile native modules (better-sqlite3) for Electron
bun run dev       # start Vite and Electron
```

Run `bun run rebuild` again after upgrading Electron or if you see `NODE_MODULE_VERSION` errors. Those mean `better-sqlite3` was built for a different Node or Electron version.

For attaching a debugger, see [docs/DEBUGGING.md](docs/DEBUGGING.md).

### Development database

`grail.db` in the repo root holds sample characters and progress. To use it, restore it via **Settings → Database → Restore**, or copy it over the development database while the app is closed:

| OS | Development database path |
| --- | --- |
| Windows | `%APPDATA%\@hyperremix\d2r-arcane-tracker\grail.db` |
| macOS | `~/Library/Application Support/@hyperremix/d2r-arcane-tracker/grail.db` |
| Linux | `~/.config/@hyperremix/d2r-arcane-tracker/grail.db` |

Delete the file to start fresh. The schema is migrated and item data is seeded on startup, so any database works. Don't commit changes to `grail.db` unless you're updating the sample data on purpose.

## Project layout

```text
src/                 React renderer
  components/        UI by feature (grail, runtracker, settings, widget, ...); ui/ = shadcn components
  stores/            Zustand stores
  i18n/              translations.ts (keys) and locales/
electron/            Main process
  services/          save file monitor, run tracker, memory reader, terror zones, updates
  ipc-handlers/      IPC endpoints exposed via preload.ts
  database/          SQLite (better-sqlite3 + drizzle-orm)
  items/             Holy Grail item data
  config/            D2R build and memory pattern tables
scripts/             debugging and memory-research helpers
docs/                user guides, developer docs, GitHub Pages site
```

Stack: Electron 30, React 18, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (Base UI), Zustand, i18next, Biome and Vitest.

## Scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | Run the app in development |
| `bun run dev:debug` | Same, plus debugger setup ([DEBUGGING.md](docs/DEBUGGING.md)) |
| `bun run typecheck` | TypeScript, renderer and main |
| `bun run lint` / `lint:fix` | Biome lint |
| `bun run format` / `format:fix` | Biome format |
| `bun run check` / `check:fix` | Biome lint, format and import sorting |
| `bun run test` / `test:run` | Vitest in watch mode, or a single run |
| `bun run test:coverage` | Tests with coverage (what CI runs) |
| `bun run build` | Typecheck and build the Windows installer ([RELEASE.md](docs/RELEASE.md)) |

A pre-commit hook runs `typecheck` and Biome on staged files.

## Making changes

Coding, i18n, testing and Electron safety conventions are in [AGENTS.md](AGENTS.md). They apply to human contributors too. In short: TypeScript with named exports, every UI string goes through `t(...)`, tests use Vitest and describe their scenarios, and inputs are validated at IPC boundaries.

Before opening a PR, run the same checks as CI:

```bash
bun run typecheck && bun run format && bun run lint && bun run check && bun run test:run
```

Then:

1. Branch from `main` (`feat/...`, `fix/...`).
2. Use [Conventional Commits](https://www.conventionalcommits.org/) for messages, for example `fix(runtracker): end run when D2R exits`.
3. Add or update tests when behavior changes, and update [docs](docs/) when user-facing behavior changes.
4. Open the PR and fill in the [template](.github/pull_request_template.md). Add screenshots for UI changes.

CI must pass, and a maintainer will review before merging.

## Reporting issues

Use the [bug report](https://github.com/hyperremix/d2r-arcane-tracker/issues/new?template=bug_report.yml) or [feature request](https://github.com/hyperremix/d2r-arcane-tracker/issues/new?template=feature_request.yml) forms. Ask questions in [Discussions](https://github.com/hyperremix/d2r-arcane-tracker/discussions). Report security issues privately, as described in [SECURITY.md](SECURITY.md).
