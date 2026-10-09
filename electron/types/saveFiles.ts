/**
 * Save file monitoring: watched directories, save file events and grail item detection events.
 *
 * Shared by the main process and the renderer; re-exported from `./grail`.
 */
import type * as d2s from '@dschu012/d2s';
import type { CharacterClass, Item } from './catalog';
import type { ParsedInventoryItem } from './inventory';
import type { VaultLocationContext } from './vault';

/**
 * Interface representing the status of save file monitoring.
 */
export interface MonitoringStatus {
  isMonitoring: boolean;
  directory: string | null;
}

/**
 * Outcome of inspecting a candidate save directory without applying it.
 * - `invalidPath`: not a usable absolute path
 * - `notFound`: the path does not exist or is not a readable directory
 * - `noSaveFiles`: the directory exists but contains no `.d2s` character files
 * - `hasSaveFiles`: the directory contains at least one `.d2s` character file
 */
export type SaveDirectoryInspectionStatus =
  | 'invalidPath'
  | 'notFound'
  | 'noSaveFiles'
  | 'hasSaveFiles';

/**
 * Result of inspecting a candidate save directory.
 */
export interface SaveDirectoryInspection {
  status: SaveDirectoryInspectionStatus;
  /** Number of `.d2s` character files directly inside the directory. */
  saveFileCount: number;
  /**
   * A nearby `Diablo II Resurrected` folder that does contain character files, offered when the
   * candidate looks like its parent (e.g. "Saved Games") or one of its subfolders.
   */
  suggestedDirectory?: string;
}

/**
 * Type representing a simplified item structure for internal use.
 */
export type D2Item = {
  id: string;
  name: string;
  type: string;
  quality: 'normal' | 'magic' | 'rare' | 'set' | 'unique' | 'crafted';
  level: number;
  ethereal: boolean;
  sockets: number;
  timestamp: Date;
  characterName: string;
  characterClass?: CharacterClass;
  location: 'inventory' | 'stash' | 'equipment';
  locationContext?: VaultLocationContext;
  stashTab?: number;
  rawParsedItem?: d2s.types.IItem;
};

/**
 * Event emitted when a grail item is detected in a save file.
 */
export type ItemDetectionEvent = {
  type: 'item-found';
  item: D2Item;
  grailItem: Item;
  /**
   * When true, suppresses all user-facing notifications for this detection.
   * Inherited from SaveFileEvent.silent.
   *
   * Effects when true:
   * - No sound notification played
   * - No native OS notification shown
   * - No in-app notification popup displayed
   * - No grail progress update event sent to renderer
   * - Item is still saved to database
   * - Item is still tracked for duplicate detection
   *
   * This allows bulk operations (startup, re-scan) to process items
   * without overwhelming the user with notifications.
   */
  silent?: boolean;
  /**
   * When true, marks this item as being found during the initial application
   * startup scan. Inherited from SaveFileEvent.isInitialScan.
   *
   * Items with this flag will be excluded from statistics like:
   * - Recent Finds
   * - Current Streak
   * - Avg per Day
   */
  isInitialScan?: boolean;
  d2sItemId?: string | number;
};

/**
 * Type representing a Diablo 2 save file with character information.
 */
export type D2SaveFile = {
  name: string;
  path: string;
  lastModified: Date;
  characterClass: string;
  level: number;
  hardcore: boolean;
  expansion: boolean;
  sourceFileVersion?: number;
};

/**
 * Event emitted when a save file is created, modified, or deleted.
 */
export type SaveFileEvent = {
  type: 'created' | 'modified' | 'deleted';
  file: D2SaveFile;
  /**
   * Every item the monitor parsed from the file (socketed items included), so listeners never
   * read the file again. Only present in the main process: it is stripped before the event is
   * forwarded to renderer windows.
   */
  parsedItems?: ParsedInventoryItem[];
  /**
   * When true, suppresses all user-facing notifications for this event.
   * Used during initial startup parsing to prevent notification spam for
   * items that were already found.
   *
   * Set to true when:
   * - Initial parsing on application startup or after a save directory change
   *   (isInitialParsing=true)
   *
   * Set to false when:
   * - Normal gameplay file changes (user actually found a new item)
   * - User manually triggers "Re-scan all files": the detection service already
   *   ignores items it has seen, so only genuinely new items notify
   *
   * Note: Items are ALWAYS saved to database regardless of silent flag.
   * Only notifications are suppressed.
   */
  silent?: boolean;
  /**
   * When true, marks items found during this event as being from the initial
   * application startup scan. These items will be excluded from statistics
   * like Recent Finds, Current Streak, and Avg per Day.
   *
   * Set to true ONLY when:
   * - Initial parsing on application startup (isInitialParsing=true)
   *
   * Set to false when:
   * - User manually triggers "Re-scan all files" (forceParseAll=true)
   * - Normal gameplay file changes
   */
  isInitialScan?: boolean;
};

/**
 * Interface representing the state of a save file for tracking modifications.
 */
export interface SaveFileState {
  id: string;
  filePath: string;
  lastModified: Date;
  lastParsed: Date;
  created: Date;
  updated: Date;
}
