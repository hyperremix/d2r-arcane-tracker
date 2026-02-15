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

type SearchClauses = {
  clauses: string[];
  params: Array<string | number>;
};

function toNullable<T>(value: T | undefined): T | null {
  return value ?? null;
}

function toOptionalIsoTimestamp(value: Date | string | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  return toISOString(value) ?? undefined;
}

function buildVaultItemValues(input: VaultItemUpsertInput) {
  const nowIso = new Date().toISOString();

  return {
    id: input.id ?? input.fingerprint,
    fingerprint: input.fingerprint,
    itemName: input.itemName,
    itemCode: toNullable(input.itemCode),
    quality: input.quality,
    ethereal: input.ethereal,
    socketCount: toNullable(input.socketCount),
    rawItemJson: input.rawItemJson,
    sourceCharacterId: toNullable(input.sourceCharacterId),
    sourceCharacterName: toNullable(input.sourceCharacterName),
    sourceFileType: input.sourceFileType,
    locationContext: input.locationContext,
    stashTab: toNullable(input.stashTab),
    gridX: toNullable(input.gridX),
    gridY: toNullable(input.gridY),
    gridWidth: toNullable(input.gridWidth),
    gridHeight: toNullable(input.gridHeight),
    equippedSlotId: toNullable(input.equippedSlotId),
    iconFileName: toNullable(input.iconFileName),
    isSocketedItem: input.isSocketedItem ?? false,
    grailItemId: toNullable(input.grailItemId),
    isPresentInLatestScan: input.isPresentInLatestScan ?? true,
    lastSeenAt: toISOString(input.lastSeenAt) ?? nowIso,
    vaultedAt: toISOString(input.vaultedAt),
    unvaultedAt: toISOString(input.unvaultedAt),
  };
}

type VaultItemValues = ReturnType<typeof buildVaultItemValues>;
type VaultItemUpdatePayload = Partial<VaultItemValues>;

function setPayloadValue<K extends keyof VaultItemUpdatePayload>(
  payload: VaultItemUpdatePayload,
  key: K,
  value: VaultItemUpdatePayload[K] | undefined,
): void {
  if (value !== undefined) {
    payload[key] = value;
  }
}

