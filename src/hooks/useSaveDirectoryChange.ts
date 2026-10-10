import { useCallback, useState } from 'react';

/**
 * The kind of save directory change being confirmed.
 */
export type SaveDirectoryChangeAction = 'change' | 'restore';

/**
 * A requested save directory change.
 */
export interface SaveDirectoryChangeRequest {
  /** Whether the user picked a folder or asked to restore the platform default. */
  action: SaveDirectoryChangeAction;
  /** The directory the change would switch to. */
  directory: string;
}

/**
 * Number of characters and grail progress entries a save directory change would delete.
 */
export interface ExistingUserDataCounts {
  characters: number;
  progress: number;
}

/**
 * A change awaiting confirmation, with the directory it would switch away from.
 */
export interface PendingSaveDirectoryChange extends SaveDirectoryChangeRequest {
  /** The directory that was being monitored when the change was requested, if known. */
  currentDirectory: string | undefined;
  /** What the change would delete, or undefined if it could not be determined. */
  existingData?: ExistingUserDataCounts;
}

/**
 * Result of requesting or confirming a save directory change.
 * - `unchanged`: the requested directory is already monitored; nothing was done
 * - `confirmationRequired`: existing data would be deleted; the change is pending confirmation
 * - `applied`: the change was applied
 * - `failed`: applying the change failed
 */
export type SaveDirectoryChangeOutcome =
  | 'unchanged'
  | 'confirmationRequired'
  | 'applied'
  | 'failed';

/**
 * Options for {@link useSaveDirectoryChange}.
 */
export interface UseSaveDirectoryChangeOptions {
  /** The directory currently being monitored, if known. When unknown, the saved setting or platform default is used. */
  currentDirectory: string | undefined;
  /** Called after a change has been applied, e.g. to reload data. Failures are logged only. */
  onApplied?: (change: SaveDirectoryChangeRequest) => Promise<void> | void;
}

/**
 * State and actions returned by {@link useSaveDirectoryChange}.
 */
export interface SaveDirectoryChangeState {
  /** The change awaiting user confirmation, if any. */
  pendingChange: PendingSaveDirectoryChange | undefined;
  /** Whether a change is currently being applied. */
  isApplying: boolean;
  /** Compares the requested directory with the current one and applies or defers the change. */
  requestChange: (change: SaveDirectoryChangeRequest) => Promise<SaveDirectoryChangeOutcome>;
  /** Applies the pending change. */
  confirmPendingChange: () => Promise<SaveDirectoryChangeOutcome>;
  /** Discards the pending change unless it is currently being applied. */
  cancelPendingChange: () => void;
}

/**
 * Normalizes a directory path for a best-effort equality check in the renderer.
 * The main process performs the authoritative comparison before clearing data.
 * @param {string} directory - Directory path to normalize
 * @returns {string} Normalized directory path
 */
export function normalizeDirectoryForComparison(directory: string): string {
  const trimmed = directory.trim().replace(/[\\/]+$/, '');
  return window.electronAPI?.platform === 'win32' ? trimmed.toLowerCase() : trimmed;
}

/**
 * Counts the characters and grail progress entries currently in the database.
 * @returns {Promise<ExistingUserDataCounts | undefined>} The counts, or undefined if the check failed
 */
export async function countExistingUserData(): Promise<ExistingUserDataCounts | undefined> {
  try {
    const [characters, progress] = await Promise.all([
      window.electronAPI?.grail.getCharacters(),
      window.electronAPI?.grail.getProgress(),
    ]);
    return { characters: characters?.length ?? 0, progress: progress?.length ?? 0 };
  } catch (error) {
    console.error('Failed to check for existing user data:', error);
    return undefined;
  }
}

/**
 * Checks whether a directory change would delete characters or grail progress.
 * If the counts could not be determined, existing data is assumed so the user is asked to confirm.
 * @param {ExistingUserDataCounts | undefined} existingData - Counts from {@link countExistingUserData}
 * @returns {boolean} True if user data exists or its presence is unknown
 */
