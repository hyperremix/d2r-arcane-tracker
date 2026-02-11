import { and, eq } from 'drizzle-orm';
import type {
  VaultItem,
  VaultItemFilter,
  VaultItemSearchResult,
  VaultItemUpdateInput,
  VaultItemUpsertByFingerprintInput,
  VaultItemUpsertInput,
} from '../types/grail';
import { dbVaultItemToVaultItem, toISOString } from './converters';
import { schema } from './drizzle';
import type { DatabaseContext } from './types';
import { getCategoryIdsByVaultItemIds, setVaultItemCategories } from './vault-categories';

const { vaultItems } = schema;

function buildVaultItemValues(input: VaultItemUpsertInput) {
  const nowIso = new Date().toISOString();

  return {
    id: input.id ?? input.fingerprint,
    fingerprint: input.fingerprint,
    itemName: input.itemName,
    itemCode: input.itemCode ?? null,
    quality: input.quality,
    ethereal: input.ethereal,
    socketCount: input.socketCount ?? null,
    rawItemJson: input.rawItemJson,
    sourceCharacterId: input.sourceCharacterId ?? null,
    sourceCharacterName: input.sourceCharacterName ?? null,
    sourceFileType: input.sourceFileType,
    locationContext: input.locationContext,
    stashTab: input.stashTab ?? null,
    grailItemId: input.grailItemId ?? null,
    isPresentInLatestScan: input.isPresentInLatestScan ?? true,
    lastSeenAt: toISOString(input.lastSeenAt) ?? nowIso,
    vaultedAt: toISOString(input.vaultedAt),
    unvaultedAt: toISOString(input.unvaultedAt),
  };
}

function buildVaultItemUpdatePayload(updates: VaultItemUpdateInput) {
  const payload: Partial<ReturnType<typeof buildVaultItemValues>> = {};
  const entries: [keyof VaultItemUpdateInput, keyof ReturnType<typeof buildVaultItemValues>][] = [
    ['itemName', 'itemName'],
    ['quality', 'quality'],
    ['ethereal', 'ethereal'],
    ['rawItemJson', 'rawItemJson'],
    ['sourceFileType', 'sourceFileType'],
    ['locationContext', 'locationContext'],
    ['isPresentInLatestScan', 'isPresentInLatestScan'],
  ];

  for (const [sourceKey, targetKey] of entries) {
    const value = updates[sourceKey];
    if (value !== undefined) {
      payload[targetKey] = value as never;
    }
  }

  if (updates.itemCode !== undefined) payload.itemCode = updates.itemCode;
  if (updates.socketCount !== undefined) payload.socketCount = updates.socketCount;
  if (updates.sourceCharacterId !== undefined)
    payload.sourceCharacterId = updates.sourceCharacterId;
  if (updates.sourceCharacterName !== undefined)
    payload.sourceCharacterName = updates.sourceCharacterName;
  if (updates.stashTab !== undefined) payload.stashTab = updates.stashTab;
  if (updates.grailItemId !== undefined) payload.grailItemId = updates.grailItemId;
  if (updates.lastSeenAt !== undefined)
    payload.lastSeenAt = toISOString(updates.lastSeenAt) ?? undefined;
  if (updates.vaultedAt !== undefined)
    payload.vaultedAt = toISOString(updates.vaultedAt) ?? undefined;
  if (updates.unvaultedAt !== undefined)
    payload.unvaultedAt = toISOString(updates.unvaultedAt) ?? undefined;

  return payload;
}

function attachCategoryIds(ctx: DatabaseContext, items: VaultItem[]): VaultItem[] {
  const categoryMap = getCategoryIdsByVaultItemIds(
    ctx,
    items.map((item) => item.id),
  );

  return items.map((item) => ({
    ...item,
    categoryIds: categoryMap[item.id] ?? [],
  }));
}

