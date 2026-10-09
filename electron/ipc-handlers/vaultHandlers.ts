import type { types as d2sTypes } from '@dschu012/d2s';
import { ipcMain } from 'electron';
import { grailDatabase } from '../database/database';
import { assertGameNotRunning } from '../services/gameProcessGuard';
import {
  addItemToSaveFile,
  moveItemBetweenSaveFiles,
  readSaveFileItem,
  removeItemFromSaveFile,
  type SaveFileItemLocator,
  splitStackInSaveFile,
} from '../services/saveFileEditor';
import type { SaveFileMonitor } from '../services/saveFileMonitor';
import type {
  CharacterInventorySnapshot,
  InventoryItemMoveInput,
  InventorySearchResult,
  InventoryStackSplitInput,
  VaultItem,
  VaultItemFilter,
  VaultItemSearchResult,
  VaultItemUpsertInput,
  VaultLocationContext,
  VaultSourceFileType,
} from '../types/grail';
import { assert } from '../utils/assert';
import { assertSaveFilePathAllowed } from '../utils/saveFilePathGuard';
import { isResourceStackFromRawJson, resolveStackCountFromRawJson } from '../utils/stackableItems';
import { isCurrentlyVaulted, isGrailBookmark, VALID_SOURCE_FILE_TYPES } from '../utils/vaultState';

const MAX_SEARCH_TEXT_LENGTH = 120;
const MAX_PAGE = 10000;
const MAX_PAGE_SIZE = 200;
const MIN_PAGE = 1;
const MIN_PAGE_SIZE = 1;

const VALID_PRESENT_STATES = new Set(['all', 'present', 'missing']);
const VALID_VAULTED_STATES = new Set(['all', 'vaulted', 'unvaulted']);
const VALID_SORT_BY = new Set(['itemName', 'lastSeenAt', 'createdAt', 'updatedAt', 'vaultedAt']);
const VALID_SORT_ORDER = new Set(['asc', 'desc']);
const VALID_LOCATION_CONTEXTS = new Set([
  'equipped',
  'inventory',
  'stash',
  'mercenary',
  'corpse',
  'unknown',
]);
const VALID_MOVE_TARGET_CONTEXTS = new Set([
  'equipped',
  'inventory',
  'stash',
  'mercenary',
  'corpse',
]);
const VALID_EQUIPPED_SLOT_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

interface NormalizedInventoryMoveInput {
  sourceFilePath: string;
  sourceFileType: VaultSourceFileType;
  sourceItemId: number | undefined;
  sourceStashTab?: number;
  sourceGridXFromItem?: number;
  sourceGridYFromItem?: number;
  sourceItemCode?: string;
  targetFilePath: string;
  targetFileType: VaultSourceFileType;
  targetLocationContext: VaultLocationContext;
  targetStashTab?: number;
  targetGridX?: number;
  targetGridY?: number;
  targetEquippedSlotId?: number;
}

interface NormalizedSplitStackTarget {
  targetFilePath: string;
  targetFileType: VaultSourceFileType;
  targetLocationContext: VaultLocationContext;
  targetStashTab?: number;
  targetGridX: number;
  targetGridY: number;
}

interface NormalizedSplitStackInput {
  sourceFilePath: string;
  sourceFileType: VaultSourceFileType;
  sourceStashTab: number;
  sourceItemCode: string;
  sourceRawItemJson?: string;
  splitCount: number;
  targets: NormalizedSplitStackTarget[];
}

