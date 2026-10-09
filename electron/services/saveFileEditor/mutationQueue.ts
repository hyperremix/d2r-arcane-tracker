import { ensureD2sConstants } from '../d2s/constants';

/**
 * Runs save file mutations one at a time.
 *
 * Every public mutation of the editor reads a save file, edits it in memory and writes it back. Two
 * of those running at once on the same file would let the second overwrite the first, silently
 * dropping an item, so all mutations run one at a time.
 */

let saveFileMutationQueue: Promise<unknown> = Promise.resolve();

export function runExclusively<T>(operation: () => Promise<T>): Promise<T> {
  ensureD2sConstants();
  const run = saveFileMutationQueue.then(operation, operation);
  saveFileMutationQueue = run.catch(() => undefined);
  return run;
}
