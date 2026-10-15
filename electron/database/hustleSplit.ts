import { eq } from 'drizzle-orm';
import { resolveHustleSuccessorName } from '../utils/grailItemUtils';
import { simplifyItemName } from '../utils/objects';
import { schema } from './drizzle';
import type { DatabaseContext } from './types';

const { grailProgress, items, vaultItems } = schema;

/** Id of the Hustle runeword, which the item catalog no longer has. */
export const HUSTLE_ITEM_ID = 'hustle';

/** Catalog id of the runeword that took over Hustle in an item with this base item code. */
function getSuccessorItemId(itemCode: string | null): string {
  return simplifyItemName(resolveHustleSuccessorName(itemCode));
}

/**
 * Reign of the Warlock split the Hustle runeword into Mania (weapons) and Hysteria (body armor).
 * Moves Hustle vault items to the runeword their base item makes them, and Hustle finds to the
 * runeword of the same character's Hustle vault items. A find becomes Hysteria only when that
 * character's Hustle vault items are all body armor; otherwise it becomes Mania. Then removes the
 * Hustle item. Does nothing once Hustle is gone, so it runs only once.
 * Must run after the item catalog sync, which adds Mania and Hysteria.
 * @param ctx - Database context
 * @returns Whether Hustle was split
 */
export function splitHustleIntoSuccessors(ctx: DatabaseContext): boolean {
  const hustle = ctx.db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.id, HUSTLE_ITEM_ID))
    .get();
  if (!hustle) {
    return false;
  }

  const split = ctx.rawDb.transaction(() => {
    const hustleVaultItems = ctx.db
      .select({
        id: vaultItems.id,
        itemCode: vaultItems.itemCode,
        characterId: vaultItems.sourceCharacterId,
      })
      .from(vaultItems)
      .where(eq(vaultItems.grailItemId, HUSTLE_ITEM_ID))
      .all();

    const successorIdsByCharacter = new Map<string, Set<string>>();
    for (const vaultItem of hustleVaultItems) {
      const successorId = getSuccessorItemId(vaultItem.itemCode);
      ctx.db
        .update(vaultItems)
        .set({ grailItemId: successorId })
        .where(eq(vaultItems.id, vaultItem.id))
        .run();

      if (vaultItem.characterId) {
        const successorIds = successorIdsByCharacter.get(vaultItem.characterId) ?? new Set();
        successorIds.add(successorId);
        successorIdsByCharacter.set(vaultItem.characterId, successorIds);
      }
    }

    const hustleFinds = ctx.db
      .select({ id: grailProgress.id, characterId: grailProgress.characterId })
      .from(grailProgress)
      .where(eq(grailProgress.itemId, HUSTLE_ITEM_ID))
      .all();
    for (const find of hustleFinds) {
      const successorIds = successorIdsByCharacter.get(find.characterId);
      const itemId = successorIds?.size === 1 ? [...successorIds][0] : 'mania';
      ctx.db.update(grailProgress).set({ itemId }).where(eq(grailProgress.id, find.id)).run();
    }

    ctx.db.delete(items).where(eq(items.id, HUSTLE_ITEM_ID)).run();
  });
  split();
  console.log('[Database] Split the Hustle runeword into Mania and Hysteria');
  return true;
}
