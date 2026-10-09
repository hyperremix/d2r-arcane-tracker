import { useEffect, useState } from 'react';
import { getCachedIcon, isIconMissing, loadFirstIcon } from '@/lib/iconLoader';
import placeholderUrl from '/images/placeholder-item.svg';

export const PLACEHOLDER_ICON_URL = placeholderUrl;

/**
 * Answers from the shared icon cache: the first cached icon of the candidates, the placeholder if
 * all candidates are known to be missing, or undefined if some candidate still has to be loaded.
 */
function resolveFromCache(candidates: readonly string[]): string | undefined {
  let allMissing = true;
  for (const candidate of candidates) {
    const iconUrl = getCachedIcon(candidate);
    if (iconUrl) {
      return iconUrl;
    }
    if (!isIconMissing(candidate)) {
      allMissing = false;
    }
  }
  return allMissing ? PLACEHOLDER_ICON_URL : undefined;
}

interface LoadedIcon {
  /** Candidates the icon was loaded for, joined into one string. */
  key: string;
  iconUrl: string;
}

/**
 * Loads the first existing icon out of several filename candidates, using the shared icon cache.
 * @param candidates - Filename candidates, most preferred first
 * @param enabled - Whether icons should be loaded at all; otherwise the placeholder is returned
 * @returns The icon URL (the placeholder while loading or if none exists) and the loading state
 */
export function useFirstAvailableIcon(
  candidates: readonly string[],
  enabled: boolean,
): { iconUrl: string; isLoading: boolean } {
  // A string key keeps the effect stable when callers pass a new array with the same candidates
  const key = candidates.join('\n');
  const [loaded, setLoaded] = useState<LoadedIcon | undefined>(undefined);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const requested = key === '' ? [] : key.split('\n');
    if (resolveFromCache(requested) !== undefined) {
      return;
    }

    let cancelled = false;
    void loadFirstIcon(requested).then((iconUrl) => {
      if (!cancelled) {
        setLoaded({ key, iconUrl: iconUrl ?? PLACEHOLDER_ICON_URL });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, key]);

  if (!enabled) {
    return { iconUrl: PLACEHOLDER_ICON_URL, isLoading: false };
  }
  const cached = resolveFromCache(candidates);
  if (cached !== undefined) {
    return { iconUrl: cached, isLoading: false };
  }
  if (loaded?.key === key) {
    return { iconUrl: loaded.iconUrl, isLoading: false };
  }
  return { iconUrl: PLACEHOLDER_ICON_URL, isLoading: true };
}
