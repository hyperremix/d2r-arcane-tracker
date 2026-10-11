import type { GrailDatabase } from '../database/database';
import type { BroadcastToRenderers } from '../ipc/broadcast';
import type {
  Character,
  CharacterClass,
  GrailProgress,
  ItemDetectionEvent,
  RunItem,
} from '../types/grail';
import { createServiceLogger } from '../utils/serviceLogger';
import type { EventBus } from './EventBus';
import type { ItemDetectionService } from './itemDetection';
import type { RunTrackerService } from './runTracker';
import type { D2SaveFile } from './saveFileMonitor';

const log = createServiceLogger('GrailProgressService');

/** Lost item data is surfaced to the user, as the data cannot be recovered from the scan. */
const SURFACE_WRITE_FAILURE = { surfaceToUI: true, code: 'databaseWriteFailed' } as const;

/** Database operations the grail progress service needs. */
export type GrailProgressDatabase = Pick<
  GrailDatabase,
  | 'addRunItem'
  | 'getCharacterByName'
  | 'getCharacterBySaveFilePath'
  | 'getProgressByItem'
  | 'transaction'
  | 'upsertCharacter'
  | 'upsertProgress'
>;

/** Dependencies of the {@link GrailProgressService}. */
export interface GrailProgressServiceDependencies {
  database: GrailProgressDatabase;
  eventBus: EventBus;
  runTracker: Pick<RunTrackerService, 'getActiveRun'>;
  broadcastToRenderers: BroadcastToRenderers;
}

/** What has to be announced once the progress of a found item is committed. */
interface RecordedFind {
  /** Set for first-time discoveries that are not silent. */
  discovery?: { character: Character; event: ItemDetectionEvent; progress: GrailProgress };
  /** Set when the find was added to the active run. */
  runItem?: { runId: string; grailProgress: GrailProgress; item: ItemDetectionEvent['item'] };
}

/**
 * Creates a grail progress entry for a character and item.
 * @param character - Character who found the item
 * @param event - Item detection event
 * @returns Grail progress object
 */
function createGrailProgress(character: Character, event: ItemDetectionEvent): GrailProgress {
  // Use d2s item ID if available, otherwise fall back to timestamp for backward compatibility
  const itemIdentifier = event.d2sItemId ? String(event.d2sItemId) : `timestamp_${Date.now()}`;
  const progressId = `${character.id}_${event.grailItem.id}_${itemIdentifier}`;
  return {
    id: progressId,
    characterId: character.id,
    itemId: event.grailItem.id,
    isEthereal: Boolean(event.item.ethereal),
    foundDate: new Date(),
    manuallyAdded: false,
    notes: `Auto-detected from ${event.item.location}`,
    fromInitialScan: event.isInitialScan ?? false,
  };
}

// Manual rows are excluded: run_items.grail_progress_id cascades on delete, so
// attaching a run item to a manual row would lose it when the row is removed.
function findMatchingProgressForCharacter(
  existingProgress: GrailProgress[] | undefined,
  targetProgress: GrailProgress,
): GrailProgress | undefined {
  if (!existingProgress?.length) {
    return undefined;
  }

  return existingProgress.find(
    (progress) =>
      !progress.manuallyAdded &&
      progress.characterId === targetProgress.characterId &&
      Boolean(progress.isEthereal) === Boolean(targetProgress.isEthereal),
  );
}

/**
 * Persists what the save file monitor finds: the character of each parsed save file and the grail
 * progress of newly found items, and announces the changes to the renderers and the run tracker.
 */
export class GrailProgressService {
  constructor(private readonly deps: GrailProgressServiceDependencies) {}

  /**
   * Records a parsed save file in one database transaction: its character is created or updated
   * first, so the found items are attributed to that character, then the progress of every found
   * item (and its run item during an active run) is written. Only after the commit are the run items
   * and the progress change announced, so listeners that query the database see the new rows.
   * A created character, or a changed name, class, level, hardcore or expansion, is announced as a
   * progress change too, as the renderers reload the characters with it. If the character cannot be
   * stored, nothing of the save file is written and the failure is surfaced.
   * @param saveFile - The parsed save file
   * @param foundItems - Grail items found in the save file for the first time
   * @returns Whether the save file was written; false if nothing of it was
   */
  recordSaveFile(saveFile: D2SaveFile, foundItems: ItemDetectionEvent[]): boolean {
    const recordedFinds: RecordedFind[] = [];
    let characterChanged = false;

    try {
      this.deps.database.transaction(() => {
        const stored = this.upsertCharacterFromSaveFile(saveFile);
        characterChanged = stored.changed;

        // Every item of the save file belongs to its character. Looking the character up by name
        // instead could pick another record with the same name, or create a record without a save
        // file when the save file's character could not be stored.
        for (const event of foundItems) {
          const recordedFind = this.recordFoundItem(event, stored.character);
          if (recordedFind) {
            recordedFinds.push(recordedFind);
          }
        }
      });
    } catch (error) {
      log.error('recordSaveFile', error, { saveFile: saveFile.name }, SURFACE_WRITE_FAILURE);
      return false;
    }

    this.announce(recordedFinds, characterChanged);
    return true;
  }

