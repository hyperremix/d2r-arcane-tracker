import { useEffect, useState } from 'react';
import { getCachedIcon, isIconSettled, loadIconByFilename } from '@/lib/iconLoader';

const toCachedIcons = (filenames: readonly string[]): ReadonlyMap<string, string> => {
  const icons = new Map<string, string>();
  for (const filename of filenames) {
    const iconUrl = getCachedIcon(filename);
    if (iconUrl) {
      icons.set(filename, iconUrl);
    }
  }
  return icons;
};

const areAllCached = (filenames: readonly string[]): boolean => filenames.every(isIconSettled);

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
