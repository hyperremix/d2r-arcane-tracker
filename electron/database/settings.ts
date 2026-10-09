import { eq } from 'drizzle-orm';
import type { Settings } from '../types/grail';
import { getSeededSettings, parseSettings } from '../utils/settingsCodec';
import { schema } from './drizzle';
import type { DatabaseContext } from './types';

const { settings } = schema;

/**
 * Reads all settings, parsed to their types; settings that are not stored get their default.
 * @param ctx - Database context
 * @returns The typed settings
 */
export function getAllSettings(ctx: DatabaseContext): Settings {
  const dbSettings = ctx.db.select().from(settings).all();
  const settingsMap: Record<string, string> = {};
  for (const setting of dbSettings) {
    settingsMap[setting.key] = setting.value ?? '';
  }

  return parseSettings(settingsMap);
}

export function setSetting(ctx: DatabaseContext, key: keyof Settings, value: string): void {
  ctx.db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value },
    })
    .run();
}

/**
 * Inserts the seeded default value of every setting that has no row yet. Existing values are kept.
 * The seeded settings and their stored text come from the settings codec.
 * @param ctx - Database context
 */
export function ensureDefaultSettings(ctx: DatabaseContext): void {
  ctx.db.insert(settings).values(getSeededSettings()).onConflictDoNothing().run();
}

/**
 * Cleans up corrupted settings that have the value "[object Object]".
 * This can happen when an object is coerced to a string instead of being JSON.stringify'd.
 * @param ctx - Database context
 * @returns Number of corrupted settings cleaned up
 */
export function cleanupCorruptedSettings(ctx: DatabaseContext): number {
  const result = ctx.db.delete(settings).where(eq(settings.value, '[object Object]')).run();

  if (result.changes > 0) {
    console.log(`[cleanupCorruptedSettings] Cleaned up ${result.changes} corrupted setting(s)`);
  }

  return result.changes;
}
