import type { types as d2sTypes } from '@dschu012/d2s';
import type { GrailDatabase } from '../database/database';
import type { UnvaultTargetOptions } from '../ipc/contract';
import type {
  CharacterInventorySnapshot,
  InventoryItemMoveInput,
  InventorySearchResult,
  InventoryStackSplitInput,
  ParsedInventoryItem,
  ParsedInventoryItemWithRaw,
  ParsedInventorySnapshot,
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
import { isCurrentlyVaulted, isGrailBookmark } from '../utils/vaultState';
import type {
  addItemToSaveFile,
  moveItemBetweenSaveFiles,
  readSaveFileItem,
  removeItemFromSaveFile,
  SaveFileItemLocator,
  splitStackInSaveFile,
} from './saveFileEditor';

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
 * Locates the source item of a move by the id and position in its raw JSON.
 * @param input - Validated move input
 */
function resolveMoveOptions(input: InventoryItemMoveInput): NormalizedInventoryMoveInput {
  const {
    itemId: sourceItemId,
    itemCode: sourceItemCode,
    gridX: sourceGridXFromItem,
    gridY: sourceGridYFromItem,
  } = parseSourceItem(input.rawItemJson);

  // For non-d2i sources, a numeric item id is always required (non-simple items only).
  // For d2i sources, simple items (runes/gems) have no id — position is used instead.
  assert(
    input.sourceFileType === 'd2i' || sourceItemId !== undefined,
    'rawItemJson must include a numeric item id',
  );
  assert(
    input.sourceFileType !== 'd2i' ||
      sourceItemId !== undefined ||
      (sourceGridXFromItem !== undefined && sourceGridYFromItem !== undefined),
    'rawItemJson must include a numeric item id or grid coordinates for d2i source items',
  );

  return {
    sourceFilePath: input.sourceFilePath,
    sourceFileType: input.sourceFileType,
    sourceItemId,
    sourceStashTab: input.sourceStashTab,
    sourceGridXFromItem,
    sourceGridYFromItem,
    sourceItemCode,
    targetFilePath: input.targetFilePath,
    targetFileType: input.targetFileType,
    targetLocationContext: input.targetLocationContext,
    targetStashTab: input.targetStashTab,
    targetGridX: input.targetGridX,
    targetGridY: input.targetGridY,
    targetEquippedSlotId: input.targetEquippedSlotId,
  };
}

function itemMatchesFilter(item: ParsedInventoryItem, filter: VaultItemFilter): boolean {
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

/**
 * The renderer gets each item without the parsed d2s item: it already has the same data as
 * `rawItemJson`, and sending both would roughly double the payload.
 */
function toRendererInventoryItem({
  rawParsedItem: _rawParsedItem,
  ...item
}: ParsedInventoryItemWithRaw): ParsedInventoryItem {
  return item;
}

function buildInventorySearchResult(
  snapshots: ParsedInventorySnapshot[],
  filter: VaultItemFilter,
): InventorySearchResult {
  const filteredSnapshots = snapshots
    .map(
      (snapshot): CharacterInventorySnapshot => ({
        ...snapshot,
        items: snapshot.items
          .filter((item) => itemMatchesFilter(item, filter))
          .map(toRendererInventoryItem),
      }),
    )
    .filter((snapshot) => snapshot.items.length > 0);

  return {
    snapshots: filteredSnapshots,
    totalSnapshots: filteredSnapshots.length,
    totalItems: filteredSnapshots.reduce((sum, snapshot) => sum + snapshot.items.length, 0),
  };
}

/** Database operations the vault service needs. */
export type VaultDatabase = Pick<
  GrailDatabase,
  | 'addVaultItemWithUndo'
  | 'getVaultItemById'
  | 'removeVaultItem'
  | 'searchVaultItems'
  | 'unvaultVaultItem'
>;

/** Save file editing operations the vault service needs. */
export interface VaultSaveFileEditor {
  addItemToSaveFile: typeof addItemToSaveFile;
  moveItemBetweenSaveFiles: typeof moveItemBetweenSaveFiles;
  readSaveFileItem: typeof readSaveFileItem;
  removeItemFromSaveFile: typeof removeItemFromSaveFile;
  splitStackInSaveFile: typeof splitStackInSaveFile;
}

/** Dependencies of the {@link VaultService}. */
export interface VaultServiceDependencies {
  database: VaultDatabase;
  saveFileEditor: VaultSaveFileEditor;
  /** Rejects while the game is running, because it would overwrite edited save files. */
  assertGameNotRunning: () => Promise<void>;
  /** The directory the save file monitor watches, if it watches one. */
  getMonitoredSaveDirectory: () => string | undefined;
  /** The save directory configured in the settings, if any. */
  getConfiguredSaveDirectory: () => string | undefined;
  /** Inventory snapshots of the latest save file scan. */
  getInventorySnapshots: () => ParsedInventorySnapshot[];
}

/**
 * Vault and inventory operations requested by the renderer. The IPC validators
 * (`electron/ipc/vaultValidators.ts`) check and normalize the shape of every argument; this service
 * enforces the rules that need app state: renderer-supplied file paths must stay inside the save
 * directory, save files are only written while the game is not running, and the item a request
 * refers to must still be in the save file.
 */
export class VaultService {
  // Vault items that are being written to a save file right now. A second unvault of the same row
  // (double drop, second window) must not write the item a second time.
  private readonly unvaultsInFlight = new Set<string>();

  constructor(private readonly deps: VaultServiceDependencies) {}

  /**
   * Adds an item to the vault. Items taken out of a save file are removed from it afterwards.
   * @param item - Validated vault item input
   * @returns The stored vault item
   */
  async addItem(item: VaultItemUpsertInput): Promise<VaultItem> {
    return this.addVaultItemWithSafeSourceRemoval(item, this.resolveSaveDirectory());
  }

  /**
   * Removes a row from the vault, unless it is the only copy of an item taken out of a save file.
   * @param itemId - Vault item ID
   */
  removeItem(itemId: string): void {
    // A row that is still vaulted and was taken out of a save file is the only copy of that item.
    const vaultItem = this.deps.database.getVaultItemById(itemId);
    assert(
      vaultItem === undefined ||
        isGrailBookmark(vaultItem) ||
        !vaultItem.sourceFilePath?.trim() ||
        !isCurrentlyVaulted(vaultItem),
      'Unvault this item before removing it from the vault',
    );

    this.deps.database.removeVaultItem(itemId);
  }

  /**
   * Takes an item (or part of a stack) out of the vault and writes it to a save file position.
   * @param itemId - Vault item ID
   * @param targetOptions - Validated target position; may only be omitted for rows that were not
   *   taken out of a save file
   * @param withdrawCount - Number of stack units to withdraw (default: the whole stack)
   */
  async unvaultItem(
    itemId: string,
    targetOptions?: UnvaultTargetOptions,
    withdrawCount?: number,
  ): Promise<void> {
    if (targetOptions !== undefined) {
      assertSaveFilePathAllowed(
        targetOptions.targetFilePath,
        this.resolveSaveDirectory(),
        'targetOptions.targetFilePath',
      );
    }

    await this.unvaultVaultItemSafely(itemId, targetOptions, withdrawCount);
  }

  /**
   * Searches the vault.
   * @param filter - Validated search filter
   */
  search(filter: VaultItemFilter = {}): VaultItemSearchResult {
    return this.deps.database.searchVaultItems(filter);
  }

  /**
   * Searches the latest inventory scan and the vault with the same filter.
   * @param filter - Validated search filter
   */
  searchAll(filter: VaultItemFilter = {}): {
    inventory: InventorySearchResult;
    vault: VaultItemSearchResult;
  } {
    return {
      inventory: buildInventorySearchResult(this.deps.getInventorySnapshots(), filter),
      vault: this.deps.database.searchVaultItems(filter),
    };
  }

  /**
   * Moves an item within or between save files.
   * @param input - Validated move input
   */
  async moveItem(input: InventoryItemMoveInput): Promise<void> {
    const normalizedInput = resolveMoveOptions(input);
    const saveDirectory = this.resolveSaveDirectory();
    assertSaveFilePathAllowed(normalizedInput.sourceFilePath, saveDirectory, 'sourceFilePath');
    assertSaveFilePathAllowed(normalizedInput.targetFilePath, saveDirectory, 'targetFilePath');
    await this.deps.assertGameNotRunning();
    await this.deps.saveFileEditor.moveItemBetweenSaveFiles(normalizedInput);
  }

  /**
   * Splits a stack into one or more target positions.
   * @param input - Validated split input
   */
  async splitStack(input: InventoryStackSplitInput): Promise<void> {
    const saveDirectory = this.resolveSaveDirectory();
    assertSaveFilePathAllowed(input.sourceFilePath, saveDirectory, 'sourceFilePath');
    for (const target of input.targets) {
      assertSaveFilePathAllowed(target.targetFilePath, saveDirectory, 'targetFilePath');
    }
    await this.deps.assertGameNotRunning();
    await this.deps.saveFileEditor.splitStackInSaveFile(input);
  }

  /**
   * The directory the save file monitor watches, falling back to the configured one.
   * Renderer-supplied file paths must resolve to a save file inside it before they can be read or
   * written.
   */
  private resolveSaveDirectory(): string | undefined {
    const monitorDirectory = this.deps.getMonitoredSaveDirectory();
    if (monitorDirectory) {
      return monitorDirectory;
    }

    try {
      return this.deps.getConfiguredSaveDirectory() || undefined;
    } catch (error) {
      console.error('Failed to read the configured save directory', error);
      return undefined;
    }
  }

  /**
   * The scan snapshot the UI works from can be stale (the game may have moved or changed the item
   * since). Verify the item really is in the save file, and still the same, before it is vaulted and
   * removed from there: otherwise the vault would store one thing while another is deleted.
   */
  private async assertSourceItemMatchesVaultInput(
    item: VaultItemUpsertInput,
    sourceFilePath: string,
    sourceLocator: SaveFileItemLocator,
  ): Promise<void> {
    const actualItem = await this.deps.saveFileEditor.readSaveFileItem(
      sourceFilePath,
      item.sourceFileType,
      sourceLocator,
    );
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

  private async removeSourceItemAfterVaultAdd(
    undoVaultAdd: () => void,
    sourceFilePath: string,
    sourceFileType: VaultSourceFileType,
    sourceLocator: SaveFileItemLocator,
  ): Promise<void> {
    try {
      await this.deps.saveFileEditor.removeItemFromSaveFile(
        sourceFilePath,
        sourceFileType,
        sourceLocator,
      );
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

  private async addVaultItemWithSafeSourceRemoval(
    item: VaultItemUpsertInput,
    saveDirectory: string | undefined,
  ): Promise<VaultItem> {
    const sourceFilePath = item.sourceFilePath?.trim();
    if (sourceFilePath) {
      assertSaveFilePathAllowed(sourceFilePath, saveDirectory, 'sourceFilePath');
    }
    const sourceLocator = sourceFilePath ? resolveVaultSourceItemLocator(item) : undefined;

    if (sourceFilePath && sourceLocator) {
      await this.deps.assertGameNotRunning();
      await this.assertSourceItemMatchesVaultInput(item, sourceFilePath, sourceLocator);
    }

    // The vault copy is written first: if anything fails afterwards the item exists twice, never zero times.
    const { item: savedVaultItem, undo } = this.deps.database.addVaultItemWithUndo(item);

    if (sourceFilePath && sourceLocator) {
      await this.removeSourceItemAfterVaultAdd(
        undo,
        sourceFilePath,
        item.sourceFileType,
        sourceLocator,
      );
    }

    return savedVaultItem;
  }

  private async writeVaultItemToSaveFile(
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
    await this.deps.saveFileEditor.addItemToSaveFile({
      filePath: target.targetFilePath,
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

  private async unvaultVaultItemSafely(
    itemId: string,
    targetOptions: UnvaultTargetOptions | undefined,
    withdrawCount: number | undefined,
  ): Promise<void> {
    const { database } = this.deps;
    const vaultItem = database.getVaultItemById(itemId);
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
      database.unvaultVaultItem(itemId, withdrawCount);
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

    assert(!this.unvaultsInFlight.has(itemId), 'This vault item is already being unvaulted');
    this.unvaultsInFlight.add(itemId);
    try {
      await this.deps.assertGameNotRunning();

      // Write the item first, then update the vault: a failure in between leaves the item in both
      // places (recoverable) instead of in neither.
      await this.writeVaultItemToSaveFile(
        vaultItem.rawItemJson,
        targetOptions,
        targetOptions.targetStashTab ??
          (targetOptions.targetLocationContext === 'stash' ? 0 : undefined),
        isResourceStack ? unitsToWithdraw : undefined,
      );
      database.unvaultVaultItem(itemId, unitsToWithdraw);
    } finally {
      this.unvaultsInFlight.delete(itemId);
    }
  }
}
