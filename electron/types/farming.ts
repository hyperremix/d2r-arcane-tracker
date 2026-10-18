/**
 * Farming advisor: where missing grail items can drop, and how often.
 *
 * Shared by the main process and the renderer; re-exported from `./grail`.
 */
import type { Difficulty } from './catalog';

/** What a farming location is: an area full of monsters, a super unique or a boss. */
export type FarmingLocationKind = 'area' | 'superUnique' | 'boss';

/** The monsters a drop chance is for. */
export type FarmingMonsterKind = 'regular' | 'champion' | 'unique' | 'superUnique' | 'boss';

/**
 * Why the farming data can't be read: no D2R installation is set, the extracted game data tables
 * are missing, or reading them failed.
 */
export type FarmingDataErrorCode = 'pathNotConfigured' | 'gameFilesMissing' | 'readFailed';

/** The farming data could not be read. */
export interface FarmingDataUnavailable {
  status: 'unavailable';
  errorCode: FarmingDataErrorCode;
  /** The missing game files, for `gameFilesMissing` */
  missingFiles?: string[];
}

/** The lowest and highest value of something that differs between monsters. */
export interface FarmingRange {
  min: number;
  max: number;
}

/** The most item IDs one farming request can ask about. */
export const MAX_FARMING_ITEM_IDS = 2000;
/** The highest magic find a farming request accepts. */
export const MAX_FARMING_MAGIC_FIND = 10_000;
/** The highest /players setting. */
export const MAX_FARMING_PLAYERS = 8;
/** The highest character level. */
export const MAX_FARMING_CHARACTER_LEVEL = 99;

/** Asks which of the given items can drop where. */
export interface FarmingOverviewRequest {
  itemIds: string[];
  /** The character level that sets the monster level in terror zones */
  characterLevel: number;
}

/** A place to farm and which of the requested items can drop there. */
export interface FarmingLocation {
  id: string;
  kind: FarmingLocationKind;
  difficulty: Difficulty;
  /** Area name, or the name of the super unique or boss */
  name: string;
  /** The area a super unique or boss is in */
  areaName?: string;
  monsterLevel: FarmingRange;
  /** Positions in the request's `itemIds` of the items that can drop */
  itemIndexes: number[];
}

/** Which of the requested items can drop from terrorized monsters of a terror zone. */
export interface FarmingTerrorZone {
  zoneId: string;
  difficulty: Difficulty;
  monsterLevel: FarmingRange;
  /** Positions in the request's `itemIds` of the items that can drop */
  itemIndexes: number[];
}

export interface FarmingOverviewData {
  status: 'ready';
  locations: FarmingLocation[];
  /** Empty when the game's terror zone file can't be read */
  terrorZones: FarmingTerrorZone[];
  /** Positions in the request's `itemIds` of the items the game data has no drop data for */
  unknownItemIndexes: number[];
}

export type FarmingOverview = FarmingOverviewData | FarmingDataUnavailable;

/** Asks where one item drops and how often. */
export interface FarmingItemSourcesRequest {
  itemId: string;
  /** The /players setting (1-8) */
  players: number;
  /** Magic find in percent */
  magicFind: number;
  /** The character level that sets the monster level in terror zones */
  characterLevel: number;
}

/** One kind of monster at a location that can drop the item. */
export interface FarmingItemSource {
  locationId: string;
  kind: FarmingLocationKind;
  monsterKind: FarmingMonsterKind;
  difficulty: Difficulty;
  name: string;
  areaName?: string;
  /** The terror zone, when this is the terrorized version of the location */
  terrorZoneId?: string;
  monsterLevel: FarmingRange;
  /**
   * Expected drops of the item per kill. For monster kinds made up of several monster types this
   * is the range over the types.
   */
  dropsPerKill: FarmingRange;
}

export interface FarmingItemSourcesData {
  status: 'ready';
  /** Whether the game data has drop data for the item at all */
  known: boolean;
  /** Most drops per kill first */
  sources: FarmingItemSource[];
}

export type FarmingItemSources = FarmingItemSourcesData | FarmingDataUnavailable;
