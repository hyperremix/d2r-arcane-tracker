import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const GAME_PROCESS_NAME = 'D2R.exe';

export const GAME_RUNNING_ERROR = 'GAME_RUNNING';

/**
 * True while Diablo II: Resurrected is running. The game keeps the character in memory and writes
 * it back over the save file when it saves or exits, which would silently undo (or duplicate) any
 * edit made to the file in the meantime. Detection is only available on Windows; if it cannot be
 * performed the answer is `false` so a broken `tasklist` never blocks the user for good.
 */
async function isGameRunning(): Promise<boolean> {
  if (process.platform !== 'win32') {
    return false;
  }

  try {
    const { stdout } = await execFileAsync('tasklist', [
      '/FI',
      `IMAGENAME eq ${GAME_PROCESS_NAME}`,
      '/FO',
      'CSV',
      '/NH',
    ]);
    return stdout.toLowerCase().includes(GAME_PROCESS_NAME.toLowerCase());
  } catch (error) {
    console.warn('[gameProcessGuard] Could not determine whether the game is running', error);
    return false;
  }
}

export async function assertGameNotRunning(): Promise<void> {
  if (await isGameRunning()) {
    throw new Error(GAME_RUNNING_ERROR);
  }
}
