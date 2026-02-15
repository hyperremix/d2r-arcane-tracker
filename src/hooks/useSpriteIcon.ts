import { useEffect, useMemo, useState } from 'react';
import { useGrailStore } from '@/stores/grailStore';
import placeholderUrl from '/images/placeholder-item.png';

const iconCache = new Map<string, string>();
const PLACEHOLDER_ICON_URL = placeholderUrl;
type IconFilenameInput = string | string[];

type UseSpriteIconOptions = {
  forceEnabled?: boolean;
};

function basename(input: string): string {
  const segments = input.split(/[\\/]/);
  return segments[segments.length - 1] ?? input;
}

function withPngExtension(input: string): string {
  return input.toLowerCase().endsWith('.png') ? input : `${input}.png`;
}

function stripImageExtension(input: string): string {
  return input.replace(/\.(png|sprite|dc6|dds|jpg|jpeg|webp)$/i, '');
}

function normalizeSingleFilename(filename: string): string[] {
  const trimmed = filename.trim();
  if (!trimmed) {
    return [];
  }

  const base = basename(trimmed);
  const withoutExtension = stripImageExtension(base);
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
  const { settings } = useGrailStore();
  const iconsEnabled = options?.forceEnabled ?? settings.showItemIcons;

  const filenameCandidates = useMemo(() => normalizeCandidates(iconFileName), [iconFileName]);
  const cacheKey = filenameCandidates[0] ?? '';

  const cachedIcon = getCachedIconForCandidates(filenameCandidates);
  const [iconUrl, setIconUrl] = useState(cachedIcon ?? PLACEHOLDER_ICON_URL);
  const [isLoading, setIsLoading] = useState(
    Boolean(iconsEnabled && filenameCandidates.length > 0 && cachedIcon === undefined),
  );

  useEffect(() => {
    if (!iconsEnabled || !cacheKey) {
      setIconUrl(PLACEHOLDER_ICON_URL);
      setIsLoading(false);
      return;
    }

    const cached = getCachedIconForCandidates(filenameCandidates);
    if (cached) {
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