function sanitizeFilter(filter?: VaultItemFilter): VaultItemFilter {
  const safeFilter = filter ?? {};

  if (safeFilter.text !== undefined) {
    assert(typeof safeFilter.text === 'string', 'Search text must be a string');
    assert(
      safeFilter.text.length <= MAX_SEARCH_TEXT_LENGTH,
      `Search text must be <= ${MAX_SEARCH_TEXT_LENGTH} characters`,
    );
  }

  if (safeFilter.page !== undefined) {
    assert(Number.isInteger(safeFilter.page), 'Page must be an integer');
    assert(safeFilter.page >= MIN_PAGE, `Page must be >= ${MIN_PAGE}`);
    assert(safeFilter.page <= MAX_PAGE, `Page must be <= ${MAX_PAGE}`);
  }

  if (safeFilter.pageSize !== undefined) {
    assert(Number.isInteger(safeFilter.pageSize), 'Page size must be an integer');
    assert(
      safeFilter.pageSize >= MIN_PAGE_SIZE && safeFilter.pageSize <= MAX_PAGE_SIZE,
      `Page size must be between ${MIN_PAGE_SIZE} and ${MAX_PAGE_SIZE}`,
    );
  }

  if (safeFilter.presentState !== undefined) {
    assert(
      VALID_PRESENT_STATES.has(safeFilter.presentState),
      'presentState must be one of: all, present, missing',
    );
  }

  if (safeFilter.vaultedState !== undefined) {
    assert(
      VALID_VAULTED_STATES.has(safeFilter.vaultedState),
      'vaultedState must be one of: all, vaulted, unvaulted',
    );
  }

  if (safeFilter.sortBy !== undefined) {
    assert(
      VALID_SORT_BY.has(safeFilter.sortBy),
      'sortBy must be one of: itemName, lastSeenAt, createdAt, updatedAt, vaultedAt',
    );
  }

  if (safeFilter.sortOrder !== undefined) {
    assert(VALID_SORT_ORDER.has(safeFilter.sortOrder), 'sortOrder must be asc or desc');
  }

  if (safeFilter.sourceFileType !== undefined) {
    assert(
      VALID_SOURCE_FILE_TYPES.has(safeFilter.sourceFileType),
      'sourceFileType must be one of: d2s, sss, d2x, d2i',
    );
  }

  if (safeFilter.locationContext !== undefined) {
    assert(
      VALID_LOCATION_CONTEXTS.has(safeFilter.locationContext),
      'locationContext must be one of: equipped, inventory, stash, mercenary, corpse, unknown',
    );
  }

  if (safeFilter.includeSocketed !== undefined) {
    assert(typeof safeFilter.includeSocketed === 'boolean', 'includeSocketed must be a boolean');
  }

  if (safeFilter.characterId !== undefined) {
    assert(
      typeof safeFilter.characterId === 'string' && safeFilter.characterId.length > 0,
      'characterId must be a non-empty string',
    );
  }

  return safeFilter;
}

function validateVaultItemInput(input: VaultItemUpsertInput): void {
  assert(
    typeof input.fingerprint === 'string' && input.fingerprint.length > 0,
    'Missing fingerprint',
  );
  assert(typeof input.itemName === 'string' && input.itemName.length > 0, 'Missing itemName');
  assert(
    typeof input.rawItemJson === 'string' && input.rawItemJson.length > 0,
    'Missing rawItemJson',
  );
  assert(VALID_SOURCE_FILE_TYPES.has(input.sourceFileType), 'Invalid sourceFileType');
  assert(VALID_LOCATION_CONTEXTS.has(input.locationContext), 'Invalid locationContext');
  assert(typeof input.quality === 'string' && input.quality.length > 0, 'Missing quality');
}

function normalizeOptionalDate(
  value: Date | string | undefined,
  fieldName: 'lastSeenAt' | 'vaultedAt' | 'unvaultedAt',
): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value instanceof Date) {
    assert(!Number.isNaN(value.getTime()), `${fieldName} must be a valid date`);
    return value;
  }

  const parsed = new Date(value);
  assert(!Number.isNaN(parsed.getTime()), `${fieldName} must be a valid date`);
  return parsed;
}

function normalizeVaultItemInput(input: VaultItemUpsertInput): VaultItemUpsertInput {
  const unsafeInput = input as VaultItemUpsertInput & {
    lastSeenAt?: Date | string;
    vaultedAt?: Date | string;
    unvaultedAt?: Date | string;
  };

  return {
    ...input,
    lastSeenAt: normalizeOptionalDate(unsafeInput.lastSeenAt, 'lastSeenAt'),
    vaultedAt: normalizeOptionalDate(unsafeInput.vaultedAt, 'vaultedAt'),
    unvaultedAt: normalizeOptionalDate(unsafeInput.unvaultedAt, 'unvaultedAt'),
  };
}

function toItemId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : undefined;
  }

  return undefined;
}

function toNonNegativeInteger(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
  }

  return undefined;
}

interface ParsedSourceItem {
  itemId: number | undefined;
  itemCode: string | undefined;
  gridX: number | undefined;
  gridY: number | undefined;
  stashTab: number | undefined;
}

