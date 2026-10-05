import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type {
  VaultItem,
  VaultItemFilter,
  VaultItemSearchResult,
  VaultItemUpdateInput,
  VaultItemUpsertByFingerprintInput,
  VaultItemUpsertInput,
} from '../types/grail';
import { isResourceStackFromRawJson, resolveStackCountFromRawJson } from '../utils/stackableItems';
import { GRAIL_BOOKMARK_FINGERPRINT_PREFIX, isCurrentlyVaulted } from '../utils/vaultState';
import { dbVaultItemToVaultItem, fromISOString, toISOString } from './converters';
import { schema } from './drizzle';
import type { DatabaseContext } from './types';
import { getCategoryIdsByVaultItemIds, setVaultItemCategories } from './vault-categories';

const { vaultItems } = schema;

interface SearchClauses {
  clauses: string[];
  params: Array<string | number>;
}

interface RawVaultSearchRow {
  id: string;
  fingerprint: string;
  item_name: string;
  item_code: string | null;
  quality: string;
  ethereal: number | boolean;
  socket_count: number | null;
  stack_count: number;
  raw_item_json: string;
  source_character_id: string | null;
  source_character_name: string | null;
  source_file_type: VaultItem['sourceFileType'];
  source_file_path: string | null;
  location_context: VaultItem['locationContext'];
  stash_tab: number | null;
  grid_x: number | null;
  grid_y: number | null;
  grid_width: number | null;
  grid_height: number | null;
  equipped_slot_id: number | null;
  icon_file_name: string | null;
  is_socketed_item: number | boolean | null;
  grail_item_id: string | null;
  is_present_in_latest_scan: number | boolean;
  last_seen_at: string | null;
  vaulted_at: string | null;
  unvaulted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

function toBoolean(value: number | boolean | null | undefined): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  return value === 1;
}

function extractRawRowSpatialFields(row: RawVaultSearchRow) {
  return {
    stashTab: row.stash_tab ?? undefined,
    gridX: row.grid_x ?? undefined,
    gridY: row.grid_y ?? undefined,
    gridWidth: row.grid_width ?? undefined,
    gridHeight: row.grid_height ?? undefined,
    equippedSlotId: row.equipped_slot_id ?? undefined,
  };
}

function mapRawVaultSearchRowToVaultItem(row: RawVaultSearchRow): VaultItem {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    itemName: row.item_name,
    itemCode: row.item_code ?? undefined,
    quality: row.quality,
    ethereal: toBoolean(row.ethereal),
    socketCount: row.socket_count ?? undefined,
    stackCount: row.stack_count ?? 1,
    rawItemJson: row.raw_item_json,
    sourceCharacterId: row.source_character_id ?? undefined,
    sourceCharacterName: row.source_character_name ?? undefined,
    sourceFileType: row.source_file_type,
    sourceFilePath: row.source_file_path ?? undefined,
    locationContext: row.location_context,
    ...extractRawRowSpatialFields(row),
    iconFileName: row.icon_file_name ?? undefined,
    isSocketedItem: toBoolean(row.is_socketed_item),
    grailItemId: row.grail_item_id ?? undefined,
    isPresentInLatestScan: toBoolean(row.is_present_in_latest_scan),
    lastSeenAt: fromISOString(row.last_seen_at),
    vaultedAt: fromISOString(row.vaulted_at),
    unvaultedAt: fromISOString(row.unvaulted_at),
    created: new Date(row.created_at ?? new Date().toISOString()),
    lastUpdated: new Date(row.updated_at ?? new Date().toISOString()),
  };
}

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
    stackCount: input.stackCount ?? 1,
    rawItemJson: input.rawItemJson,
    sourceCharacterId: toNullable(input.sourceCharacterId),
    sourceCharacterName: toNullable(input.sourceCharacterName),
    sourceFileType: input.sourceFileType,
    sourceFilePath: toNullable(input.sourceFilePath),
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
  setPayloadValue(payload, 'stackCount', updates.stackCount);
  setPayloadValue(payload, 'rawItemJson', updates.rawItemJson);
  setPayloadValue(payload, 'sourceCharacterId', updates.sourceCharacterId);
  setPayloadValue(payload, 'sourceCharacterName', updates.sourceCharacterName);
  setPayloadValue(payload, 'sourceFileType', updates.sourceFileType);
  setPayloadValue(payload, 'sourceFilePath', updates.sourceFilePath);
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

