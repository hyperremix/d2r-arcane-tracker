import type { ItemType } from 'electron/types/grail';

/**
 * Border color mapping for different item types, for found and missing items.
 * Item type is conveyed by the border color and the type icon only; the card background
 * stays neutral so that text keeps full contrast.
 */
const typeBorderColors: Record<ItemType, { found: string; missing: string }> = {
  unique: {
    found: 'border-item-unique',
    missing: 'border-item-unique/60',
  },
  set: {
    found: 'border-item-set',
    missing: 'border-item-set/60',
  },
  rune: {
    found: 'border-item-rune',
    missing: 'border-item-rune/60',
  },
  runeword: {
    found: 'border-item-runeword',
    missing: 'border-item-runeword/60',
  },
};

/**
 * Card surface styles depending on whether the item has been found.
 * - Found: neutral card surface with a solid type border and a subtle elevation.
 * - Missing: muted neutral surface with a dashed, softened type border.
 * Opacity is never applied to the whole card so the item name keeps full text contrast.
 */
const foundStateStyles = {
  found: 'border-solid bg-card shadow-sm',
  missing: 'border-dashed bg-muted/40 shadow-none dark:bg-muted/20',
} as const;

/**
 * Returns the border and surface classes for an item card.
 */
export function getCardStateClasses(itemType: ItemType, isFound: boolean): string {
  const state = isFound ? 'found' : 'missing';
  return `${typeBorderColors[itemType]?.[state] ?? 'border-border'} ${foundStateStyles[state]}`;
}

/**
 * Styles applied to the item artwork (icon or rune images) of missing items.
 */
export const missingArtworkStyles = 'opacity-50 grayscale';

/**
 * Focus and interaction styles shared by the clickable grid and list cards.
 */
export const interactiveCardStyles =
  'cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
