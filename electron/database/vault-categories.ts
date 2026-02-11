import { desc, eq, inArray } from 'drizzle-orm';
import type {
  VaultCategory,
  VaultCategoryCreateInput,
  VaultCategoryUpdateInput,
} from '../types/grail';
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

export function addVaultCategory(ctx: DatabaseContext, input: VaultCategoryCreateInput): void {
  ctx.db
    .insert(vaultCategories)
    .values({
      id: input.id,
      name: input.name,
      color: input.color ?? null,
      metadata: input.metadata ?? null,
    })
    .run();
}

export function updateVaultCategory(
  ctx: DatabaseContext,
  categoryId: string,
  updates: VaultCategoryUpdateInput,
): void {
  const updatePayload: Partial<{
    name: string;
    color: string | null;
    metadata: string | null;
  }> = {};

  if (updates.name !== undefined) {
    updatePayload.name = updates.name;
  }

  if (updates.color !== undefined) {
    updatePayload.color = updates.color;
  }

  if (updates.metadata !== undefined) {
    updatePayload.metadata = updates.metadata;
  }

  if (Object.keys(updatePayload).length === 0) {
    return;
  }

  ctx.db.update(vaultCategories).set(updatePayload).where(eq(vaultCategories.id, categoryId)).run();
}

export function removeVaultCategory(ctx: DatabaseContext, categoryId: string): void {
  ctx.db.delete(vaultCategories).where(eq(vaultCategories.id, categoryId)).run();
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
