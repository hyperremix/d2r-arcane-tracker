import { useCallback, useState } from 'react';
import type { SaveDirectoryChangeAction } from '@/components/settings/SaveDirectoryChangeDialog';

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
  /** The directory currently being monitored, if known. */
  currentDirectory: string | undefined;
  /** Called after a change has been applied, e.g. to reload data. Failures are logged only. */
  onApplied?: (change: SaveDirectoryChangeRequest) => Promise<void> | void;
}

/**
 * State and actions returned by {@link useSaveDirectoryChange}.
 */
export interface SaveDirectoryChangeState {
  /** The change awaiting user confirmation, if any. */
  pendingChange: SaveDirectoryChangeRequest | undefined;
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
 * Checks whether the database currently holds characters or grail progress.
 * If the check fails, existing data is assumed so the user is asked to confirm.
 * @returns {Promise<boolean>} True if any user data exists (or it cannot be determined)
 */
async function hasExistingUserData(): Promise<boolean> {
  try {
    const [characters, progress] = await Promise.all([
      window.electronAPI?.grail.getCharacters(),
      window.electronAPI?.grail.getProgress(),
    ]);
    return (characters?.length ?? 0) > 0 || (progress?.length ?? 0) > 0;
  } catch (error) {
    console.error('Failed to check for existing user data:', error);
    return true;
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
  const [pendingChange, setPendingChange] = useState<SaveDirectoryChangeRequest | undefined>(
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
      const isSameDirectory =
        currentDirectory !== undefined &&
        currentDirectory.trim() !== '' &&
        normalizeDirectoryForComparison(currentDirectory) ===
          normalizeDirectoryForComparison(change.directory);

      if (isSameDirectory) {
        return 'unchanged';
      }

      if (await hasExistingUserData()) {
        // Require explicit confirmation before wiping existing progress
        setPendingChange(change);
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
    const outcome = await applyChange(pendingChange);
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
