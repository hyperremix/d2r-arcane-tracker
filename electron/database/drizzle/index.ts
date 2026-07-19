import type Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export { schema };

export type { DbCharacter, DbCharacterInsert } from './schema/characters';
export type { DbGrailProgress, DbGrailProgressInsert } from './schema/grailProgress';
// Re-export schema types
export type { DbItem, DbItemInsert } from './schema/items';
export type { DbRunItem, DbRunItemInsert } from './schema/runItems';
export type { DbRun, DbRunInsert } from './schema/runs';
export type { DbSaveFileState, DbSaveFileStateInsert } from './schema/saveFileStates';
export type { DbSession, DbSessionInsert } from './schema/sessions';
export type { DbSetting, DbSettingInsert } from './schema/settings';
export type { DbVaultCategory, DbVaultCategoryInsert } from './schema/vaultCategories';
export type { DbVaultItemCategory, DbVaultItemCategoryInsert } from './schema/vaultItemCategories';
export type { DbVaultItem, DbVaultItemInsert } from './schema/vaultItems';

/**
 * Creates a Drizzle ORM instance from an existing better-sqlite3 database connection.
 * @param db - The better-sqlite3 database instance
 * @returns Drizzle ORM instance with full schema awareness
 */
export function createDrizzleDb(db: Database.Database) {
  return drizzle(db, { schema });
}

export type DrizzleDb = ReturnType<typeof createDrizzleDb>;
