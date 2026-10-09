import { isNotNull } from 'drizzle-orm';
import { schema } from './drizzle';
import { clearAllSaveFileStates } from './save-file-states';
import type { DatabaseContext } from './types';

const { characters, grailProgress, runs, vaultItems } = schema;

export async function backup(ctx: DatabaseContext, backupPath: string): Promise<void> {
  await ctx.rawDb.backup(backupPath);
}

export function close(ctx: DatabaseContext): void {
  ctx.rawDb.close();
}

/**
 * Deletes characters, grail progress and save file states in one transaction.
 * Run tracker history and vault items are kept; their character references are cleared first
 * because runs.character_id has no ON DELETE action and would otherwise make the delete fail.
 * @param ctx - Database context
 */
export function truncateUserData(ctx: DatabaseContext): void {
  try {
    const truncate = ctx.rawDb.transaction(() => {
      ctx.db.update(runs).set({ characterId: null }).where(isNotNull(runs.characterId)).run();
      ctx.db
        .update(vaultItems)
        .set({ sourceCharacterId: null })
        .where(isNotNull(vaultItems.sourceCharacterId))
        .run();
      ctx.db.delete(characters).run();
      ctx.db.delete(grailProgress).run();
      clearAllSaveFileStates(ctx);
    });
    truncate();

    console.log(
      'User data truncated: characters, grail_progress, and save_file_states tables cleared',
    );
  } catch (error) {
    console.error('Failed to truncate user data:', error);
    throw error;
  }
}

export function getDatabasePath(ctx: DatabaseContext): string {
  return ctx.dbPath;
}
