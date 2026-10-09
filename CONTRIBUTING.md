# Contributing

Bug reports, feature ideas, docs fixes and pull requests are welcome. For larger changes, open an issue first so we can agree on the approach. By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Setup

You need [Bun](https://bun.sh) 1.3.8 (pinned in `package.json`), Node.js 22.12 or later (required by Electron 44, Vite 8 and Vitest 5), and Git. D2R is only needed to test game-related features. Auto mode and the installer are Windows-only. Everything else runs on macOS and Linux too.

```bash
git clone https://github.com/<you>/d2r-arcane-tracker.git
cd d2r-arcane-tracker
bun install
bun run rebuild   # compile native modules (better-sqlite3) for Electron
bun run dev       # start Vite and Electron
```

`better-sqlite3` ships Node-API prebuilds that load in both Node (tests) and Electron, so a rebuild is rarely needed. If you still see `NODE_MODULE_VERSION` errors after upgrading Electron, run `bun run rebuild` again.

For attaching a debugger, see [docs/DEBUGGING.md](docs/DEBUGGING.md).

### Development database

`grail.db` in the repo root holds sample characters and progress. To use it, restore it via **Settings → Database → Restore**, or copy it over the development database while the app is closed:

| OS | Development database path |
| --- | --- |
| Windows | `%APPDATA%\@hyperremix\d2r-arcane-tracker\grail.db` |
| macOS | `~/Library/Application Support/@hyperremix/d2r-arcane-tracker/grail.db` |
| Linux | `$XDG_CONFIG_HOME/@hyperremix/d2r-arcane-tracker/grail.db`, or `~/.config/@hyperremix/d2r-arcane-tracker/grail.db` if `XDG_CONFIG_HOME` is unset |

Delete the file to start fresh. The schema is migrated and item data is seeded on startup, so any database works. Don't commit changes to `grail.db` unless you're updating the sample data on purpose.

## Project layout

```text
src/                 React renderer
  components/        UI by feature (grail, runtracker, settings, widget, ...); ui/ = shadcn components
  stores/            Zustand stores
  i18n/              translations.ts (keys) and locales/
electron/            Main process
  services/          save file monitor, run tracker, memory reader, terror zones, updates
  ipc/               IPC contract (channels, payloads, validators), handler registry, preload API
  ipc-handlers/      main-process IPC handlers
  database/          SQLite (better-sqlite3 + drizzle-orm)
  items/             Holy Grail item data
  config/            D2R build and memory pattern tables
scripts/             debugging and memory-research helpers
config/              shared build-tool config (d2s source aliases for Vite and Vitest)
docs/                user guides, developer docs, GitHub Pages site
```

Stack: Electron 44, React 18, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (Base UI), Zustand, i18next, Biome and Vitest.

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
| `bun run db:generate` | Generate a database migration from the drizzle schema ([Changing the database schema](#changing-the-database-schema)) |

A pre-commit hook runs `typecheck` and Biome on staged files.

## Changing the database schema

The drizzle schema in `electron/database/drizzle/schema/` is the single source of truth. The app applies pending migrations from `electron/database/migrations/` at startup (`initializeSchema` in `electron/database/schema.ts`).

1. Edit the drizzle schema.
2. Run `bun run db:generate -- --name <short_description>`. drizzle-kit writes `NNNN_<short_description>.sql` and updates `migrations/meta/`.
3. Review the SQL and commit it together with the `meta/` changes. Never edit a migration that is already on `main`; add a new one.

Some things drizzle-kit doesn't generate, so add them to the migration by hand:

- **Triggers.** Every table with `updated_at` has an `update_<table>_timestamp` trigger (see `0000_baseline.sql`). Changes that rebuild a table (`__new_<table>`, for example a changed foreign key) drop its trigger, so recreate it at the end.
- **Data changes and one-time repairs.** Use `bun run db:generate -- --custom --name <short_description>` for an empty migration.

The migration runner turns foreign keys off while migrating, so table rebuilds don't cascade-delete child rows. Add a test in `electron/database/migrator.test.ts` for migrations that move data. Default settings live in `DEFAULT_SETTINGS` in `electron/database/settings.ts`, not in migrations.

Databases created before migrations existed have no recorded migrations. On their first start, `electron/database/legacyUpgrade.ts` brings them to the baseline and marks the baseline as applied. Leave that module alone for new schema changes.

## Making changes

Coding, i18n, testing and Electron safety conventions are in [AGENTS.md](AGENTS.md). They apply to human contributors too. In short: TypeScript with named exports, every UI string goes through `t(...)`, tests use Vitest and describe their scenarios, and inputs are validated at IPC boundaries.

To add an IPC channel, declare it in `electron/ipc/contract.ts` first. The type checker then requires its argument validator in `electron/ipc/validators.ts` and checks the `handle()` registration and the `window.electronAPI` method in `electron/ipc/api.ts` against it; the tests in `electron/ipc/` fail while the handler or the API method is missing. Renderer code subscribes to main-process events with `onMainEvent()` from `src/lib/ipcEvents.ts` and returns the unsubscribe function from the effect cleanup.

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
