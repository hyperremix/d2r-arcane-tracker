import { getPathBasename, stripKnownImageExtension } from 'electron/utils/iconFilename';
import { useEffect, useMemo, useState } from 'react';
import { useGrailStore } from '@/stores/grailStore';
import placeholderUrl from '/images/placeholder-item.svg';

const iconCache = new Map<string, string>();
const PLACEHOLDER_ICON_URL = placeholderUrl;
type IconFilenameInput = string | string[];

interface UseSpriteIconOptions {
  forceEnabled?: boolean;
}

function withPngExtension(input: string): string {
  return input.toLowerCase().endsWith('.png') ? input : `${input}.png`;
}

function normalizeSingleFilename(filename: string): string[] {
  const trimmed = filename.trim();
  if (!trimmed) {
    return [];
  }

  const base = getPathBasename(trimmed);
  const withoutExtension = stripKnownImageExtension(base);
  const values = [trimmed, base, withoutExtension, trimmed.toLowerCase(), base.toLowerCase()];
  const candidates = values.flatMap((value) => [value, withPngExtension(value)]);

  return [...new Set(candidates.map((value) => value.trim()).filter(Boolean))];
}

function normalizeCandidates(iconFileName?: IconFilenameInput): string[] {
  if (!iconFileName) {
    return [];
  }

  const inputs = Array.isArray(iconFileName) ? iconFileName : [iconFileName];
  const candidates = inputs.flatMap((filename) =>
    typeof filename === 'string' ? normalizeSingleFilename(filename) : [],
  );

  return [...new Set(candidates)];
}

function getCachedIconForCandidates(candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    const cached = iconCache.get(candidate);
    if (cached) {
      return cached;
    }
  }

  return undefined;
}

function hasUncachedCandidates(candidates: string[]): boolean {
  return candidates.some((candidate) => !iconCache.has(candidate));
}

function cacheIconForCandidates(candidates: string[], iconUrl: string): void {
  for (const candidate of candidates) {
    iconCache.set(candidate, iconUrl);
  }
}

async function resolveIconFromCandidates(candidates: string[]): Promise<string> {
  for (const candidate of candidates) {
    const response = await window.electronAPI?.icon?.getByFilename?.(candidate);
    if (response) {
      return response;
    }
  }

  return PLACEHOLDER_ICON_URL;
}

export function useSpriteIcon(iconFileName?: IconFilenameInput, options?: UseSpriteIconOptions) {
  // Rendered by every item tile, so only subscribe to the one setting that matters here
  const showItemIcons = useGrailStore((state) => state.settings.showItemIcons);
  const iconsEnabled = options?.forceEnabled ?? showItemIcons;

  const filenameCandidates = useMemo(() => normalizeCandidates(iconFileName), [iconFileName]);
  const cacheKey = filenameCandidates[0] ?? '';

  const cachedIcon = getCachedIconForCandidates(filenameCandidates);
  const shouldResolveFromCandidates =
    cachedIcon === undefined ||
    (cachedIcon === PLACEHOLDER_ICON_URL && hasUncachedCandidates(filenameCandidates));
  const [iconUrl, setIconUrl] = useState(cachedIcon ?? PLACEHOLDER_ICON_URL);
  const [isLoading, setIsLoading] = useState(
    Boolean(iconsEnabled && filenameCandidates.length > 0 && shouldResolveFromCandidates),
  );

  useEffect(() => {
    if (!iconsEnabled || !cacheKey) {
      setIconUrl(PLACEHOLDER_ICON_URL);
      setIsLoading(false);
      return;
    }

    const cached = getCachedIconForCandidates(filenameCandidates);
    const canUseCached =
      cached !== undefined &&
      (cached !== PLACEHOLDER_ICON_URL || !hasUncachedCandidates(filenameCandidates));
    if (canUseCached && cached !== undefined) {
      setIconUrl(cached);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void resolveIconFromCandidates(filenameCandidates)
      .then((resolvedIcon) => {
        if (cancelled) {
          return;
        }

        cacheIconForCandidates(filenameCandidates, resolvedIcon);
        setIconUrl(resolvedIcon);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        cacheIconForCandidates(filenameCandidates, PLACEHOLDER_ICON_URL);
        setIconUrl(PLACEHOLDER_ICON_URL);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, filenameCandidates, iconsEnabled]);

  return {
    iconUrl,
    isLoading,
    iconsEnabled,
  };
}