function buildVaultItemUpdatePayload(updates: VaultItemUpdateInput) {
  const payload: VaultItemUpdatePayload = {};

  setPayloadValue(payload, 'itemName', updates.itemName);
  setPayloadValue(payload, 'itemCode', updates.itemCode);
  setPayloadValue(payload, 'quality', updates.quality);
  setPayloadValue(payload, 'ethereal', updates.ethereal);
  setPayloadValue(payload, 'socketCount', updates.socketCount);
  setPayloadValue(payload, 'rawItemJson', updates.rawItemJson);
  setPayloadValue(payload, 'sourceCharacterId', updates.sourceCharacterId);
  setPayloadValue(payload, 'sourceCharacterName', updates.sourceCharacterName);
  setPayloadValue(payload, 'sourceFileType', updates.sourceFileType);
  setPayloadValue(payload, 'locationContext', updates.locationContext);
  setPayloadValue(payload, 'stashTab', updates.stashTab);
  setPayloadValue(payload, 'gridX', updates.gridX);
  setPayloadValue(payload, 'gridY', updates.gridY);
  setPayloadValue(payload, 'gridWidth', updates.gridWidth);
  setPayloadValue(payload, 'gridHeight', updates.gridHeight);
  setPayloadValue(payload, 'equippedSlotId', updates.equippedSlotId);
  setPayloadValue(payload, 'iconFileName', updates.iconFileName);
  setPayloadValue(payload, 'isSocketedItem', updates.isSocketedItem);
  setPayloadValue(payload, 'grailItemId', updates.grailItemId);
  setPayloadValue(payload, 'isPresentInLatestScan', updates.isPresentInLatestScan);
  setPayloadValue(payload, 'lastSeenAt', toOptionalIsoTimestamp(updates.lastSeenAt));
  setPayloadValue(payload, 'vaultedAt', toOptionalIsoTimestamp(updates.vaultedAt));
  setPayloadValue(payload, 'unvaultedAt', toOptionalIsoTimestamp(updates.unvaultedAt));

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
        gridX: values.gridX,
        gridY: values.gridY,
        gridWidth: values.gridWidth,
        gridHeight: values.gridHeight,
        equippedSlotId: values.equippedSlotId,
        iconFileName: values.iconFileName,
        isSocketedItem: values.isSocketedItem,
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

function appendTextClause(query: SearchClauses, text: string | undefined): void {
  const normalized = text?.trim().toLowerCase();
  if (!normalized) {
    return;
  }

  const textQuery = `%${normalized}%`;
  query.clauses.push(
    '(lower(vi.item_name) LIKE ? OR lower(COALESCE(vi.item_code, "")) LIKE ? OR lower(vi.quality) LIKE ?)',
  );
  query.params.push(textQuery, textQuery, textQuery);
}

function appendCharacterClause(query: SearchClauses, characterId: string | undefined): void {
  if (!characterId) {
    return;
  }

  query.clauses.push('vi.source_character_id = ?');
  query.params.push(characterId);
}

function appendLocationClause(
  query: SearchClauses,
  locationContext: VaultItemFilter['locationContext'],
): void {
  if (!locationContext) {
    return;
  }

  query.clauses.push('vi.location_context = ?');
  query.params.push(locationContext);
}

function appendSourceFileTypeClause(
  query: SearchClauses,
  sourceFileType: VaultItemFilter['sourceFileType'],
): void {
  if (!sourceFileType) {
    return;
  }

  query.clauses.push('vi.source_file_type = ?');
  query.params.push(sourceFileType);
}

function appendPresentStateClause(
  query: SearchClauses,
  presentState: VaultItemFilter['presentState'],
): void {
  if (!presentState || presentState === 'all') {
    return;
  }

  query.clauses.push('vi.is_present_in_latest_scan = ?');
  query.params.push(presentState === 'present' ? 1 : 0);
}

function appendSocketedClause(
  query: SearchClauses,
  includeSocketed: VaultItemFilter['includeSocketed'],
): void {
  if (includeSocketed === true) {
    return;
  }

  query.clauses.push('COALESCE(vi.is_socketed_item, 0) = 0');
}

function appendCategoryClause(
  query: SearchClauses,
  categoryIds: VaultItemFilter['categoryIds'],
): void {
  if (!categoryIds || categoryIds.length === 0) {
    return;
  }

  const placeholders = categoryIds.map(() => '?').join(', ');
  query.clauses.push(
    `EXISTS (SELECT 1 FROM vault_item_categories vic WHERE vic.vault_item_id = vi.id AND vic.vault_category_id IN (${placeholders}))`,
  );
  query.params.push(...categoryIds);
}

function buildSearchQuery(filter: VaultItemFilter): SearchClauses {
  const query: SearchClauses = { clauses: [], params: [] };
  appendTextClause(query, filter.text);
  appendCharacterClause(query, filter.characterId);
  appendLocationClause(query, filter.locationContext);
  appendSourceFileTypeClause(query, filter.sourceFileType);
  appendPresentStateClause(query, filter.presentState);
  appendSocketedClause(query, filter.includeSocketed);
  appendCategoryClause(query, filter.categoryIds);
  return query;
}

function getSortByColumn(sortBy: VaultItemFilter['sortBy']): string {
  const sortByMap: Record<NonNullable<VaultItemFilter['sortBy']>, string> = {
    itemName: 'vi.item_name',
    lastSeenAt: 'vi.last_seen_at',
    createdAt: 'vi.created_at',
    updatedAt: 'vi.updated_at',
  };

  return sortByMap[sortBy ?? 'updatedAt'];
}

export function searchVaultItems(
  ctx: DatabaseContext,
  filter: VaultItemFilter,
): VaultItemSearchResult {
  const query = buildSearchQuery(filter);
  const whereClause = query.clauses.length > 0 ? `WHERE ${query.clauses.join(' AND ')}` : '';
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 50;
  const offset = (page - 1) * pageSize;
  const sortBy = getSortByColumn(filter.sortBy);
  const sortOrder = filter.sortOrder === 'asc' ? 'ASC' : 'DESC';

  const countRow = ctx.rawDb
    .prepare(`SELECT COUNT(*) as total FROM vault_items vi ${whereClause}`)
    .get(...query.params) as { total: number };

  const rows = ctx.rawDb
    .prepare(
      `SELECT vi.* FROM vault_items vi ${whereClause} ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`,
    )
    .all(...query.params, pageSize, offset) as (typeof vaultItems.$inferSelect)[];

  const mappedItems = rows.map(dbVaultItemToVaultItem);

  return {
    items: attachCategoryIds(ctx, mappedItems),
    total: countRow.total,
    page,
    pageSize,
  };
}