function findExistingStackableVaultItem(
  ctx: DatabaseContext,
  itemCode: string,
): VaultItem | undefined {
  const row = ctx.rawDb
    .prepare(
      `
        SELECT vi.*
        FROM vault_items vi
        WHERE vi.item_code = ?
          AND vi.fingerprint NOT LIKE ?
          AND vi.vaulted_at IS NOT NULL
          AND (vi.unvaulted_at IS NULL OR vi.unvaulted_at < vi.vaulted_at)
        LIMIT 1
      `,
    )
    .get(itemCode, `${GRAIL_BOOKMARK_FINGERPRINT_PREFIX}%`) as RawVaultSearchRow | undefined;

  if (!row) {
    return undefined;
  }

  return attachCategoryIds(ctx, [mapRawVaultSearchRowToVaultItem(row)])[0];
}

export interface VaultAddResult {
  item: VaultItem;
  /** Puts the vault back into the state it had before this add (used when removing the source item fails). */
  undo: () => void;
}

function findVaultItemByFingerprint(
  ctx: DatabaseContext,
  fingerprint: string,
): VaultItem | undefined {
  const row = ctx.db.select().from(vaultItems).where(eq(vaultItems.fingerprint, fingerprint)).get();
  return row ? getVaultItemById(ctx, row.id) : undefined;
}

/**
 * Restores every persisted column of a vault row (and its categories) to a previously read state.
 */
function restoreVaultItemRow(ctx: DatabaseContext, previous: VaultItem): void {
  const values = buildVaultItemValues({
    ...previous,
    id: previous.id,
    ethereal: previous.ethereal,
    quality: previous.quality,
    rawItemJson: previous.rawItemJson,
  });

  ctx.db
    .update(vaultItems)
    .set({
      ...values,
      id: undefined,
      lastSeenAt: toISOString(previous.lastSeenAt) ?? values.lastSeenAt,
      vaultedAt: toISOString(previous.vaultedAt) ?? null,
      unvaultedAt: toISOString(previous.unvaultedAt) ?? null,
    })
    .where(eq(vaultItems.id, previous.id))
    .run();

  setVaultItemCategories(ctx, previous.id, previous.categoryIds ?? []);
}

/**
 * Undoes a stack merge by taking the merged units out again. Restoring a snapshot would also wipe
 * units that another add merged into the same row in the meantime.
 */
function createMergeUndo(ctx: DatabaseContext, rowId: string, mergedCount: number) {
  return () => {
    const row = getVaultItemById(ctx, rowId);
    if (!row) {
      return;
    }

    const remaining = (row.stackCount ?? 1) - mergedCount;
    if (remaining >= 1) {
      ctx.db
        .update(vaultItems)
        .set({ stackCount: remaining })
        .where(eq(vaultItems.id, rowId))
        .run();
      return;
    }

    unvaultVaultItem(ctx, rowId);
  };
}

function createUndo(ctx: DatabaseContext, savedId: string, previous: VaultItem | undefined) {
  return () => {
    if (previous) {
      restoreVaultItemRow(ctx, previous);
      return;
    }

    // The row did not exist before this add. Keep its item data (the source item could not be
    // removed, but never throw away data that might be the only record) and just un-vault it.
    unvaultVaultItem(ctx, savedId);
  };
}

