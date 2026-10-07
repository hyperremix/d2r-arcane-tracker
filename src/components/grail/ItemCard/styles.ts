import type { ItemType } from 'electron/types/grail';

/**
 * Text color classes for item names. As in Diablo II, the name color is the quality signal
 * (unique gold, set green, rune orange, runeword purple). The `--item-*` tokens are tuned to
 * keep WCAG AA contrast on card, muted and background surfaces in both themes.
 */
const itemQualityTextClasses: Record<ItemType, string> = {
  unique: 'text-item-unique',
  set: 'text-item-set',
  rune: 'text-item-rune',
  runeword: 'text-item-runeword',
};

/**
 * Returns the quality text color class for an item name, falling back to the foreground color
 * for unknown item types.
 */
export function getItemQualityTextClass(itemType: ItemType): string {
  return itemQualityTextClasses[itemType] ?? 'text-foreground';
}

/**
 * Frame classes per item type:
 * - found: solid quality border plus a faint inner quality line, like a D2 item frame.
 * - missing: softened quality border (combined with a dashed style below).
 * - hover: a quality-tinted ring and shadow glow; neither affects layout, so cards never
 *   overlap their grid gutters.
 * Item type is conveyed by the frame, the type icon and the name color; the card background
 * stays neutral so that text keeps full contrast.
 */
const typeFrameStyles: Record<ItemType, { found: string; missing: string; hover: string }> = {
  unique: {
    found: 'border-item-unique inset-ring-1 inset-ring-item-unique/25',
    missing: 'border-item-unique/60',
    hover: 'hover:ring-2 hover:ring-item-unique/40',
  },
  set: {
    found: 'border-item-set inset-ring-1 inset-ring-item-set/25',
    missing: 'border-item-set/60',
    hover: 'hover:ring-2 hover:ring-item-set/40',
  },
  rune: {
    found: 'border-item-rune inset-ring-1 inset-ring-item-rune/25',
    missing: 'border-item-rune/60',
    hover: 'hover:ring-2 hover:ring-item-rune/40',
  },
  runeword: {
    found: 'border-item-runeword inset-ring-1 inset-ring-item-runeword/25',
    missing: 'border-item-runeword/60',
    hover: 'hover:ring-2 hover:ring-item-runeword/40',
  },
};

/**
 * Card surface styles depending on whether the item has been found.
 * - Found: neutral card surface with a solid type frame and a subtle elevation.
 * - Missing: muted neutral surface with a dashed, softened type border.
 * Opacity is never applied to the whole card so the item name keeps full text contrast.
 */
const foundStateStyles = {
  found: 'border-solid bg-card shadow-sm hover:shadow-md',
  missing: 'border-dashed bg-muted/40 shadow-none dark:bg-muted/20',
} as const;

/**
 * Transition for the hover glow. Only paint properties are animated, and only when the user
 * has not asked for reduced motion.
 */
const cardTransitionStyles =
  'motion-safe:transition-[box-shadow,border-color,background-color] motion-safe:duration-200';

/**
 * Returns the frame, surface and hover classes for an item card.
 */
export function getCardStateClasses(itemType: ItemType, isFound: boolean): string {
  const state = isFound ? 'found' : 'missing';
  const frame = typeFrameStyles[itemType];
  const frameClasses = frame ? `${frame[state]} ${frame.hover}` : 'border-border';
  return `${frameClasses} ${foundStateStyles[state]} ${cardTransitionStyles}`;
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
