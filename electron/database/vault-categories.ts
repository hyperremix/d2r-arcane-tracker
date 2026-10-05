import { desc, eq, inArray } from 'drizzle-orm';
import type { VaultCategory } from '../types/grail';
import { dbVaultCategoryToVaultCategory } from './converters';
import { schema } from './drizzle';
import type { DatabaseContext } from './types';

const { vaultCategories, vaultItemCategories } = schema;

export function getAllVaultCategories(ctx: DatabaseContext): VaultCategory[] {
  const rows = ctx.db.select().from(vaultCategories).orderBy(desc(vaultCategories.updatedAt)).all();
  return rows.map(dbVaultCategoryToVaultCategory);
}

export function getVaultCategoryById(
  ctx: DatabaseContext,
  categoryId: string,
): VaultCategory | null {
  const row = ctx.db.select().from(vaultCategories).where(eq(vaultCategories.id, categoryId)).get();
  return row ? dbVaultCategoryToVaultCategory(row) : null;
}

export function setVaultItemCategories(
  ctx: DatabaseContext,
  vaultItemId: string,
  categoryIds: string[],
): void {
  const dedupedCategoryIds = [...new Set(categoryIds)];

  const tx = ctx.rawDb.transaction(() => {
    ctx.db
      .delete(vaultItemCategories)
      .where(eq(vaultItemCategories.vaultItemId, vaultItemId))
      .run();

    if (dedupedCategoryIds.length === 0) {
      return;
    }

    for (const categoryId of dedupedCategoryIds) {
      ctx.db
        .insert(vaultItemCategories)
        .values({
          vaultItemId,
          vaultCategoryId: categoryId,
        })
        .onConflictDoNothing()
        .run();
    }
  });

  tx();
}

export function getCategoryIdsByVaultItemIds(
  ctx: DatabaseContext,
  vaultItemIds: string[],
): Record<string, string[]> {
  if (vaultItemIds.length === 0) {
    return {};
  }

  const mappingRows = ctx.db
    .select()
    .from(vaultItemCategories)
    .where(inArray(vaultItemCategories.vaultItemId, vaultItemIds))
    .all();

  const categoryMap: Record<string, string[]> = {};
  for (const row of mappingRows) {
    if (!categoryMap[row.vaultItemId]) {
      categoryMap[row.vaultItemId] = [];
    }
    categoryMap[row.vaultItemId].push(row.vaultCategoryId);
  }

  return categoryMap;
}