export function addVaultItemWithUndo(
  ctx: DatabaseContext,
  input: VaultItemUpsertInput,
): VaultAddResult {
  const nowIso = new Date().toISOString();

  // Stack merge: if incoming item is a resource stack (runes / resource-stash stacks) and one
  // already exists in the vault under the same item code, increment its count instead of creating
  // a duplicate row.
  if (input.itemCode && isResourceStackFromRawJson(input.rawItemJson, input.itemCode)) {
    const incomingCount = input.stackCount ?? resolveStackCountFromRawJson(input.rawItemJson);
    const existing = findExistingStackableVaultItem(ctx, input.itemCode);

    if (existing) {
      const mergedCount = (existing.stackCount ?? 1) + incomingCount;
      ctx.db
        .update(vaultItems)
        .set({ stackCount: mergedCount, unvaultedAt: null, vaultedAt: nowIso })
        .where(eq(vaultItems.id, existing.id))
        .run();

      const refreshed = getVaultItemById(ctx, existing.id);
      if (!refreshed) {
        throw new Error(`Unable to load vault item after stack merge: ${existing.id}`);
      }
      return { item: refreshed, undo: createMergeUndo(ctx, existing.id, incomingCount) };
    }
  }

  // Fingerprints describe an item by name/quality/position, so two different items can share one.
  // Upserting over a row that is still vaulted would overwrite (and lose) the vaulted item, so the
  // incoming item gets its own row instead.
  let normalizedInput = input;
  const rowWithSameFingerprint = findVaultItemByFingerprint(ctx, input.fingerprint);
  // (Entries without a source file are plain tags/bookmarks; adding those again stays idempotent.)
  if (
    input.sourceFilePath &&
    rowWithSameFingerprint &&
    isCurrentlyVaulted(rowWithSameFingerprint)
  ) {
    normalizedInput = {
      ...input,
      id: undefined,
      fingerprint: `${input.fingerprint}#${randomUUID()}`,
    };
  }

  const previous = normalizedInput === input ? rowWithSameFingerprint : undefined;
  const inputWithVault: VaultItemUpsertInput = {
    ...normalizedInput,
    vaultedAt: normalizedInput.vaultedAt ?? new Date(nowIso),
    stackCount:
      normalizedInput.stackCount ?? resolveStackCountFromRawJson(normalizedInput.rawItemJson),
  };
  const saved = upsertVaultItemByFingerprint(ctx, inputWithVault);

  // Explicitly null out unvaultedAt to support re-vaulting previously-unvaulted items.
  // Drizzle skips `undefined` in .set(), so we must issue an explicit update here.
  ctx.db.update(vaultItems).set({ unvaultedAt: null }).where(eq(vaultItems.id, saved.id)).run();

  const refreshed = getVaultItemById(ctx, saved.id);
  if (!refreshed) {
    throw new Error(`Unable to load vault item after add: ${saved.id}`);
  }

  return { item: refreshed, undo: createUndo(ctx, saved.id, previous) };
}

export function addVaultItem(ctx: DatabaseContext, input: VaultItemUpsertInput): VaultItem {
  return addVaultItemWithUndo(ctx, input).item;
}

export function unvaultVaultItem(
  ctx: DatabaseContext,
  itemId: string,
  withdrawCount?: number,
): void {
  if (withdrawCount !== undefined) {
    if (!Number.isInteger(withdrawCount) || withdrawCount < 1) {
      throw new Error('withdrawCount must be a positive integer');
    }

    const item = getVaultItemById(ctx, itemId);
    if (item && (item.stackCount ?? 1) > withdrawCount) {
      ctx.db
        .update(vaultItems)
        .set({ stackCount: (item.stackCount ?? 1) - withdrawCount })
        .where(eq(vaultItems.id, itemId))
        .run();
      return;
    }
  }

  const nowIso = new Date().toISOString();
  ctx.db.update(vaultItems).set({ unvaultedAt: nowIso }).where(eq(vaultItems.id, itemId)).run();
}