function parseSourceItem(rawItemJson: string): ParsedSourceItem {
  let parsedRawItem: {
    id?: unknown;
    code?: unknown;
    type?: unknown;
    position_x?: unknown;
    position_y?: unknown;
    alt_position_id?: unknown;
  };
  try {
    parsedRawItem = JSON.parse(rawItemJson) as {
      id?: unknown;
      code?: unknown;
      type?: unknown;
      position_x?: unknown;
      position_y?: unknown;
      alt_position_id?: unknown;
    };
  } catch {
    throw new Error('rawItemJson must be valid JSON');
  }

  const itemId = toItemId(parsedRawItem.id);
  const gridX = toNonNegativeInteger(parsedRawItem.position_x);
  const gridY = toNonNegativeInteger(parsedRawItem.position_y);
  const stashTab = toNonNegativeInteger(parsedRawItem.alt_position_id);

  const itemCode = normalizeCode(parsedRawItem.code ?? parsedRawItem.type);

  return { itemId, itemCode, gridX, gridY, stashTab };
}

function resolveVaultSourceItemLocator(input: VaultItemUpsertInput): SaveFileItemLocator {
  const parsedSourceItem = parseSourceItem(input.rawItemJson);
  const stashTab = toNonNegativeInteger(input.stashTab) ?? parsedSourceItem.stashTab;
  const gridX = toNonNegativeInteger(input.gridX) ?? parsedSourceItem.gridX;
  const gridY = toNonNegativeInteger(input.gridY) ?? parsedSourceItem.gridY;
  const locator: SaveFileItemLocator = {
    itemId: parsedSourceItem.itemId,
    itemCode: normalizeCode(input.itemCode) ?? parsedSourceItem.itemCode,
    stashTab,
    gridX,
    gridY,
  };
  const hasGridCoordinates = locator.gridX !== undefined && locator.gridY !== undefined;

  if (input.sourceFileType === 'd2i') {
    assert(
      locator.itemId !== undefined || hasGridCoordinates,
      'rawItemJson must include a numeric item id or grid coordinates for d2i source items',
    );
  } else {
    assert(locator.itemId !== undefined, 'rawItemJson must include a numeric item id');
  }

  return locator;
}

function normalizeCode(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : undefined;
}

/**
 * The scan snapshot the UI works from can be stale (the game may have moved or changed the item
 * since). Verify the item really is in the save file, and still the same, before it is vaulted and
 * removed from there: otherwise the vault would store one thing while another is deleted.
 */
async function assertSourceItemMatchesVaultInput(
  item: VaultItemUpsertInput,
  sourceFilePath: string,
  sourceLocator: SaveFileItemLocator,
): Promise<void> {
  const actualItem = await readSaveFileItem(sourceFilePath, item.sourceFileType, sourceLocator);
  assert(
    actualItem !== undefined,
    'The item is no longer in the save file. Refresh the inventory and try again.',
  );

  const actualCode = normalizeCode((actualItem as { code?: unknown }).code ?? actualItem?.type);
  const expectedCode = normalizeCode(item.itemCode);
  assert(
    expectedCode === undefined || actualCode === undefined || expectedCode === actualCode,
    'The item in the save file changed. Refresh the inventory and try again.',
  );

  if (isResourceStackFromRawJson(item.rawItemJson, item.itemCode)) {
    const expectedCount = item.stackCount ?? resolveStackCountFromRawJson(item.rawItemJson);
    const actualCount = resolveStackCountFromRawJson(JSON.stringify(actualItem));
    assert(
      expectedCount === actualCount,
      'The stack size in the save file changed. Refresh the inventory and try again.',
    );
  }
}

async function removeSourceItemAfterVaultAdd(
  undoVaultAdd: () => void,
  sourceFilePath: string,
  sourceFileType: VaultSourceFileType,
  sourceLocator: SaveFileItemLocator,
): Promise<void> {
  try {
    await removeItemFromSaveFile(sourceFilePath, sourceFileType, sourceLocator);
  } catch (error) {
    try {
      undoVaultAdd();
    } catch (rollbackError) {
      console.error('Failed to revert vault state after source removal error', rollbackError);
    }

    const failureReason = error instanceof Error ? error.message : String(error);
    throw new Error(`Vault add persisted but source item removal failed: ${failureReason}`);
  }
}