export function hasExistingUserData(existingData: ExistingUserDataCounts | undefined): boolean {
  return !existingData || existingData.characters > 0 || existingData.progress > 0;
}

/**
 * Resolves the directory the database content belongs to, mirroring the main process:
 * the known monitored directory, else the saved `saveDir` setting, else the platform default.
 * @param {string | undefined} knownDirectory - Directory reported by the monitoring status
 * @returns {Promise<string | undefined>} The effective current directory, or undefined if unknown
 */
async function resolveCurrentDirectory(
  knownDirectory: string | undefined,
): Promise<string | undefined> {
  if (knownDirectory?.trim()) {
    return knownDirectory;
  }
  try {
    const settings = await window.electronAPI?.grail.getSettings();
    if (settings?.saveDir?.trim()) {
      return settings.saveDir;
    }
    const defaultDirectory = await window.electronAPI?.saveFile.getDefaultDirectory();
    return defaultDirectory?.trim() ? defaultDirectory : undefined;
  } catch (error) {
    console.error('Failed to resolve the current save directory:', error);
    return undefined;
  }
}

/**
 * Manages changing the monitored save directory safely:
 * an unchanged directory is a no-op, and switching to a different directory while
 * characters or progress exist requires explicit confirmation, because the main
 * process permanently deletes that data when the directory changes.
 * @param {UseSaveDirectoryChangeOptions} options - Current directory and apply callback
 * @returns {SaveDirectoryChangeState} Pending change state and actions
 */
export function useSaveDirectoryChange({
  currentDirectory,
  onApplied,
}: UseSaveDirectoryChangeOptions): SaveDirectoryChangeState {
  const [pendingChange, setPendingChange] = useState<PendingSaveDirectoryChange | undefined>(
    undefined,
  );
  const [isApplying, setIsApplying] = useState(false);

  const applyChange = useCallback(
    async (change: SaveDirectoryChangeRequest): Promise<SaveDirectoryChangeOutcome> => {
      setIsApplying(true);
      try {
        // The main process persists the setting, clears data if needed and restarts monitoring
        if (change.action === 'restore') {
          await window.electronAPI?.saveFile.restoreDefaultDirectory();
        } else {
          await window.electronAPI?.saveFile.updateSaveDirectory(change.directory);
        }
      } catch (error) {
        console.error('Failed to change save directory:', error);
        setIsApplying(false);
        return 'failed';
      }

      // The change has been applied. Refreshing the UI is best effort: a failure here is
      // logged but must not report the (already completed) change as failed.
      try {
        await onApplied?.(change);
      } catch (error) {
        console.error('Failed to refresh after save directory change:', error);
      }

      setIsApplying(false);
      return 'applied';
    },
    [onApplied],
  );

  const requestChange = useCallback(
    async (change: SaveDirectoryChangeRequest): Promise<SaveDirectoryChangeOutcome> => {
      const resolvedDirectory = await resolveCurrentDirectory(currentDirectory);
      const isSameDirectory =
        resolvedDirectory !== undefined &&
        normalizeDirectoryForComparison(resolvedDirectory) ===
          normalizeDirectoryForComparison(change.directory);

      if (isSameDirectory) {
        return 'unchanged';
      }

      const existingData = await countExistingUserData();
      if (hasExistingUserData(existingData)) {
        // Require explicit confirmation before wiping existing progress
        setPendingChange({ ...change, currentDirectory: resolvedDirectory, existingData });
        return 'confirmationRequired';
      }

      return applyChange(change);
    },
    [applyChange, currentDirectory],
  );

  const confirmPendingChange = useCallback(async (): Promise<SaveDirectoryChangeOutcome> => {
    if (!pendingChange) {
      return 'failed';
    }
    const outcome = await applyChange({
      action: pendingChange.action,
      directory: pendingChange.directory,
    });
    setPendingChange(undefined);
    return outcome;
  }, [applyChange, pendingChange]);

  const cancelPendingChange = useCallback(() => {
    if (!isApplying) {
      setPendingChange(undefined);
    }
  }, [isApplying]);

  return { pendingChange, isApplying, requestChange, confirmPendingChange, cancelPendingChange };
}
