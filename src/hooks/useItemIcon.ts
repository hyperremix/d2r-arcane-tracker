import type { Item } from 'electron/types/grail';
import { useMemo } from 'react';
import { useGrailStore } from '@/stores/grailStore';
import { useFirstAvailableIcon } from './useFirstAvailableIcon';

/**
 * Custom hook to load and cache item icons.
 * Loads icons from converted PNG directory using imageFilename.
 * @param item - The item object containing name and imageFilename
 * @returns Object containing the icon URL and loading state
 */
export function useItemIcon(item: Item) {
  // Narrow selector: this hook runs in every item card, so it must not re-render on unrelated store updates
  const iconsEnabled = useGrailStore((state) => state.settings.showItemIcons);
  const imageFilename = item.imageFilename;
  const candidates = useMemo(() => (imageFilename ? [imageFilename] : []), [imageFilename]);

  return useFirstAvailableIcon(candidates, iconsEnabled);
}
