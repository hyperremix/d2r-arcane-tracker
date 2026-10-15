import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { resolveHustleSuccessorName } from '../utils/grailItemUtils';
import { simplifyItemName } from '../utils/objects';
import { schema } from './drizzle';
import type { DatabaseContext } from './types';

const { grailProgress, items, vaultItems } = schema;

/** Id of the Hustle runeword, which the item catalog no longer has. */
export const HUSTLE_ITEM_ID = 'hustle';

/** Catalog ids of the runewords that took over Hustle, in the order a find is assigned to them. */
const SUCCESSOR_ITEM_IDS = ['mania', 'hysteria'];

/** Catalog id of the runeword that took over Hustle in an item with this base item code. */
function getSuccessorItemId(itemCode: string | null): string {
  return simplifyItemName(resolveHustleSuccessorName(itemCode));
}

/**
 * Reign of the Warlock split the Hustle runeword into Mania (weapons) and Hysteria (body armor).
 * Moves Hustle vault items to the runeword their base item makes them. A Hustle find becomes a
 * find of each runeword that the same character's Hustle vault items moved to: the find keeps its
 * row for Mania (or Hysteria when that is the only one), and a copy of the row is added for the
 * other. A find of a character without Hustle vault items becomes Mania, because the base item is
 * unknown. Then removes the Hustle item. Does nothing once Hustle is gone, so it runs only once.
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
      .select()
      .from(grailProgress)
      .where(eq(grailProgress.itemId, HUSTLE_ITEM_ID))
      .all();
    for (const find of hustleFinds) {
      const characterSuccessorIds = successorIdsByCharacter.get(find.characterId);
      const [firstId = 'mania', ...otherIds] = SUCCESSOR_ITEM_IDS.filter((id) =>
        characterSuccessorIds?.has(id),
      );
      ctx.db
        .update(grailProgress)
        .set({ itemId: firstId })
        .where(eq(grailProgress.id, find.id))
        .run();
      if (otherIds.length === 0) {
        continue;
      }

      // Copy the row as the update left it, so a trigger that stamps updated_at on the update
      // does not make the copies differ from the original. Rows that point at the find, such as
      // run items, stay with the original row.
      const updatedFind = ctx.db
        .select()
        .from(grailProgress)
        .where(eq(grailProgress.id, find.id))
        .get();
      for (const itemId of otherIds) {
        ctx.db
          .insert(grailProgress)
          .values({ ...(updatedFind ?? find), id: randomUUID(), itemId })
          .run();
      }
    }

    ctx.db.delete(items).where(eq(items.id, HUSTLE_ITEM_ID)).run();
  });
  split();
  console.log('[Database] Split the Hustle runeword into Mania and Hysteria');
  return true;
}
