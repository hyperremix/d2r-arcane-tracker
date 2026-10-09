import { findD2RProcess } from './d2rProcess';
import type { ProcessMonitor } from './processMonitor';

export const GAME_RUNNING_ERROR = 'GAME_RUNNING';

/** Options of the game process guard. */
export interface GameProcessGuardOptions {
  /** The process monitor; while it is monitoring, its state is used instead of a new lookup. */
  processMonitor?: Pick<ProcessMonitor, 'isMonitoring' | 'isRunning'>;
  /** Looks up the D2R process when the monitor is not monitoring. Defaults to `tasklist`. */
  findProcess?: () => Promise<number | null>;
  /** Platform override for tests. Defaults to `process.platform`. */
  platform?: NodeJS.Platform;
}

/**
 * True while Diablo II: Resurrected is running. The game keeps the character in memory and writes
 * it back over the save file when it saves or exits, which would silently undo (or duplicate) any
 * edit made to the file in the meantime. Detection is only available on Windows; if it cannot be
 * performed the answer is `false` so a broken `tasklist` never blocks the user for good.
 */
async function isGameRunning({
  processMonitor,
  findProcess = findD2RProcess,
  platform = process.platform,
}: GameProcessGuardOptions): Promise<boolean> {
  if (platform !== 'win32') {
    return false;
  }

  if (processMonitor?.isMonitoring()) {
    return processMonitor.isRunning();
  }

  try {
    return (await findProcess()) !== null;
  } catch (error) {
    console.warn('[gameProcessGuard] Could not determine whether the game is running', error);
    return false;
  }
}

/**
 * Creates the check that refuses save file edits while the game is running.
 * @param options - The process monitor whose state is used, and lookup overrides
 * @returns Function that rejects with {@link GAME_RUNNING_ERROR} while the game is running
 */
export function createGameProcessGuard(options: GameProcessGuardOptions = {}): () => Promise<void> {
  return async () => {
    if (await isGameRunning(options)) {
      throw new Error(GAME_RUNNING_ERROR);
    }
  };
}
