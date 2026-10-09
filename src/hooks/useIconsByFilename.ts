import { useEffect, useState } from 'react';

/** Icons that were found, by filename. Shared by all components for the lifetime of the window. */
const iconCache = new Map<string, string>();
/** Requests that are still running, so concurrent callers share one IPC call per filename. */
const pendingRequests = new Map<string, Promise<string | undefined>>();

/**
 * Loads an icon by its filename, reusing a cached result or a request that is already running.
 * Only found icons are cached: a missing icon may appear once the sprites have been converted.
 * @param filename - Filename of the converted icon
 * @returns The icon URL, or undefined if there is none or loading failed
 */
export function loadIconByFilename(filename: string): Promise<string | undefined> {
  const cached = iconCache.get(filename);
  if (cached) {
    return Promise.resolve(cached);
  }
  const pending = pendingRequests.get(filename);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    try {
      const iconUrl = (await window.electronAPI?.icon.getByFilename(filename)) ?? undefined;
      if (iconUrl) {
        iconCache.set(filename, iconUrl);
      }
      return iconUrl;
    } catch (error) {
      console.error(`Failed to load icon ${filename}:`, error);
      return undefined;
    } finally {
      pendingRequests.delete(filename);
    }
  })();
  pendingRequests.set(filename, request);
  return request;
}

/**
 * Clears the shared icon cache. Only intended for tests, which share this module state.
 */
export function clearIconCache(): void {
  iconCache.clear();
  pendingRequests.clear();
}

const toCachedIcons = (filenames: readonly string[]): ReadonlyMap<string, string> => {
  const icons = new Map<string, string>();
  for (const filename of filenames) {
    const iconUrl = iconCache.get(filename);
    if (iconUrl) {
      icons.set(filename, iconUrl);
    }
  }
  return icons;
};

const areAllCached = (filenames: readonly string[]): boolean =>
  filenames.every((filename) => iconCache.has(filename));

interface IconsState {
  /** Filenames the state was loaded for, joined into one string. */
  key: string;
  icons: ReadonlyMap<string, string>;
  isLoading: boolean;
}

/**
 * Loads icons by filename in parallel. Icons are cached for all components, and requests for the
 * same filename are shared, so lists rendering the same icons (e.g. the runes of every runeword
 * card) only load each icon once.
 * @param filenames - Filenames of the converted icons
 * @returns The found icons by filename, and whether any of them is still loading
 */
export function useIconsByFilename(filenames: readonly string[]): {
  icons: ReadonlyMap<string, string>;
  isLoading: boolean;
} {
  // A string key keeps the effect stable when callers pass a new array with the same filenames
  const key = filenames.join('\n');
  const [state, setState] = useState<IconsState>(() => ({
    key,
    icons: toCachedIcons(filenames),
    isLoading: !areAllCached(filenames),
  }));

  useEffect(() => {
    const requested = key === '' ? [] : key.split('\n');
    if (areAllCached(requested)) {
      setState((previous) =>
        previous.key === key && !previous.isLoading
          ? previous
          : { key, icons: toCachedIcons(requested), isLoading: false },
      );
      return;
    }

    let cancelled = false;
    void Promise.all([...new Set(requested)].map(loadIconByFilename)).then(() => {
      if (!cancelled) {
        setState({ key, icons: toCachedIcons(requested), isLoading: false });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  // Until the effect has run for new filenames, answer from the cache
  if (state.key !== key) {
    return { icons: toCachedIcons(filenames), isLoading: !areAllCached(filenames) };
  }
  return state;
}
