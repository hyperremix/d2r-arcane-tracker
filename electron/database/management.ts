import { schema } from './drizzle';
import { clearAllSaveFileStates } from './save-file-states';
import type { DatabaseContext } from './types';

const { characters, grailProgress } = schema;

export function backup(ctx: DatabaseContext, backupPath: string): void {
  ctx.rawDb.backup(backupPath);
}

export function close(ctx: DatabaseContext): void {
  ctx.rawDb.close();
}

export function truncateUserData(ctx: DatabaseContext): void {
  try {
    ctx.db.delete(characters).run();
    ctx.db.delete(grailProgress).run();
    clearAllSaveFileStates(ctx);

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
