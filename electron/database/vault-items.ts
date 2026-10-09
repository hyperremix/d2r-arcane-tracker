import { randomUUID } from 'node:crypto';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  notLike,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';
import type {
  VaultItem,
  VaultItemFilter,
  VaultItemSearchResult,
  VaultItemUpsertInput,
} from '../types/grail';
import { isResourceStackFromRawJson, resolveStackCountFromRawJson } from '../utils/stackableItems';
import { createVaultPresenceKey, readItemUidFromRawJson } from '../utils/vaultPresence';
import {
  GRAIL_BOOKMARK_FINGERPRINT_PREFIX,
  isCurrentlyVaulted,
  isGrailBookmark,
} from '../utils/vaultState';
import { dbVaultItemToVaultItem, toISOString } from './converters';
import { type DbVaultItem, schema } from './drizzle';
import type { DatabaseContext } from './types';

const { vaultItems } = schema;

function toNullable<T>(value: T | undefined): T | null {
  return value ?? null;
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

/**
 * Rows that are currently vaulted (vaulted and not unvaulted since). SQL counterpart of
 * `isCurrentlyVaulted` in electron/utils/vaultState.ts; keep the two in sync.
 */
const isVaultedCondition = and(
  isNotNull(vaultItems.vaultedAt),
  or(isNull(vaultItems.unvaultedAt), lt(vaultItems.unvaultedAt, vaultItems.vaultedAt)),
);

/**
 * Rows that were vaulted and have been unvaulted since: the negation of `isVaultedCondition` among
 * rows that have a vaulted timestamp. Counterpart of `isCurrentlyVaulted` in
 * electron/utils/vaultState.ts.
 */
const isUnvaultedCondition = and(
  isNotNull(vaultItems.vaultedAt),
  isNotNull(vaultItems.unvaultedAt),
  gte(vaultItems.unvaultedAt, vaultItems.vaultedAt),
);

function findExistingStackableVaultItem(
  ctx: DatabaseContext,
  itemCode: string,
): VaultItem | undefined {
  const row = ctx.db
    .select()
    .from(vaultItems)
    .where(
      and(
        eq(vaultItems.itemCode, itemCode),
        notLike(vaultItems.fingerprint, `${GRAIL_BOOKMARK_FINGERPRINT_PREFIX}%`),
        isVaultedCondition,
      ),
    )
    .limit(1)
    .get();

  return row ? dbVaultItemToVaultItem(row) : undefined;
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
 * Restores every persisted column of a vault row to a previously read state.
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
  // a duplicate row. Grail bookmarks hold no item, so they must never merge into (or count towards)
  // a real stack.
  if (
    input.itemCode &&
    !isGrailBookmark(input) &&
    isResourceStackFromRawJson(input.rawItemJson, input.itemCode)
  ) {
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

export function removeVaultItem(ctx: DatabaseContext, itemId: string): void {
  ctx.db.delete(vaultItems).where(eq(vaultItems.id, itemId)).run();
}

export function upsertVaultItemByFingerprint(
  ctx: DatabaseContext,
  input: VaultItemUpsertInput,
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

  const saved = getVaultItemById(ctx, persisted.id);
  if (!saved) {
    throw new Error(`Unable to load upserted vault item: ${persisted.id}`);
  }

  return saved;
}

export interface VaultScanReconciliationInput {
  sourceFileType: VaultItem['sourceFileType'];
  /** The exact save file that was scanned. Only rows that came from this file are reconciled. */
  sourceFilePath: string;
  /** Fingerprints of every item found in `sourceFilePath` by the scan. */
  presentFingerprints: string[];
  /**
   * Location-independent identity key (see `createVaultPresenceKey`) of each scanned item, parallel
   * to `presentFingerprints` (index i describes `presentFingerprints[i]`). Rows whose fingerprint is
   * gone (the item moved) are matched against it. Ignored if the lengths differ.
   */
  presentIdentityKeys: string[];
  lastSeenAt?: Date;
}

function toIdentityPool(scan: VaultScanReconciliationInput): {
  /** Number of scanned items per identity key that no row has claimed yet. */
  unclaimed: Map<string, number>;
  keyByFingerprint: Map<string, string>;
} {
  const unclaimed = new Map<string, number>();
  const keyByFingerprint = new Map<string, string>();
  const keys = scan.presentIdentityKeys;
  if (keys.length !== scan.presentFingerprints.length) {
    return { unclaimed, keyByFingerprint };
  }

  keys.forEach((key, index) => {
    unclaimed.set(key, (unclaimed.get(key) ?? 0) + 1);
    if (!keyByFingerprint.has(scan.presentFingerprints[index])) {
      keyByFingerprint.set(scan.presentFingerprints[index], key);
    }
  });

  return { unclaimed, keyByFingerprint };
}

function claimIdentity(unclaimed: Map<string, number>, key: string | undefined): boolean {
  const remaining = key === undefined ? 0 : (unclaimed.get(key) ?? 0);
  if (key === undefined || remaining <= 0) {
    return false;
  }

  unclaimed.set(key, remaining - 1);
  return true;
}

function createRowPresenceKey(row: DbVaultItem): string {
  return createVaultPresenceKey({
    sourceFileType: row.sourceFileType,
    itemCode: row.itemCode,
    quality: row.quality,
    ethereal: Boolean(row.ethereal),
    socketCount: row.socketCount,
    itemName: row.itemName,
    isSocketedItem: Boolean(row.isSocketedItem),
    itemUid: readItemUidFromRawJson(row.rawItemJson),
  });
}

/**
 * Decides which rows of one file are present in a scan. A row is present when
 * 1. its fingerprint is in the scan (exact match, always tried first for every row), or
 * 2. it is not vaulted and an item with the same identity key is left in the scan that no other
 *    row has claimed. This covers an item that moved inside its save (its position, and therefore
 *    its fingerprint, changed). Each scanned item can satisfy only one row, so one of two identical
 *    items disappearing still marks one row missing.
 * Vaulted rows only ever match exactly: their item was taken out of the file, so an identical item
 * that happens to remain there is not them.
 */
function resolveRowPresence(
  rows: DbVaultItem[],
  scan: VaultScanReconciliationInput,
): Map<string, boolean> {
  const presentSet = new Set(scan.presentFingerprints);
  const { unclaimed, keyByFingerprint } = toIdentityPool(scan);
  const presence = new Map<string, boolean>();

  for (const row of rows) {
    if (presentSet.has(row.fingerprint)) {
      presence.set(row.id, true);
      claimIdentity(unclaimed, keyByFingerprint.get(row.fingerprint));
    }
  }

  const candidates = rows
    .filter((row) => !presence.has(row.id))
    .sort(
      (left, right) =>
        (left.createdAt ?? '').localeCompare(right.createdAt ?? '') ||
        left.id.localeCompare(right.id),
    );
  for (const row of candidates) {
    const isMovedItem =
      !isCurrentlyVaulted({
        vaultedAt: row.vaultedAt ?? undefined,
        unvaultedAt: row.unvaultedAt ?? undefined,
      }) && claimIdentity(unclaimed, createRowPresenceKey(row));
    presence.set(row.id, isMovedItem);
  }

  return presence;
}

/**
 * Updates `is_present_in_latest_scan` (and `last_seen_at` when an item reappears) for the vault rows
 * that were taken from one scanned save file.
 *
 * Safety properties:
 * - Only the presence flag and `last_seen_at` are written. Vaulted/unvaulted state, stack counts
 *   and item data are never modified, and no row is ever deleted.
 * - The scope is the specific source file, so a scan of one stash/character can never mark rows
 *   that came from another file as missing. Rows without a source file (bookmarks / tags) are
 *   never touched.
 * - Rows are only written when their presence flag changes, which keeps `updated_at` stable.
 *
 * Matching: fingerprints include the character name and the item position, so an item that moved
 * gets a new fingerprint. Existing rows keep the fingerprint they were stored with, so a row that
 * no longer matches exactly is matched by item identity instead (see `resolveRowPresence`). A
 * renamed character is a different file and is not covered. Rows vaulted out of their file (and
 * their `#uuid` collision rows) match by exact fingerprint only, so they read as missing by design.
 */
export function reconcileVaultItemsForScan(
  ctx: DatabaseContext,
  scan: VaultScanReconciliationInput,
): void {
  if (typeof scan.sourceFilePath !== 'string' || scan.sourceFilePath.length === 0) {
    return;
  }

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
  const presence = resolveRowPresence(existingRows, scan);
  const seenAt = toISOString(scan.lastSeenAt) ?? new Date().toISOString();

  const tx = ctx.rawDb.transaction(() => {
    for (const row of existingRows) {
      const isPresent = presence.get(row.id) === true;
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

/** Source file paths of the vault rows that are still flagged present in the latest scan. */
export function getVaultSourceFilePathsPresentInLatestScan(ctx: DatabaseContext): string[] {
  const rows = ctx.rawDb
    .prepare(
      `
        SELECT DISTINCT source_file_path
        FROM vault_items
        WHERE is_present_in_latest_scan = 1
          AND source_file_path IS NOT NULL
          AND source_file_path <> ''
      `,
    )
    .all() as Array<{ source_file_path: string }>;

  return rows.map((row) => row.source_file_path);
}

const MAX_SQL_PARAMETERS_PER_STATEMENT = 500;

/**
 * Clears the presence flag of every vault row that came from one of the given source files. For
 * files that no longer exist, so their rows cannot stay "present in the latest scan" forever.
 *
 * Only `is_present_in_latest_scan` is written (and only on rows that were flagged present). Vault
 * state, item data and `last_seen_at` are untouched and no row is deleted, so a file that comes
 * back is reconciled by the next scan. The caller decides which files are truly gone.
 */
export function markVaultItemsMissingForSourceFiles(
  ctx: DatabaseContext,
  sourceFilePaths: string[],
): void {
  const uniquePaths = [...new Set(sourceFilePaths.filter((path) => path.length > 0))];
  if (uniquePaths.length === 0) {
    return;
  }

  const tx = ctx.rawDb.transaction(() => {
    for (let start = 0; start < uniquePaths.length; start += MAX_SQL_PARAMETERS_PER_STATEMENT) {
      const chunk = uniquePaths.slice(start, start + MAX_SQL_PARAMETERS_PER_STATEMENT);
      ctx.db
        .update(vaultItems)
        .set({ isPresentInLatestScan: false })
        .where(
          and(
            eq(vaultItems.isPresentInLatestScan, true),
            inArray(vaultItems.sourceFilePath, chunk),
          ),
        )
        .run();
    }
  });

  tx();
}

export function getVaultItemById(ctx: DatabaseContext, itemId: string): VaultItem | undefined {
  const row = ctx.db.select().from(vaultItems).where(eq(vaultItems.id, itemId)).get();
  if (!row) {
    return undefined;
  }

  return dbVaultItemToVaultItem(row);
}

function textCondition(text: string | undefined): SQL | undefined {
  const normalized = text?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  // The text is deliberately not escaped: `%` and `_` in a search act as LIKE wildcards, as they
  // did before the move to drizzle (pinned in vault-items.test.ts).
  const textQuery = `%${normalized}%`;
  return or(
    like(sql`lower(${vaultItems.itemName})`, textQuery),
    like(sql`lower(COALESCE(${vaultItems.itemCode}, ''))`, textQuery),
    like(sql`lower(${vaultItems.quality})`, textQuery),
  );
}

function characterCondition(characterId: string | undefined): SQL | undefined {
  if (!characterId) {
    return undefined;
  }

  return or(
    eq(vaultItems.sourceCharacterId, characterId),
    eq(vaultItems.sourceCharacterName, characterId),
  );
}

function presentStateCondition(presentState: VaultItemFilter['presentState']): SQL | undefined {
  if (!presentState || presentState === 'all') {
    return undefined;
  }

  return eq(vaultItems.isPresentInLatestScan, presentState === 'present');
}

function vaultedStateCondition(vaultedState: VaultItemFilter['vaultedState']): SQL | undefined {
  if (!vaultedState || vaultedState === 'all') {
    return undefined;
  }

  return vaultedState === 'vaulted' ? isVaultedCondition : isUnvaultedCondition;
}

function socketedCondition(includeSocketed: VaultItemFilter['includeSocketed']): SQL | undefined {
  if (includeSocketed === true) {
    return undefined;
  }

  return sql`COALESCE(${vaultItems.isSocketedItem}, 0) = 0`;
}

function buildSearchCondition(filter: VaultItemFilter): SQL | undefined {
  return and(
    textCondition(filter.text),
    characterCondition(filter.characterId),
    filter.locationContext ? eq(vaultItems.locationContext, filter.locationContext) : undefined,
    filter.sourceFileType ? eq(vaultItems.sourceFileType, filter.sourceFileType) : undefined,
    presentStateCondition(filter.presentState),
    vaultedStateCondition(filter.vaultedState),
    socketedCondition(filter.includeSocketed),
  );
}

const sortColumns = {
  itemName: vaultItems.itemName,
  lastSeenAt: vaultItems.lastSeenAt,
  createdAt: vaultItems.createdAt,
  updatedAt: vaultItems.updatedAt,
  vaultedAt: vaultItems.vaultedAt,
} satisfies Record<NonNullable<VaultItemFilter['sortBy']>, unknown>;

export function searchVaultItems(
  ctx: DatabaseContext,
  filter: VaultItemFilter,
): VaultItemSearchResult {
  const where = buildSearchCondition(filter);
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 50;
  const offset = (page - 1) * pageSize;
  const sortColumn = sortColumns[filter.sortBy ?? 'updatedAt'] ?? sortColumns.updatedAt;
  const orderBy = filter.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

  const total = ctx.db.select({ total: count() }).from(vaultItems).where(where).get()?.total ?? 0;
  const rows = ctx.db
    .select()
    .from(vaultItems)
    .where(where)
    .orderBy(orderBy)
    .limit(pageSize)
    .offset(offset)
    .all();

  return {
    items: rows.map(dbVaultItemToVaultItem),
    total,
    page,
    pageSize,
  };
}
