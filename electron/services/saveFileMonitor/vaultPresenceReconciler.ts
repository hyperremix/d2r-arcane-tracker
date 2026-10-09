import { stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { GrailDatabase } from '../../database/database';
import type { ParsedInventoryItemWithRaw } from '../../types/grail';
import { createServiceLogger } from '../../utils/serviceLogger';
import { createVaultPresenceKey } from '../../utils/vaultPresence';
import type { SingleFileParseResult } from './types';

const log = createServiceLogger('SaveFileMonitor');

/** The vault presence operations of the grail database. */
export type VaultPresenceDatabase = Pick<
  GrailDatabase,
  | 'getVaultSourceFilePathsPresentInLatestScan'
  | 'markVaultItemsMissingForSourceFiles'
  | 'reconcileVaultItemsForScan'
>;

/**
 * Describes an item without its position, location or character, so presence matching can still
 * recognise an item after it moved inside its save (which changes its fingerprint).
 */
export function createPresenceIdentityKey(item: ParsedInventoryItemWithRaw): string {
  return createVaultPresenceKey({
    sourceFileType: item.sourceFileType,
    itemCode: item.itemCode,
    quality: item.quality,
    ethereal: item.ethereal,
    socketCount: item.socketCount,
    itemName: item.itemName,
    isSocketedItem: item.isSocketedItem,
    itemUid: item.rawParsedItem?.id,
  });
}

/** True only when the file is verifiably absent while its directory can still be read. */
export async function isSaveFileDeleted(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return false;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code !== 'ENOENT' && code !== 'ENOTDIR') {
      return false;
    }
  }

  try {
    return (await stat(dirname(filePath))).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Clears the "present in latest scan" flag of vault rows whose source save file was deleted or
 * renamed. Without this, such rows would stay present forever because only files that are still
 * scanned get reconciled.
 *
 * Only presence flags change (see `markVaultItemsMissingForSourceFiles`). A file counts as gone
 * only when it is not part of this scan and `stat` reports it missing (ENOENT/ENOTDIR) while its
 * directory is still readable; any other error, or an unavailable directory (an unmounted drive,
 * a moved save folder), is treated as unknown and leaves the rows alone. When no save file is
 * found at all the scan aborts earlier and nothing is changed, because that is more likely a
 * misconfigured directory than every file being deleted.
 *
 * Rows that were vaulted out of their file or that share a `#uuid` fingerprint with another row
 * are not special-cased: they are handled like every other row of their file.
 */
export async function markOrphanedVaultRowsMissing(
  database: VaultPresenceDatabase,
  scannedFilePaths: string[],
): Promise<void> {
  try {
    const scanned = new Set(scannedFilePaths);
    const candidates = database
      .getVaultSourceFilePathsPresentInLatestScan()
      .filter((path) => !scanned.has(path));
    const deletedFiles: string[] = [];

    for (const path of candidates) {
      if (await isSaveFileDeleted(path)) {
        deletedFiles.push(path);
      }
    }

    if (deletedFiles.length > 0) {
      log.info('markOrphanedVaultRowsMissing', `Source files deleted: ${deletedFiles.length}`);
      database.markVaultItemsMissingForSourceFiles(deletedFiles);
    }
  } catch (error) {
    log.error('markOrphanedVaultRowsMissing', error);
  }
}

/**
 * Updates the "present in latest scan" flag of vault rows for every save file that was parsed
 * successfully in this scan.
 *
 * Only parsed files are reconciled (a failed or skipped file keeps its previous flags), and each
 * reconciliation is scoped to that one file, so it can never mark rows from other files as
 * missing. It only touches presence flags: vaulted state and item data are never modified.
 * Errors are logged and swallowed so a database problem cannot break save file scanning.
 *
 * Fingerprints include the character name and item position, so an item that moved inside its
 * file gets a new fingerprint. The database therefore also matches rows by a location-independent
 * identity key (`presentIdentityKeys`), and a moved item stays present. A renamed character is a
 * different file and is not covered.
 */
export function reconcileVaultPresence(
  database: VaultPresenceDatabase | undefined,
  parseResults: Array<SingleFileParseResult | undefined>,
): void {
  for (const result of parseResults) {
    // Only a completed parse proves which items are gone. A skipped (game mode), errored or
    // partial parse yields no or only some items, and must not mark vault rows of the file as missing.
    if (result?.success !== true || result.parseStatus !== 'parsed') {
      continue;
    }

    const snapshot = result.inventorySnapshot;
    try {
      database?.reconcileVaultItemsForScan({
        sourceFileType: snapshot.sourceFileType,
        sourceFilePath: snapshot.sourceFilePath,
        presentFingerprints: result.presentFingerprints,
        presentIdentityKeys: result.presentIdentityKeys,
        lastSeenAt: snapshot.capturedAt,
      });
    } catch (error) {
      log.error('reconcileVaultPresence', error, { filePath: snapshot.sourceFilePath });
    }
  }
}
