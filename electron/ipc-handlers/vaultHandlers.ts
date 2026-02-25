import type { types as d2sTypes } from '@dschu012/d2s';
import { ipcMain } from 'electron';
import { grailDatabase } from '../database/database';
import {
  addItemToSaveFile,
  moveItemBetweenSaveFiles,
  removeItemFromSaveFile,
} from '../services/saveFileEditor';
import type { SaveFileMonitor } from '../services/saveFileMonitor';
import type {
  CharacterInventorySnapshot,
  InventoryItemMoveInput,
  InventorySearchResult,
  VaultCategory,
  VaultCategoryCreateInput,
  VaultCategoryUpdateInput,
  VaultItem,
  VaultItemFilter,
  VaultItemSearchResult,
  VaultItemUpsertInput,
  VaultLocationContext,
  VaultSourceFileType,
} from '../types/grail';

const MAX_SEARCH_TEXT_LENGTH = 120;
const MAX_PAGE_SIZE = 200;
const MIN_PAGE = 1;
const MIN_PAGE_SIZE = 1;

const VALID_PRESENT_STATES = new Set(['all', 'present', 'missing']);
const VALID_VAULTED_STATES = new Set(['all', 'vaulted', 'unvaulted']);
const VALID_SORT_BY = new Set(['itemName', 'lastSeenAt', 'createdAt', 'updatedAt', 'vaultedAt']);
const VALID_SORT_ORDER = new Set(['asc', 'desc']);
const VALID_SOURCE_FILE_TYPES = new Set(['d2s', 'sss', 'd2x', 'd2i']);
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
  sourceItemId: number;
  targetFilePath: string;
  targetFileType: VaultSourceFileType;
  targetLocationContext: VaultLocationContext;
  targetStashTab?: number;
  targetGridX?: number;
  targetGridY?: number;
  targetEquippedSlotId?: number;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
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
      'sortBy must be one of: itemName, lastSeenAt, createdAt, updatedAt',
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

