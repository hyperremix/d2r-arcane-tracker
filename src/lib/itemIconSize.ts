import type { ItemIconSize, Settings } from 'electron/types/grail';

/**
 * Edge length in pixels of an item icon on the grail page, per size preset and view mode.
 * `missingGrid` is the smaller icon of the compact grid tile of a missing item.
 */
export const ITEM_ICON_PIXELS: Record<
  ItemIconSize,
  { grid: number; missingGrid: number; list: number }
> = {
  default: { grid: 40, missingGrid: 16, list: 48 },
  large: { grid: 80, missingGrid: 32, list: 96 },
  extraLarge: { grid: 120, missingGrid: 48, list: 144 },
};

/**
 * Height in pixels of a list row beyond its icon: the card's padding (24px), border (2px) and the
 * 6px gap to the next row.
 */
const LIST_ROW_CHROME_HEIGHT = 32;

/**
 * Gets the height of a list row with an item icon: the icon plus the row's padding, border and gap
 * (80px with the default icon). The list virtualizer uses it as the row height.
 * @param iconSize - The size preset of the item icons
 * @returns The height of a list row in pixels
 */
export function getListRowHeightEstimate(iconSize: ItemIconSize): number {
  return ITEM_ICON_PIXELS[iconSize].list + LIST_ROW_CHROME_HEIGHT;
}

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