export function addVaultItem(ctx: DatabaseContext, input: VaultItemUpsertInput): VaultItem {
  const values = buildVaultItemValues(input);

  ctx.db.insert(vaultItems).values(values).run();

  if (input.categoryIds) {
    setVaultItemCategories(ctx, values.id, input.categoryIds);
  }

  const saved = getVaultItemById(ctx, values.id);
  if (!saved) {
    throw new Error(`Unable to add vault item: ${values.id}`);
  }

  return saved;
}

export function updateVaultItem(
  ctx: DatabaseContext,
  itemId: string,
  updates: VaultItemUpdateInput,
): VaultItem | null {
  const updatePayload = buildVaultItemUpdatePayload(updates);

  if (Object.keys(updatePayload).length > 0) {
    ctx.db.update(vaultItems).set(updatePayload).where(eq(vaultItems.id, itemId)).run();
  }

  if (updates.categoryIds !== undefined) {
    setVaultItemCategories(ctx, itemId, updates.categoryIds);
  }

  return getVaultItemById(ctx, itemId);
}

export function removeVaultItem(ctx: DatabaseContext, itemId: string): void {
  ctx.db.delete(vaultItems).where(eq(vaultItems.id, itemId)).run();
}

export function upsertVaultItemByFingerprint(
  ctx: DatabaseContext,
  input: VaultItemUpsertByFingerprintInput,
): VaultItem {
  const values = buildVaultItemValues(input);

  ctx.db
    .insert(vaultItems)
    .values(values)
    .onConflictDoUpdate({
      target: vaultItems.fingerprint,
      set: {
        itemName: values.itemName,
        itemCode: values.itemCode,
        quality: values.quality,
        ethereal: values.ethereal,
        socketCount: values.socketCount,
        rawItemJson: values.rawItemJson,
        sourceCharacterId: values.sourceCharacterId,
        sourceCharacterName: values.sourceCharacterName,
        sourceFileType: values.sourceFileType,
        locationContext: values.locationContext,
        stashTab: values.stashTab,
        grailItemId: values.grailItemId,
        isPresentInLatestScan: values.isPresentInLatestScan,
        lastSeenAt: values.lastSeenAt,
        vaultedAt: values.vaultedAt,
        unvaultedAt: values.unvaultedAt,
      },
    })
    .run();

  const persisted = ctx.db
    .select()
    .from(vaultItems)
    .where(eq(vaultItems.fingerprint, input.fingerprint))
    .get();

  if (!persisted) {
    throw new Error(`Unable to upsert vault item with fingerprint: ${input.fingerprint}`);
  }

  if (input.categoryIds) {
    setVaultItemCategories(ctx, persisted.id, input.categoryIds);
  }

  const saved = getVaultItemById(ctx, persisted.id);
  if (!saved) {
    throw new Error(`Unable to load upserted vault item: ${persisted.id}`);
  }

  return saved;
}

export function markVaultItemAsMissing(
  ctx: DatabaseContext,
  fingerprint: string,
  sourceCharacterName?: string,
): void {
  ctx.db
    .update(vaultItems)
    .set({
      isPresentInLatestScan: false,
      sourceCharacterName: sourceCharacterName ?? null,
    })
    .where(eq(vaultItems.fingerprint, fingerprint))
    .run();
}

export function reconcileVaultItemsForScan(
  ctx: DatabaseContext,
  scan: {
    sourceFileType: 'd2s' | 'sss' | 'd2x' | 'd2i';
    sourceCharacterId?: string;
    sourceCharacterName?: string;
    presentFingerprints: string[];
    lastSeenAt?: Date;
  },
): void {
  const presentSet = new Set(scan.presentFingerprints);
  const filter = scan.sourceCharacterId
    ? and(
        eq(vaultItems.sourceFileType, scan.sourceFileType),
        eq(vaultItems.sourceCharacterId, scan.sourceCharacterId),
      )
    : eq(vaultItems.sourceFileType, scan.sourceFileType);

  const existingRows = ctx.db.select().from(vaultItems).where(filter).all();
  const seenAt = toISOString(scan.lastSeenAt) ?? new Date().toISOString();

  const tx = ctx.rawDb.transaction(() => {
    for (const row of existingRows) {
      const isPresent = presentSet.has(row.fingerprint);
      ctx.db
        .update(vaultItems)
        .set({
          isPresentInLatestScan: isPresent,
          lastSeenAt: isPresent ? seenAt : row.lastSeenAt,
          sourceCharacterName: scan.sourceCharacterName ?? row.sourceCharacterName,
        })
        .where(eq(vaultItems.id, row.id))
        .run();
    }
  });

  tx();
}

