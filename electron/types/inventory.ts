/**
 * Parsed save file inventories and the inputs for moving and splitting items in save files.
 *
 * Shared by the main process and the renderer; re-exported from `./grail`.
 */
import type * as d2s from '@dschu012/d2s';
import type { StashTabKind, VaultLocationContext, VaultSourceFileType } from './vault';

/**
 * Type representing a raw item from a D2 save file as parsed by the d2s library.
 */
export type D2SItem = {
  id?: string | number;
  type?: string;
  type_name?: string;
  code?: string;
  name?: string;
  unique_name?: string;
  set_name?: string;
  rare_name?: string;
  rare_name2?: string;
  magic_prefix_name?: string;
  magic_suffix_name?: string;
  runeword_name?: string;
  level?: number;
  ethereal?: number;
  quality?: number;
  location?: string;
  location_id?: number;
  equipped_id?: number;
  position_x?: number;
  position_y?: number;
  alt_position_id?: number;
  equipped?: boolean;
  socketed?: number;
  socket_count?: number;
  quantity?: number;
  inv_width?: number;
  inv_height?: number;
  inv_file?: string | number;
  inv_transform?: number;
  socketed_items?: D2SItem[];
  gems?: unknown[];
  magic_attributes?: Array<{ name: string; value?: unknown }>;
};

/**
 * An item of a save file as the inventory browser shows it. This is the shape sent to renderer
 * windows; the main process keeps the parsed d2s item as well ({@link ParsedInventoryItemWithRaw}).
 */
export interface ParsedInventoryItem {
  fingerprint: string;
  characterName: string;
  characterId?: string;
  sourceFileType: VaultSourceFileType;
  sourceFilePath: string;
  locationContext: VaultLocationContext;
  stashTab?: number;
  stashTabKind?: StashTabKind;
  gridX?: number;
  gridY?: number;
  gridWidth?: number;
  gridHeight?: number;
  equippedSlotId?: number;
  iconFileName?: string;
  isSocketedItem?: boolean;
  itemName: string;
  itemCode?: string;
  type?: string;
  quality: string;
  ethereal: boolean;
  socketCount: number;
  stackCount?: number;
  grailItemId?: string;
  rawItemJson: string;
  seenAt: Date;
}

/** A parsed save file item in the main process, together with the d2s item it was parsed from. */
export interface ParsedInventoryItemWithRaw extends ParsedInventoryItem {
  rawParsedItem: d2s.types.IItem;
}

/**
 * The items of one save file. Renderer windows receive {@link ParsedInventoryItem}s; the main
 * process keeps {@link ParsedInventoryItemWithRaw}s.
 */
export interface CharacterInventorySnapshot<
  TItem extends ParsedInventoryItem = ParsedInventoryItem,
> {
  snapshotId: string;
  characterName: string;
  characterId?: string;
  sourceFileType: VaultSourceFileType;
  sourceFilePath: string;
  sourceFileVersion?: number;
  readOnly?: boolean;
  capturedAt: Date;
  items: TItem[];
}

/** Inventory snapshots as the main process keeps them. */
export type ParsedInventorySnapshot = CharacterInventorySnapshot<ParsedInventoryItemWithRaw>;

export interface InventorySearchResult<
  TSnapshot extends CharacterInventorySnapshot = CharacterInventorySnapshot,
> {
  snapshots: TSnapshot[];
  totalSnapshots: number;
  totalItems: number;
}

export interface InventorySnapshotWindowTarget {
  sourceFilePath: string;
  sourceFileType: VaultSourceFileType;
  characterName: string;
}

export interface InventoryItemMoveInput {
  sourceFilePath: string;
  sourceFileType: VaultSourceFileType;
  rawItemJson: string;
  sourceStashTab?: number;
  targetFilePath: string;
  targetFileType: VaultSourceFileType;
  targetLocationContext: VaultLocationContext;
  targetStashTab?: number;
  targetGridX?: number;
  targetGridY?: number;
  targetEquippedSlotId?: number;
}

export interface StackSplitTarget {
  targetFilePath: string;
  targetFileType: VaultSourceFileType;
  targetLocationContext: VaultLocationContext;
  targetStashTab?: number;
  targetGridX: number;
  targetGridY: number;
}

export interface InventoryStackSplitInput {
  sourceFilePath: string;
  sourceFileType: VaultSourceFileType;
  sourceStashTab: number;
  sourceItemCode: string;
  /** Raw JSON of the source IItem. Required when sourceFileType is 'd2i' (modern stash). */
  sourceRawItemJson?: string;
  splitCount: number;
  targets: StackSplitTarget[];
}