  /**
   * Creates or updates the character of a save file with its latest data. The character is found
   * by its save file, then by name (a save file that moved, e.g. after a save directory change).
   * Its name follows the save file, so a stash whose name was derived wrongly before is corrected.
   * Runs inside the save file transaction: a failure is thrown, so no item of the save file is
   * attributed to a character that was not stored.
   * @param saveFile - Save file data containing character information
   * @returns The stored character, and whether it was created or its name, class, level, hardcore
   * or expansion changed
   */
  private upsertCharacterFromSaveFile(saveFile: D2SaveFile): {
    character: Character;
    changed: boolean;
  } {
    const { database } = this.deps;
    const existing =
      database.getCharacterBySaveFilePath(saveFile.path) ||
      database.getCharacterByName(saveFile.name);
    const now = new Date();

    const character: Character = {
      ...(existing ?? {
        id: `char_${saveFile.name}_${now.getTime()}`,
        created: now,
      }),
      name: saveFile.name,
      characterClass: saveFile.characterClass as CharacterClass,
      level: saveFile.level,
      hardcore: saveFile.hardcore,
      expansion: saveFile.expansion,
      saveFilePath: saveFile.path,
      lastUpdated: now,
    };
    database.upsertCharacter(character);

    if (!existing) {
      console.log(`Created character: ${saveFile.name} (${saveFile.characterClass})`);
      return { character, changed: true };
    }
    return {
      character,
      changed:
        existing.name !== saveFile.name ||
        existing.characterClass !== saveFile.characterClass ||
        existing.level !== saveFile.level ||
        existing.hardcore !== saveFile.hardcore ||
        existing.expansion !== saveFile.expansion,
    };
  }

  /**
   * Writes the progress of a found item and, during an active run, its run item.
   * Runs inside the save file transaction, in a savepoint of its own: a failing item is rolled back
   * completely, logged and skipped, without affecting the other items of the save file.
   * @param event - Item detection event of the found item
   * @param character - The stored character of the save file the item was found in
   * @returns What to announce after the commit, or undefined if nothing was written
   */
  private recordFoundItem(
    event: ItemDetectionEvent,
    character: Character,
  ): RecordedFind | undefined {
    if (event.type !== 'item-found' || !event.item) {
      return undefined;
    }

    const { database, runTracker } = this.deps;
    try {
      return database.transaction(() => {
        // First-time global discovery: no character has found this item before
        const existingGlobalProgress = database.getProgressByItem(event.grailItem.id);
        const isFirstTimeDiscovery = existingGlobalProgress.length === 0;

        const grailProgress = createGrailProgress(character, event);
        database.upsertProgress(grailProgress);

        const recordedFind: RecordedFind = {};

        const activeRun = runTracker.getActiveRun();
        if (activeRun && !event.silent) {
          const matchingPersistedProgress = findMatchingProgressForCharacter(
            existingGlobalProgress,
            grailProgress,
          );
          const runItem: RunItem = {
            id: `run_item_${activeRun.id}_${grailProgress.id}`,
            runId: activeRun.id,
            grailProgressId: matchingPersistedProgress?.id ?? grailProgress.id,
            foundTime: new Date(),
            created: new Date(),
          };
          database.addRunItem(runItem);
          recordedFind.runItem = { runId: activeRun.id, grailProgress, item: event.item };
        }

        if (isFirstTimeDiscovery) {
          console.log(`🎉 NEW GRAIL ITEM: ${event.item.name} found by ${character.name}`);
          // Silent events (initial parsing, forced re-scans) are saved without notifications
          if (!event.silent) {
            recordedFind.discovery = { character, event, progress: grailProgress };
          }
        }

        return recordedFind;
      });
    } catch (error) {
      log.error(
        'recordFoundItem',
        error,
        { item: event.item.name, grailItemId: event.grailItem.id },
        SURFACE_WRITE_FAILURE,
      );
      return undefined;
    }
  }

  /**
   * Announces committed finds: run items to the run tracker listeners, and the progress change to
   * the renderers (with details for first-time discoveries). A character change without any find is
   * announced as a generic progress update.
   * @param recordedFinds - The finds written in the transaction
   * @param characterChanged - Whether the character of the save file was created or changed
   */
  private announce(recordedFinds: RecordedFind[], characterChanged: boolean): void {
    const { eventBus, broadcastToRenderers } = this.deps;
    if (recordedFinds.length === 0) {
      if (characterChanged) {
        broadcastToRenderers('grail-progress-updated');
      }
      return;
    }

    for (const { runItem } of recordedFinds) {
      if (runItem) {
        eventBus.emit('run-item-added', runItem);
      }
    }

    const discoveries = recordedFinds.flatMap(({ discovery }) => (discovery ? [discovery] : []));
    if (discoveries.length === 0) {
      broadcastToRenderers('grail-progress-updated');
      return;
    }

    for (const { character, event, progress } of discoveries) {
      broadcastToRenderers('grail-progress-updated', {
        character,
        item: event.item,
        progress,
        autoDetected: true,
        firstTimeDiscovery: true,
      });
    }
  }
}

/**
 * Loads the grail items and the existing progress into the item detection service, so it only
 * reports items that were not found before. Failures are logged; detection then finds nothing.
 * @param itemDetection - The item detection service
 * @param database - Database with the grail items and the progress
 */
export function loadGrailItemsIntoDetection(
  itemDetection: Pick<ItemDetectionService, 'setGrailItems' | 'initializeFromDatabase'>,
  database: Pick<GrailDatabase, 'getAllItems' | 'getAllProgress'>,
): void {
  try {
    const grailItems = database.getAllItems();
    itemDetection.setGrailItems(grailItems);
    console.log(`Loaded ${grailItems.length} grail items into detection service`);

    // Initialize with existing progress to prevent re-notification
    itemDetection.initializeFromDatabase(database.getAllProgress());
  } catch (error) {
    console.error('Failed to load grail items into detection service:', error);
  }
}