export function setVaultItemsPresentInLatestScan(
  ctx: DatabaseContext,
  fingerprints: string[],
  present: boolean,
  lastSeenAt?: Date,
  sourceCharacterName?: string,
): void {
  if (fingerprints.length === 0) {
    return;
  }

  const seenAt = toISOString(lastSeenAt) ?? new Date().toISOString();

  for (const fingerprint of fingerprints) {
    ctx.db
      .update(vaultItems)
      .set({
        isPresentInLatestScan: present,
        lastSeenAt: present ? seenAt : undefined,
        sourceCharacterName: sourceCharacterName ?? null,
      })
      .where(eq(vaultItems.fingerprint, fingerprint))
      .run();
  }
}

export function getVaultItemById(ctx: DatabaseContext, itemId: string): VaultItem | null {
  const row = ctx.db.select().from(vaultItems).where(eq(vaultItems.id, itemId)).get();
  if (!row) {
    return null;
  }

  return attachCategoryIds(ctx, [dbVaultItemToVaultItem(row)])[0];
}

export function searchVaultItems(
  ctx: DatabaseContext,
  filter: VaultItemFilter,
): VaultItemSearchResult {
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (filter.text) {
    const textQuery = `%${filter.text.trim().toLowerCase()}%`;
    clauses.push(
      '(lower(vi.item_name) LIKE ? OR lower(COALESCE(vi.item_code, "")) LIKE ? OR lower(vi.quality) LIKE ?)',
    );
    params.push(textQuery, textQuery, textQuery);
  }

  if (filter.characterId) {
    clauses.push('vi.source_character_id = ?');
    params.push(filter.characterId);
  }

  if (filter.locationContext) {
    clauses.push('vi.location_context = ?');
    params.push(filter.locationContext);
  }

  if (filter.sourceFileType) {
    clauses.push('vi.source_file_type = ?');
    params.push(filter.sourceFileType);
  }

  if (filter.presentState && filter.presentState !== 'all') {
    clauses.push('vi.is_present_in_latest_scan = ?');
    params.push(filter.presentState === 'present' ? 1 : 0);
  }

  if (filter.categoryIds && filter.categoryIds.length > 0) {
    const placeholders = filter.categoryIds.map(() => '?').join(', ');
    clauses.push(
      `EXISTS (SELECT 1 FROM vault_item_categories vic WHERE vic.vault_item_id = vi.id AND vic.vault_category_id IN (${placeholders}))`,
    );
    params.push(...filter.categoryIds);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const sortByMap: Record<NonNullable<VaultItemFilter['sortBy']>, string> = {
    itemName: 'vi.item_name',
    lastSeenAt: 'vi.last_seen_at',
    createdAt: 'vi.created_at',
    updatedAt: 'vi.updated_at',
  };

  const sortBy = sortByMap[filter.sortBy ?? 'updatedAt'];
  const sortOrder = filter.sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countRow = ctx.rawDb
    .prepare(`SELECT COUNT(*) as total FROM vault_items vi ${whereClause}`)
    .get(...params) as { total: number };

  const rows = ctx.rawDb
    .prepare(
      `SELECT vi.* FROM vault_items vi ${whereClause} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, offset) as (typeof vaultItems.$inferSelect)[];

  const mappedItems = rows.map(dbVaultItemToVaultItem);

  return {
    items: attachCategoryIds(ctx, mappedItems),
    total: countRow.total,
    page,
    pageSize,
  };
}