/**
 * The directory the save file monitor watches. Renderer-supplied file paths must resolve to a save
 * file inside it before they can be read or written.
 */
function resolveSaveDirectory(
  getSaveFileMonitor: () => SaveFileMonitor | undefined,
): string | undefined {
  const monitorDirectory = getSaveFileMonitor()?.getSaveDirectory();
  if (monitorDirectory) {
    return monitorDirectory;
  }

  try {
    return grailDatabase.getAllSettings().saveDir || undefined;
  } catch (error) {
    console.error('Failed to read the configured save directory', error);
    return undefined;
  }
}

async function addVaultItemWithSafeSourceRemoval(
  item: VaultItemUpsertInput,
  saveDirectory: string | undefined,
): Promise<VaultItem> {
  const sourceFilePath = item.sourceFilePath?.trim();
  if (sourceFilePath) {
    assertSaveFilePathAllowed(sourceFilePath, saveDirectory, 'sourceFilePath');
  }
  const sourceLocator = sourceFilePath ? resolveVaultSourceItemLocator(item) : undefined;

  if (sourceFilePath && sourceLocator) {
    await assertGameNotRunning();
    await assertSourceItemMatchesVaultInput(item, sourceFilePath, sourceLocator);
  }

  // The vault copy is written first: if anything fails afterwards the item exists twice, never zero times.
  const { item: savedVaultItem, undo } = grailDatabase.addVaultItemWithUndo(item);

  if (sourceFilePath && sourceLocator) {
    await removeSourceItemAfterVaultAdd(undo, sourceFilePath, item.sourceFileType, sourceLocator);
  }

  return savedVaultItem;
}

function normalizeSplitStackTarget(
  target: InventoryStackSplitInput['targets'][number],
): NormalizedSplitStackTarget {
  const targetFilePath = (target.targetFilePath ?? '').trim();
  const isStashTarget = target.targetLocationContext === 'stash';

  assert(targetFilePath.length > 0, 'Each target must have a valid targetFilePath');
  assert(
    VALID_SOURCE_FILE_TYPES.has(target.targetFileType),
    'Each target targetFileType must be one of: d2s, sss, d2x, d2i',
  );
  assert(
    VALID_MOVE_TARGET_CONTEXTS.has(target.targetLocationContext) &&
      target.targetLocationContext !== 'equipped',
    'Each target targetLocationContext must be valid',
  );
  if (target.targetFileType !== 'd2s') {
    assert(isStashTarget, 'Shared stash targets must use targetLocationContext=stash');
  }

  if (target.targetStashTab !== undefined) {
    assert(
      isStashTarget,
      'Each target targetStashTab is only allowed when targetLocationContext=stash',
    );
    assert(
      Number.isInteger(target.targetStashTab) && target.targetStashTab >= 0,
      'Each target targetStashTab must be a non-negative integer',
    );
  }

  assert(Number.isInteger(target.targetGridX), 'Each target must have integer targetGridX');
  assert(Number.isInteger(target.targetGridY), 'Each target must have integer targetGridY');
  assert(target.targetGridX >= 0, 'Each target targetGridX must be >= 0');
  assert(target.targetGridY >= 0, 'Each target targetGridY must be >= 0');

  return {
    targetFilePath,
    targetFileType: target.targetFileType,
    targetLocationContext: target.targetLocationContext,
    targetStashTab: target.targetStashTab,
    targetGridX: target.targetGridX,
    targetGridY: target.targetGridY,
  };
}

