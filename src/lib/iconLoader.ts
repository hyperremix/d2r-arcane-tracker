/** Icons that were found, by filename. Shared by all components for the lifetime of the window. */
const foundIcons = new Map<string, string>();
/** Filenames the main process reported as missing; forgotten once the sprites are converted. */
const missingIcons = new Set<string>();
/** Requests that are still running, so concurrent callers share one IPC call per filename. */
const pendingRequests = new Map<string, Promise<string | undefined>>();
/**
 * Incremented whenever the missing icons are forgotten. A request that started in an older
 * generation must not mark its filename as missing, since its answer may predate the conversion.
 */
let generation = 0;

/**
 * Returns the icon for a filename if it was loaded before.
 * @param filename - Filename of the converted icon
 * @returns The icon URL, or undefined if it was not loaded (yet) or does not exist
 */
export function getCachedIcon(filename: string): string | undefined {
  return foundIcons.get(filename);
}

/**
 * Whether the icon for a filename is known to be missing, so loading it again would not find it.
 * @param filename - Filename of the converted icon
 */
export function isIconMissing(filename: string): boolean {
  return missingIcons.has(filename);
}

/**
 * Whether loading a filename would be answered from the cache, without an IPC call.
 * @param filename - Filename of the converted icon
 */
export function isIconSettled(filename: string): boolean {
  return foundIcons.has(filename) || missingIcons.has(filename);
}

/**
 * Asks the main process for an icon and remembers whether it was found. Never rejects.
 * @param filename - Filename of the converted icon
 */
async function requestIcon(filename: string): Promise<string | undefined> {
  const startedInGeneration = generation;
  try {
    const iconUrl = (await window.electronAPI?.icon.getByFilename(filename)) ?? undefined;
    if (iconUrl) {
      foundIcons.set(filename, iconUrl);
    } else if (startedInGeneration === generation) {
      missingIcons.add(filename);
    }
    return iconUrl;
  } catch (error) {
    console.error(`Failed to load icon ${filename}:`, error);
    return undefined;
  }
}

/**
 * Loads an icon by its filename, reusing a cached result or a request that is already running.
 * Failed requests are not cached, so they are retried by the next caller.
 * @param filename - Filename of the converted icon
 * @returns The icon URL, or undefined if there is none or loading failed
 */
export function loadIconByFilename(filename: string): Promise<string | undefined> {
  const cached = foundIcons.get(filename);
  if (cached) {
    return Promise.resolve(cached);
  }
  if (missingIcons.has(filename)) {
    return Promise.resolve(undefined);
  }
  const pending = pendingRequests.get(filename);
  if (pending) {
    return pending;
  }

  const request = requestIcon(filename).finally(() => {
    // After forgetMissingIcons() a newer request may own the entry
    if (pendingRequests.get(filename) === request) {
      pendingRequests.delete(filename);
    }
  });
  pendingRequests.set(filename, request);
  return request;
}

/**
 * Loads the first icon that exists out of several filename candidates, trying them in order.
 * @param filenames - Filename candidates, most preferred first
 * @returns The first found icon URL, or undefined if none of the candidates exists
 */
export async function loadFirstIcon(filenames: readonly string[]): Promise<string | undefined> {
  for (const filename of filenames) {
    const iconUrl = await loadIconByFilename(filename);
    if (iconUrl) {
      return iconUrl;
    }
  }
  return undefined;
}

/**
 * Forgets which icons were missing, so they are requested again. Call this after converting the
 * sprites, since icons that did not exist before may exist now.
 */
export function forgetMissingIcons(): void {
  generation += 1;
  missingIcons.clear();
  // Requests that are still running may have started before the conversion finished, so new
  // callers must not share them
  pendingRequests.clear();
}

/**
 * Clears the shared icon cache. Only intended for tests, which share this module state.
 */
export function clearIconCache(): void {
  generation += 1;
  foundIcons.clear();
  missingIcons.clear();
  pendingRequests.clear();
}
