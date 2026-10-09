import { basename } from 'node:path';
import type { FSWatcher } from 'chokidar';
import chokidar from 'chokidar';
import { createServiceLogger } from '../../utils/serviceLogger';
import type { WatcherIntervals } from './saveDirectorySettings';
import { shouldIncludeSaveFile } from './saveFileFormat';

const log = createServiceLogger('SaveFileMonitor');

/**
 * Use polling mode for better compatibility with D2R (which uses atomic file writes).
 * Polling checks files periodically instead of relying on file system events.
 */
export const SAVE_WATCHER_USES_POLLING = true;

/**
 * Watches the save files of a directory and calls `onChange` for every file system event.
 * The caller owns the returned watcher and must close it.
 */
export function watchSaveDirectory(
  directory: string,
  { pollingInterval, stabilityThreshold }: WatcherIntervals,
  onChange: () => void,
): FSWatcher {
  const usePolling = SAVE_WATCHER_USES_POLLING;

  const watcher: FSWatcher = chokidar
    .watch(directory, {
      // Only watch files with save file extensions
      ignored: (path, stats) => !!stats?.isFile() && !shouldIncludeSaveFile(basename(path)),
      followSymlinks: false,
      ignoreInitial: true,
      depth: 0,
      usePolling: usePolling, // Polling is more reliable for games like D2R that use atomic writes
      interval: pollingInterval,
      awaitWriteFinish: {
        stabilityThreshold: stabilityThreshold,
        pollInterval: 100,
      },
    })
    .on('all', (event, path) => {
      log.info('chokidar', `Event: ${event} on ${path}`);
      onChange();
    })
    .on('error', (error) => log.error('chokidar', error))
    .on('ready', () => {
      log.info('chokidar', 'File watcher ready');
      const watched = watcher.getWatched();
      if (watched) {
        log.info('chokidar', `Watching paths: ${Object.keys(watched).join(', ')}`);
        log.info(
          'chokidar',
          `Total files being watched: ${Object.values(watched).reduce((sum, files) => sum + files.length, 0)}`,
        );
      }
    })
    .on('add', (path) => log.info('chokidar', `File added: ${path}`))
    .on('change', (path) => log.info('chokidar', `File changed: ${path}`))
    .on('unlink', (path) => log.info('chokidar', `File removed: ${path}`));

  return watcher;
}
