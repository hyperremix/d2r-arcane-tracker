import { ipcMain } from 'electron';
import { grailDatabase } from '../database/database';
import type { SaveFileMonitor } from '../services/saveFileMonitor';
import type {
  CharacterInventorySnapshot,
  InventorySearchResult,
  VaultCategory,
  VaultCategoryCreateInput,
  VaultCategoryUpdateInput,
  VaultItem,
  VaultItemFilter,
  VaultItemSearchResult,
  VaultItemUpsertInput,
} from '../types/grail';

const MAX_SEARCH_TEXT_LENGTH = 120;
const MAX_PAGE_SIZE = 200;
const MIN_PAGE = 1;
const MIN_PAGE_SIZE = 1;

const VALID_PRESENT_STATES = new Set(['all', 'present', 'missing']);
const VALID_SORT_BY = new Set(['itemName', 'lastSeenAt', 'createdAt', 'updatedAt']);
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

function validateCategoryInput(input: VaultCategoryCreateInput | VaultCategoryUpdateInput): void {
  if ('name' in input && input.name !== undefined) {
    assert(
      typeof input.name === 'string' && input.name.trim().length > 0,
      'Category name is required',
    );
  }
}

function itemMatchesFilter(
  item: CharacterInventorySnapshot['items'][number],
  filter: VaultItemFilter,
): boolean {
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
    validateVaultItemInput(item);
    return grailDatabase.addVaultItem(item);
  });

  ipcMain.handle('vault:removeItem', async (_, itemId: string): Promise<{ success: boolean }> => {
    assert(typeof itemId === 'string' && itemId.length > 0, 'itemId is required');
    grailDatabase.removeVaultItem(itemId);
    return { success: true };
  });

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
}
