import { getPathBasename, stripKnownImageExtension } from 'electron/utils/iconFilename';
import { useMemo } from 'react';
import { useGrailStore } from '@/stores/grailStore';
import { useFirstAvailableIcon } from './useFirstAvailableIcon';

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

export function useSpriteIcon(iconFileName?: IconFilenameInput, options?: UseSpriteIconOptions) {
  // Rendered by every item tile, so only subscribe to the one setting that matters here
  const showItemIcons = useGrailStore((state) => state.settings.showItemIcons);
  const iconsEnabled = options?.forceEnabled ?? showItemIcons;

  const filenameCandidates = useMemo(() => normalizeCandidates(iconFileName), [iconFileName]);
  const { iconUrl, isLoading } = useFirstAvailableIcon(filenameCandidates, iconsEnabled);

  return {
    iconUrl,
    isLoading,
    iconsEnabled,
  };
}
