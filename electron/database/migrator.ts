import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { type MigrationMeta, readMigrationFiles } from 'drizzle-orm/migrator';
import { hasAppTables, upgradeLegacyDatabase } from './legacyUpgrade';
import type { DatabaseContext } from './types';

/** Table in which drizzle records applied migrations. */
export const MIGRATIONS_TABLE = '__drizzle_migrations';

/**
 * Resolves the folder with the generated SQL migrations.
 * In development and tests this module runs from `electron/database`, next to `migrations/`.
 * In the bundled main process it runs from `dist-electron/main.js`; the build copies the folder
 * to `dist-electron/migrations` (see `copyMigrations` in vite.config.ts), which electron-builder
 * packs into the app archive.
 * @returns Absolute path of the migrations folder
 * @throws {Error} If the folder cannot be found
 */
export function resolveMigrationsFolder(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const folder = path.join(moduleDir, 'migrations');
  if (!existsSync(path.join(folder, 'meta', '_journal.json'))) {
    throw new Error(`Database migrations not found at ${folder}`);
  }
  return folder;
}

function countAppliedMigrations(ctx: DatabaseContext): number {
  const table = ctx.rawDb
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(MIGRATIONS_TABLE);
  if (!table) {
    return 0;
  }
  const row = ctx.rawDb.prepare(`SELECT COUNT(*) AS count FROM "${MIGRATIONS_TABLE}"`).get() as {
    count: number;
  };
  return row.count;
}

/** Records a migration as applied, exactly as drizzle's migrator does. */
function markMigrationApplied(ctx: DatabaseContext, migration: MigrationMeta): void {
  ctx.rawDb.exec(
    `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
  );
  ctx.rawDb
    .prepare(`INSERT INTO "${MIGRATIONS_TABLE}" ("hash", "created_at") VALUES (?, ?)`)
    .run(migration.hash, migration.folderMillis);
}

/**
 * A database with app tables but no recorded migrations was created by a version before
 * migrations existed. It is upgraded to the baseline schema and the baseline is marked as
 * applied, in one transaction, so the baseline's CREATE TABLE statements never run on it.
 */
function adoptLegacyDatabase(ctx: DatabaseContext, baseline: MigrationMeta): void {
  console.log('[Database] Upgrading a database created before schema migrations');
  const adopt = ctx.rawDb.transaction(() => {
    upgradeLegacyDatabase(ctx);
    markMigrationApplied(ctx, baseline);
  });
  adopt();
}

function warnAboutForeignKeyViolations(ctx: DatabaseContext): void {
  const violations = ctx.rawDb.pragma('foreign_key_check') as Array<{
    table: string;
    parent: string;
  }>;
  if (violations.length > 0) {
    const tables = [...new Set(violations.map((v) => `${v.table} -> ${v.parent}`))].join(', ');
    console.warn(
      `[Database] ${violations.length} row(s) reference missing parent rows (${tables}); they were kept as they are`,
    );
  }
}

/**
 * Applies pending schema migrations with drizzle's migrator.
 * Foreign keys are turned off while migrating (as SQLite's table-rebuild procedure requires;
 * `PRAGMA foreign_keys` is a no-op inside the migration transaction), so that rebuilding a
 * parent table does not cascade-delete or reject child rows. They are turned back on afterwards.
 * @param ctx - Database context
 * @param migrationsFolder - Folder with the generated migrations
 * @throws {Error} If a migration fails; the failed migrations are rolled back
 */
export function runMigrations(
  ctx: DatabaseContext,
  migrationsFolder: string = resolveMigrationsFolder(),
): void {
  const migrations = readMigrationFiles({ migrationsFolder });
  const [baseline] = migrations;
  if (!baseline) {
    throw new Error(`No database migrations found in ${migrationsFolder}`);
  }

  const appliedBefore = countAppliedMigrations(ctx);
  if (appliedBefore === 0 && hasAppTables(ctx, MIGRATIONS_TABLE)) {
    adoptLegacyDatabase(ctx, baseline);
  }

  const foreignKeysEnabled = ctx.rawDb.pragma('foreign_keys', { simple: true }) === 1;
  ctx.rawDb.pragma('foreign_keys = OFF');
  try {
    migrate(ctx.db, { migrationsFolder, migrationsTable: MIGRATIONS_TABLE });
  } finally {
    if (foreignKeysEnabled) {
      ctx.rawDb.pragma('foreign_keys = ON');
    }
  }

  const applied = countAppliedMigrations(ctx) - appliedBefore;
  if (applied > 0) {
    console.log(`[Database] Applied ${applied} schema migration(s)`);
    warnAboutForeignKeyViolations(ctx);
  }
}