export function updateVaultItem(
  ctx: DatabaseContext,
  itemId: string,
  updates: VaultItemUpdateInput,
): VaultItem | undefined {
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
        stackCount: values.stackCount,
        rawItemJson: values.rawItemJson,
        sourceCharacterId: values.sourceCharacterId,
        sourceCharacterName: values.sourceCharacterName,
        sourceFileType: values.sourceFileType,
        sourceFilePath: values.sourceFilePath,
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

export interface VaultScanReconciliationInput {
  sourceFileType: VaultItem['sourceFileType'];
  /** The exact save file that was scanned. Only rows that came from this file are reconciled. */
  sourceFilePath: string;
  /** Fingerprints of every item found in `sourceFilePath` by the scan. */
  presentFingerprints: string[];
  lastSeenAt?: Date;
}

/**
 * Updates `is_present_in_latest_scan` (and `last_seen_at` when an item reappears) for the vault rows
 * that were taken from one scanned save file.
 *
 * Safety properties:
 * - Only the presence flag and `last_seen_at` are written. Vaulted/unvaulted state, stack counts,
 *   item data and categories are never modified, and no row is ever deleted.
 * - The scope is the specific source file, so a scan of one stash/character can never mark rows
 *   that came from another file as missing. Rows without a source file (bookmarks / tags) are
 *   never touched.
 * - Rows are only written when their presence flag changes, which keeps `updated_at` stable.
 *
 * Limitation: fingerprints include the character name and the item position, so an item that was
 * moved (or a character that was renamed) gets a new fingerprint and its old row reads as missing.
 */
export function reconcileVaultItemsForScan(
  ctx: DatabaseContext,
  scan: VaultScanReconciliationInput,
): void {
  if (typeof scan.sourceFilePath !== 'string' || scan.sourceFilePath.length === 0) {
    return;
  }

  const presentSet = new Set(scan.presentFingerprints);
  const existingRows = ctx.db
    .select()
    .from(vaultItems)
    .where(
      and(
        eq(vaultItems.sourceFileType, scan.sourceFileType),
        eq(vaultItems.sourceFilePath, scan.sourceFilePath),
      ),
    )
    .all();
  const seenAt = toISOString(scan.lastSeenAt) ?? new Date().toISOString();

  const tx = ctx.rawDb.transaction(() => {
    for (const row of existingRows) {
      const isPresent = presentSet.has(row.fingerprint);
      if (Boolean(row.isPresentInLatestScan) === isPresent) {
        continue;
      }

      ctx.db
        .update(vaultItems)
        .set({
          isPresentInLatestScan: isPresent,
          ...(isPresent && { lastSeenAt: seenAt }),
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
        ...(sourceCharacterName !== undefined && { sourceCharacterName }),
      })
      .where(eq(vaultItems.fingerprint, fingerprint))
      .run();
  }
}

export function getVaultItemById(ctx: DatabaseContext, itemId: string): VaultItem | undefined {
  const row = ctx.db.select().from(vaultItems).where(eq(vaultItems.id, itemId)).get();
  if (!row) {
    return undefined;
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
    "(lower(vi.item_name) LIKE ? OR lower(COALESCE(vi.item_code, '')) LIKE ? OR lower(vi.quality) LIKE ?)",
  );
  query.params.push(textQuery, textQuery, textQuery);
}

function appendCharacterClause(query: SearchClauses, characterId: string | undefined): void {
  if (!characterId) {
    return;
  }

  query.clauses.push('(vi.source_character_id = ? OR vi.source_character_name = ?)');
  query.params.push(characterId, characterId);
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

function appendVaultedStateClause(
  query: SearchClauses,
  vaultedState: VaultItemFilter['vaultedState'],
): void {
  if (!vaultedState || vaultedState === 'all') {
    return;
  }

  if (vaultedState === 'vaulted') {
    query.clauses.push(
      '(vi.vaulted_at IS NOT NULL AND (vi.unvaulted_at IS NULL OR vi.unvaulted_at < vi.vaulted_at))',
    );
  } else {
    query.clauses.push(
      '(vi.vaulted_at IS NOT NULL AND vi.unvaulted_at IS NOT NULL AND vi.unvaulted_at >= vi.vaulted_at)',
    );
  }
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
  appendVaultedStateClause(query, filter.vaultedState);
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
    vaultedAt: 'vi.vaulted_at',
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
    .all(...query.params, pageSize, offset) as RawVaultSearchRow[];

  const mappedItems = rows.map(mapRawVaultSearchRowToVaultItem);

  return {
    items: attachCategoryIds(ctx, mappedItems),
    total: countRow.total,
    page,
    pageSize,
  };
}
