/**
 * Copies of save files the app keeps in its data folder, listed per save file in the settings.
 *
 * Shared by the main process and the renderer.
 */

/** Snapshots kept per save file when the setting was never changed. */
export const DEFAULT_SNAPSHOTS_PER_FILE = 50;
/** Fewest snapshots per save file the setting accepts. */
export const MIN_SNAPSHOTS_PER_FILE = 1;
/** Most snapshots per save file the setting accepts. */
export const MAX_SNAPSHOTS_PER_FILE = 500;

/**
 * Why a copy exists: `snapshot` copies are taken when a monitored save file changed, `backup`
 * copies right before the app itself modified the file (including a restore).
 */
export type SaveFileSnapshotKind = 'snapshot' | 'backup';

/** One copy of a save file. */
export interface SaveFileSnapshot {
  /** Identifies the copy for a restore: the kind and the copy's file name. */
  id: string;
  kind: SaveFileSnapshotKind;
  /** When the copy was taken. */
  createdAt: Date;
  sizeBytes: number;
  /** Character level stored in a character save (.d2s) copy. */
  characterLevel?: number;
}

/** The copies of one save file of the configured save folder, newest first. */
export interface SaveFileSnapshotGroup {
  fileName: string;
  /** Whether the save file is in the save folder right now. */
  fileExists: boolean;
  snapshots: SaveFileSnapshot[];
}
