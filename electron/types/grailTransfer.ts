/**
 * Export and import of the grail progress.
 *
 * Shared by the main process and the renderer.
 */

/** File formats the grail progress can be exported to. */
export type GrailExportFormat = 'json' | 'csv';

/**
 * Formats an import file was read as: the app's own JSON export, a JSON export of
 * Nasicus/d2-holy-grail, or a CSV list of item names.
 */
export type GrailImportSource = 'app-json' | 'nasicus-json' | 'csv';

/** An entry of an import file that matches no grail item, or a version the item doesn't have. */
export interface GrailImportUnmatched {
  name: string;
  /** Set when the item exists but not in this version. */
  version?: 'normal' | 'ethereal';
}

/** What importing a file would change, shown before anything is written. */
export interface GrailImportPreview {
  /** Identifies the read file when the import is applied; only the latest preview can be applied. */
  importId: string;
  source: GrailImportSource;
  fileName: string;
  /** Finds in the file that match a grail item, counting each item version once. */
  matchedCount: number;
  /** Finds that will be added. */
  newCount: number;
  /** Finds of item versions that are already found; they are not added again. */
  existingCount: number;
  /** Existing finds whose found date moves to the earlier date of the file. */
  earlierDateCount: number;
  /** Entries of the file that couldn't be matched, each listed once. */
  unmatched: GrailImportUnmatched[];
}

/** What an applied import changed. */
export interface GrailImportResult {
  added: number;
  earlierDates: number;
}
