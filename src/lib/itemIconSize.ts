import type { ItemIconSize, Settings } from 'electron/types/grail';

/**
 * Edge length in pixels of an item icon on the grail page, per size preset and view mode.
 */
export const ITEM_ICON_PIXELS: Record<ItemIconSize, { grid: number; list: number }> = {
  default: { grid: 40, list: 48 },
  large: { grid: 56, list: 64 },
  extraLarge: { grid: 72, list: 80 },
};

/**
 * Gets the icon size preset the grail page uses. The preset only applies while item icons are
 * shown; without icons the cards keep their default size.
 * @param settings - The current settings
 * @returns The size preset of the grail page's item icons
 */
export function getGrailItemIconSize(
  settings: Pick<Settings, 'showItemIcons' | 'itemIconSize'>,
): ItemIconSize {
  return settings.showItemIcons ? (settings.itemIconSize ?? 'default') : 'default';
}
