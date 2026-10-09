import { syncItemCatalog } from './items';
import { runMigrations } from './migrator';
import { cleanupCorruptedSettings, ensureDefaultSettings } from './settings';
import type { DatabaseContext } from './types';

/**
 * Prepares a freshly opened database for use. This is the single entry point for schema setup:
 * 1. applies pending schema migrations (upgrading databases created before migrations existed),
 * 2. adds missing default settings and removes corrupted setting values,
 * 3. syncs the items table with the Holy Grail item catalog if the catalog changed.
 * @param ctx - Database context
 * @throws {Error} If a migration fails
 */
export function initializeSchema(ctx: DatabaseContext): void {
  runMigrations(ctx);
  ensureDefaultSettings(ctx);
  cleanupCorruptedSettings(ctx);
  syncItemCatalog(ctx);
}