function validateCategoryInput(input: VaultCategoryCreateInput | VaultCategoryUpdateInput): void {
  if ('name' in input && input.name !== undefined) {
    assert(
      typeof input.name === 'string' && input.name.trim().length > 0,
      'Category name is required',
    );
  }
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

function parseSourceItemId(rawItemJson: string): number {
  let parsedRawItem: { id?: unknown };
  try {
    parsedRawItem = JSON.parse(rawItemJson) as { id?: unknown };
  } catch {
    throw new Error('rawItemJson must be valid JSON');
  }

  const itemId = toItemId(parsedRawItem.id);
  if (itemId === undefined) {
    throw new Error('rawItemJson must include a numeric item id');
  }

  return itemId;
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

  const sourceItemId = parseSourceItemId(input.rawItemJson);
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

  return {
    sourceFilePath,
    sourceFileType: input.sourceFileType,
    sourceItemId,
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

export function initializeVaultHandlers(
  getSaveFileMonitor: () => SaveFileMonitor | undefined,
): void {
  ipcMain.handle('vault:addItem', async (_, item: VaultItemUpsertInput): Promise<VaultItem> => {
    const normalizedItem = normalizeVaultItemInput(item);
    validateVaultItemInput(normalizedItem);

    if (normalizedItem.sourceFilePath && normalizedItem.rawItemJson) {
      const parsedItem = JSON.parse(normalizedItem.rawItemJson) as { id?: number };
      if (parsedItem.id !== undefined) {
        await removeItemFromSaveFile(
          normalizedItem.sourceFilePath,
          normalizedItem.sourceFileType,
          parsedItem.id,
        );
      }
    }

    return grailDatabase.addVaultItem(normalizedItem);
  });

  ipcMain.handle('vault:removeItem', async (_, itemId: string): Promise<{ success: boolean }> => {
    assert(typeof itemId === 'string' && itemId.length > 0, 'itemId is required');
    grailDatabase.removeVaultItem(itemId);
    return { success: true };
  });

  ipcMain.handle(
    'vault:unvaultItem',
    async (
      _,
      itemId: string,
      targetOptions?: {
        targetFilePath: string;
        targetFileType: VaultSourceFileType;
        targetLocationContext: VaultLocationContext;
        targetStashTab?: number;
        targetGridX: number;
        targetGridY: number;
      },
    ): Promise<{ success: boolean }> => {
      assert(typeof itemId === 'string' && itemId.length > 0, 'itemId is required');

      const vaultItem = grailDatabase.getVaultItemById(itemId);
      const filePath = targetOptions?.targetFilePath ?? vaultItem?.sourceFilePath;
      const fileType = targetOptions?.targetFileType ?? vaultItem?.sourceFileType;
      const locationContext = targetOptions?.targetLocationContext ?? vaultItem?.locationContext;
      const stashTab = targetOptions?.targetStashTab ?? vaultItem?.stashTab;
      if (filePath && vaultItem?.rawItemJson && fileType && locationContext) {
        const parsedItem = JSON.parse(vaultItem.rawItemJson) as d2sTypes.IItem;
        await addItemToSaveFile(
          filePath,
          fileType,
          parsedItem,
          locationContext,
          stashTab,
          targetOptions?.targetGridX,
          targetOptions?.targetGridY,
        );
      }

      grailDatabase.unvaultVaultItem(itemId);
      return { success: true };
    },
  );

  ipcMain.handle(
    'vault:updateItemTags',
    async (_, itemId: string, categoryIds: string[]): Promise<{ success: boolean }> => {
      assert(typeof itemId === 'string' && itemId.length > 0, 'itemId is required');
      assert(Array.isArray(categoryIds), 'categoryIds must be an array');
      grailDatabase.setVaultItemCategories(itemId, categoryIds);
      return { success: true };
    },
  );

  ipcMain.handle(
    'vault:listItems',
    async (_, filter?: VaultItemFilter): Promise<VaultItemSearchResult> => {
      return grailDatabase.searchVaultItems(sanitizeFilter(filter));
    },
  );

  ipcMain.handle(
    'vault:search',
    async (_, filter?: VaultItemFilter): Promise<VaultItemSearchResult> => {
      return grailDatabase.searchVaultItems(sanitizeFilter(filter));
    },
  );

  ipcMain.handle(
    'vault:createCategory',
    async (_, input: VaultCategoryCreateInput): Promise<{ success: boolean }> => {
      validateCategoryInput(input);
      grailDatabase.addVaultCategory(input);
      return { success: true };
    },
  );

  ipcMain.handle(
    'vault:updateCategory',
    async (
      _,
      categoryId: string,
      updates: VaultCategoryUpdateInput,
    ): Promise<{ success: boolean }> => {
      assert(typeof categoryId === 'string' && categoryId.length > 0, 'categoryId is required');
      validateCategoryInput(updates);
      grailDatabase.updateVaultCategory(categoryId, updates);
      return { success: true };
    },
  );

  ipcMain.handle(
    'vault:deleteCategory',
    async (_, categoryId: string): Promise<{ success: boolean }> => {
      assert(typeof categoryId === 'string' && categoryId.length > 0, 'categoryId is required');
      grailDatabase.removeVaultCategory(categoryId);
      return { success: true };
    },
  );

  ipcMain.handle('vault:listCategories', async (): Promise<VaultCategory[]> => {
    return grailDatabase.getAllVaultCategories();
  });

  ipcMain.handle('inventory:listSnapshots', async (): Promise<InventorySearchResult> => {
    const monitor = getSaveFileMonitor();
    return (
      monitor?.getInventorySearchResult() ?? { snapshots: [], totalSnapshots: 0, totalItems: 0 }
    );
  });

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
      await moveItemBetweenSaveFiles(normalizedInput);
      return { success: true };
    },
  );
}