function normalizeSplitStackInput(input: InventoryStackSplitInput): NormalizedSplitStackInput {
  assert(input && typeof input === 'object', 'Split input is required');

  const sourceFilePath = (input.sourceFilePath ?? '').trim();
  const sourceItemCode = (input.sourceItemCode ?? '').trim();

  assert(sourceFilePath.length > 0, 'sourceFilePath is required');
  assert(
    VALID_SOURCE_FILE_TYPES.has(input.sourceFileType),
    'sourceFileType must be one of: d2s, sss, d2x, d2i',
  );
  assert(sourceItemCode.length > 0, 'sourceItemCode is required');
  assert(
    Number.isInteger(input.sourceStashTab) && input.sourceStashTab >= 0,
    'sourceStashTab must be a non-negative integer',
  );
  assert(
    Number.isInteger(input.splitCount) && input.splitCount > 0,
    'splitCount must be a positive integer',
  );
  assert(Array.isArray(input.targets) && input.targets.length > 0, 'targets must be non-empty');

  const sourceRawItemJson =
    typeof input.sourceRawItemJson === 'string' && input.sourceRawItemJson.trim()
      ? input.sourceRawItemJson.trim()
      : undefined;

  return {
    sourceFilePath,
    sourceFileType: input.sourceFileType,
    sourceStashTab: input.sourceStashTab,
    sourceItemCode,
    sourceRawItemJson,
    splitCount: input.splitCount,
    targets: input.targets.map((target) => normalizeSplitStackTarget(target)),
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Move-input validation enforces IPC safety for multiple target modes.
function normalizeInventoryMoveInput(input: InventoryItemMoveInput): NormalizedInventoryMoveInput {
  assert(input && typeof input === 'object', 'Move input is required');

  const sourceFilePath = input.sourceFilePath?.trim();
  const targetFilePath = input.targetFilePath?.trim();

  assert(
    typeof sourceFilePath === 'string' && sourceFilePath.length > 0,
    'sourceFilePath is required',
  );
  assert(
    typeof targetFilePath === 'string' && targetFilePath.length > 0,
    'targetFilePath is required',
  );
  assert(
    typeof input.rawItemJson === 'string' && input.rawItemJson.trim().length > 0,
    'rawItemJson is required',
  );
  assert(
    VALID_SOURCE_FILE_TYPES.has(input.sourceFileType),
    'sourceFileType must be one of: d2s, sss, d2x, d2i',
  );
  assert(
    VALID_SOURCE_FILE_TYPES.has(input.targetFileType),
    'targetFileType must be one of: d2s, sss, d2x, d2i',
  );
  assert(
    VALID_MOVE_TARGET_CONTEXTS.has(input.targetLocationContext),
    'targetLocationContext must be one of: equipped, inventory, stash, mercenary, corpse',
  );

  const {
    itemId: sourceItemId,
    itemCode: sourceItemCode,
    gridX: sourceGridXFromItem,
    gridY: sourceGridYFromItem,
  } = parseSourceItem(input.rawItemJson);

  // For non-d2i sources, a numeric item id is always required (non-simple items only).
  // For d2i sources, simple items (runes/gems) have no id — position is used instead.
  if (input.sourceFileType !== 'd2i' && sourceItemId === undefined) {
    throw new Error('rawItemJson must include a numeric item id');
  }
  assert(
    input.sourceFileType !== 'd2i' ||
      sourceItemId !== undefined ||
      (sourceGridXFromItem !== undefined && sourceGridYFromItem !== undefined),
    'rawItemJson must include a numeric item id or grid coordinates for d2i source items',
  );

  const targetLocationContext = input.targetLocationContext as VaultLocationContext;
  const isStashTarget = targetLocationContext === 'stash';
  const isEquippedTarget = targetLocationContext === 'equipped';

  if (input.targetFileType !== 'd2s') {
    assert(
      targetLocationContext === 'stash',
      'Shared stash targets must use targetLocationContext=stash',
    );
  }

  if (isEquippedTarget) {
    assert(input.targetFileType === 'd2s', 'Equipped target requires targetFileType=d2s');
    assert(
      Number.isInteger(input.targetEquippedSlotId) &&
        VALID_EQUIPPED_SLOT_IDS.has(input.targetEquippedSlotId as number),
      'targetEquippedSlotId must be one of: 1-12',
    );
  } else {
    assert(
      input.targetEquippedSlotId === undefined,
      'targetEquippedSlotId is only allowed when targetLocationContext=equipped',
    );
  }

  if (isStashTarget) {
    if (input.targetStashTab !== undefined) {
      assert(
        Number.isInteger(input.targetStashTab) && input.targetStashTab >= 0,
        'targetStashTab must be a non-negative integer',
      );
    }
  } else {
    assert(
      input.targetStashTab === undefined,
      'targetStashTab is only allowed when targetLocationContext=stash',
    );
  }

  if (targetLocationContext !== 'equipped') {
    assert(Number.isInteger(input.targetGridX), 'targetGridX must be an integer');
    assert(Number.isInteger(input.targetGridY), 'targetGridY must be an integer');
    assert((input.targetGridX as number) >= 0, 'targetGridX must be >= 0');
    assert((input.targetGridY as number) >= 0, 'targetGridY must be >= 0');
  }

  const sourceStashTab =
    typeof input.sourceStashTab === 'number' && input.sourceStashTab >= 0
      ? input.sourceStashTab
      : undefined;

  return {
    sourceFilePath,
    sourceFileType: input.sourceFileType,
    sourceItemId,
    sourceStashTab,
    sourceGridXFromItem,
    sourceGridYFromItem,
    sourceItemCode,
    targetFilePath,
    targetFileType: input.targetFileType,
    targetLocationContext,
    targetStashTab: isStashTarget ? (input.targetStashTab ?? 0) : undefined,
    targetGridX: targetLocationContext === 'equipped' ? undefined : input.targetGridX,
    targetGridY: targetLocationContext === 'equipped' ? undefined : input.targetGridY,
    targetEquippedSlotId: isEquippedTarget ? input.targetEquippedSlotId : undefined,
  };
}

function itemMatchesFilter(
  item: CharacterInventorySnapshot['items'][number],
  filter: VaultItemFilter,
): boolean {
  if (filter.includeSocketed !== true && item.isSocketedItem) {
    return false;
  }

  const text = filter.text?.trim().toLowerCase();

  if (text) {
    const matchesText =
      item.itemName.toLowerCase().includes(text) ||
      item.itemCode?.toLowerCase().includes(text) ||
      item.quality.toLowerCase().includes(text);

    if (!matchesText) {
      return false;
    }
  }

  if (
    filter.characterId &&
    item.characterId !== filter.characterId &&
    item.characterName !== filter.characterId
  ) {
    return false;
  }

  if (filter.locationContext && item.locationContext !== filter.locationContext) {
    return false;
  }

  if (filter.sourceFileType && item.sourceFileType !== filter.sourceFileType) {
    return false;
  }

  return true;
}

function buildInventorySearchResult(
  snapshots: CharacterInventorySnapshot[],
  filter: VaultItemFilter,
): InventorySearchResult {
  const filteredSnapshots = snapshots
    .map((snapshot) => ({
      ...snapshot,
      items: snapshot.items.filter((item) => itemMatchesFilter(item, filter)),
    }))
    .filter((snapshot) => snapshot.items.length > 0);

  return {
    snapshots: filteredSnapshots,
    totalSnapshots: filteredSnapshots.length,
    totalItems: filteredSnapshots.reduce((sum, snapshot) => sum + snapshot.items.length, 0),
  };
}

interface UnvaultTargetOptions {
  targetFilePath: string;
  targetFileType: VaultSourceFileType;
  targetLocationContext: VaultLocationContext;
  targetStashTab?: number;
  targetGridX: number;
  targetGridY: number;
  targetEquippedSlotId?: number;
}

function resolveWithdrawCount(withdrawCount: unknown): number | undefined {
  if (withdrawCount === undefined) {
    return undefined;
  }
  assert(
    typeof withdrawCount === 'number' && Number.isInteger(withdrawCount) && withdrawCount > 0,
    'withdrawCount must be a positive integer',
  );
  return withdrawCount as number;
}

async function writeVaultItemToSaveFile(
  rawItemJson: string,
  target: UnvaultTargetOptions,
  stashTab: number | undefined,
  quantity: number | undefined,
): Promise<void> {
  let parsedItem: d2sTypes.IItem;
  try {
    parsedItem = JSON.parse(rawItemJson) as d2sTypes.IItem;
  } catch {
    throw new Error('Stored rawItemJson is not valid JSON');
  }
  await addItemToSaveFile({
    filePath: target.targetFilePath.trim(),
    fileType: target.targetFileType,
    item: parsedItem,
    locationContext: target.targetLocationContext,
    stashTab,
    targetGridX: target.targetGridX,
    targetGridY: target.targetGridY,
    targetEquippedSlotId: target.targetEquippedSlotId,
    quantity,
  });
}

function validateUnvaultTargetOptions(targetOptions: UnvaultTargetOptions): void {
  assert(
    targetOptions !== null && typeof targetOptions === 'object',
    'targetOptions must be an object',
  );
  const targetFilePath = (targetOptions.targetFilePath ?? '').trim();
  assert(targetFilePath.length > 0, 'targetOptions.targetFilePath must be a non-empty string');
  assert(
    VALID_SOURCE_FILE_TYPES.has(targetOptions.targetFileType),
    'targetOptions.targetFileType must be one of: d2s, sss, d2x, d2i',
  );
  assert(
    VALID_MOVE_TARGET_CONTEXTS.has(targetOptions.targetLocationContext),
    'targetOptions.targetLocationContext must be one of: equipped, inventory, stash, mercenary, corpse',
  );
  if (targetOptions.targetFileType !== 'd2s') {
    assert(
      targetOptions.targetLocationContext === 'stash',
      'Shared stash targets must use targetLocationContext=stash',
    );
  }
  if (targetOptions.targetStashTab !== undefined) {
    assert(
      targetOptions.targetLocationContext === 'stash',
      'targetOptions.targetStashTab is only allowed when targetLocationContext=stash',
    );
    assert(
      Number.isInteger(targetOptions.targetStashTab) && targetOptions.targetStashTab >= 0,
      'targetOptions.targetStashTab must be a non-negative integer',
    );
  }
  if (targetOptions.targetLocationContext === 'equipped') {
    assert(
      Number.isInteger(targetOptions.targetEquippedSlotId) &&
        VALID_EQUIPPED_SLOT_IDS.has(targetOptions.targetEquippedSlotId as number),
      'targetOptions.targetEquippedSlotId must be one of: 1-12',
    );
  } else {
    assert(
      targetOptions.targetEquippedSlotId === undefined,
      'targetOptions.targetEquippedSlotId is only allowed when targetLocationContext=equipped',
    );
  }
  assert(
    Number.isInteger(targetOptions.targetGridX) && targetOptions.targetGridX >= 0,
    'targetOptions.targetGridX must be a non-negative integer',
  );
  assert(
    Number.isInteger(targetOptions.targetGridY) && targetOptions.targetGridY >= 0,
    'targetOptions.targetGridY must be a non-negative integer',
  );
}

// Vault items that are being written to a save file right now. A second unvault of the same row
// (double drop, second window) must not write the item a second time.
const unvaultsInFlight = new Set<string>();

async function unvaultVaultItemSafely(
  itemId: string,
  targetOptions: UnvaultTargetOptions | undefined,
  withdrawCount: number | undefined,
): Promise<void> {
  const vaultItem = grailDatabase.getVaultItemById(itemId);
  assert(vaultItem !== undefined, 'Vault item not found');
  assert(isCurrentlyVaulted(vaultItem), 'Vault item is not currently vaulted');
  assert(
    !isGrailBookmark(vaultItem),
    'A grail bookmark holds no item data and cannot be unvaulted into a save file',
  );

  if (targetOptions === undefined) {
    // Items that were taken out of a save file can only come back to an explicit position;
    // flagging them as unvaulted without writing them anywhere would make them disappear.
    assert(
      !vaultItem.sourceFilePath?.trim(),
      'A target position is required to unvault an item that was removed from a save file',
    );
    grailDatabase.unvaultVaultItem(itemId, withdrawCount);
    return;
  }

  assert(Boolean(vaultItem.rawItemJson), 'Cannot unvault: vault item has no item data');

  const stackCount = vaultItem.stackCount ?? 1;
  const isResourceStack = isResourceStackFromRawJson(vaultItem.rawItemJson, vaultItem.itemCode);
  const unitsToWithdraw = withdrawCount ?? stackCount;
  assert(unitsToWithdraw <= stackCount, 'withdrawCount exceeds the number of items in the stack');
  assert(
    isResourceStack || unitsToWithdraw === stackCount,
    'Only rune and resource-stash stacks can be withdrawn partially',
  );

  assert(!unvaultsInFlight.has(itemId), 'This vault item is already being unvaulted');
  unvaultsInFlight.add(itemId);
  try {
    await assertGameNotRunning();

    // Write the item first, then update the vault: a failure in between leaves the item in both
    // places (recoverable) instead of in neither.
    await writeVaultItemToSaveFile(
      vaultItem.rawItemJson,
      targetOptions,
      targetOptions.targetStashTab ??
        (targetOptions.targetLocationContext === 'stash' ? 0 : undefined),
      isResourceStack ? unitsToWithdraw : undefined,
    );
    grailDatabase.unvaultVaultItem(itemId, unitsToWithdraw);
  } finally {
    unvaultsInFlight.delete(itemId);
  }
}

export function initializeVaultHandlers(
  getSaveFileMonitor: () => SaveFileMonitor | undefined,
): void {
  ipcMain.handle('vault:addItem', async (_, item: VaultItemUpsertInput): Promise<VaultItem> => {
    const normalizedItem = normalizeVaultItemInput(item);
    validateVaultItemInput(normalizedItem);
    return addVaultItemWithSafeSourceRemoval(
      normalizedItem,
      resolveSaveDirectory(getSaveFileMonitor),
    );
  });

  ipcMain.handle('vault:removeItem', async (_, itemId: string): Promise<{ success: boolean }> => {
    assert(typeof itemId === 'string' && itemId.length > 0, 'itemId is required');

    // A row that is still vaulted and was taken out of a save file is the only copy of that item.
    const vaultItem = grailDatabase.getVaultItemById(itemId);
    assert(
      vaultItem === undefined ||
        isGrailBookmark(vaultItem) ||
        !vaultItem.sourceFilePath?.trim() ||
        !isCurrentlyVaulted(vaultItem),
      'Unvault this item before removing it from the vault',
    );

    grailDatabase.removeVaultItem(itemId);
    return { success: true };
  });

  ipcMain.handle(
    'vault:unvaultItem',
    async (
      _,
      itemId: string,
      targetOptions?: UnvaultTargetOptions,
      withdrawCount?: unknown,
    ): Promise<{ success: boolean }> => {
      assert(typeof itemId === 'string' && itemId.length > 0, 'itemId is required');

      if (targetOptions !== undefined) {
        validateUnvaultTargetOptions(targetOptions);
        assertSaveFilePathAllowed(
          targetOptions.targetFilePath.trim(),
          resolveSaveDirectory(getSaveFileMonitor),
          'targetOptions.targetFilePath',
        );
      }

      await unvaultVaultItemSafely(itemId, targetOptions, resolveWithdrawCount(withdrawCount));
      return { success: true };
    },
  );

  ipcMain.handle(
    'vault:search',
    async (_, filter?: VaultItemFilter): Promise<VaultItemSearchResult> =>
      grailDatabase.searchVaultItems(sanitizeFilter(filter)),
  );

  ipcMain.handle(
    'inventory:searchAll',
    async (
      _,
      filter?: VaultItemFilter,
    ): Promise<{
      inventory: InventorySearchResult;
      vault: VaultItemSearchResult;
    }> => {
      const safeFilter = sanitizeFilter(filter);
      const monitor = getSaveFileMonitor();
      const snapshots = monitor?.getInventorySearchResult().snapshots ?? [];

      return {
        inventory: buildInventorySearchResult(snapshots, safeFilter),
        vault: grailDatabase.searchVaultItems(safeFilter),
      };
    },
  );

  ipcMain.handle(
    'inventory:moveItem',
    async (_, input: InventoryItemMoveInput): Promise<{ success: boolean }> => {
      const normalizedInput = normalizeInventoryMoveInput(input);
      const saveDirectory = resolveSaveDirectory(getSaveFileMonitor);
      assertSaveFilePathAllowed(normalizedInput.sourceFilePath, saveDirectory, 'sourceFilePath');
      assertSaveFilePathAllowed(normalizedInput.targetFilePath, saveDirectory, 'targetFilePath');
      await assertGameNotRunning();
      await moveItemBetweenSaveFiles(normalizedInput);
      return { success: true };
    },
  );

  ipcMain.handle(
    'inventory:splitStack',
    async (_, input: InventoryStackSplitInput): Promise<{ success: boolean }> => {
      const normalizedInput = normalizeSplitStackInput(input);
      const saveDirectory = resolveSaveDirectory(getSaveFileMonitor);
      assertSaveFilePathAllowed(normalizedInput.sourceFilePath, saveDirectory, 'sourceFilePath');
      for (const target of normalizedInput.targets) {
        assertSaveFilePathAllowed(target.targetFilePath, saveDirectory, 'targetFilePath');
      }
      await assertGameNotRunning();
      await splitStackInSaveFile(normalizedInput);

      return { success: true };
    },
  );
}
