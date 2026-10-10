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
 * Returns the name classes of a grail card. The grail is a collection wall: a found item's name
 * lights up in its quality color, a missing item's name stays in the muted neutral text color.
 * Found names are also heavier, so the two states differ without relying on hue alone.
 */
export function getItemNameClasses(itemType: ItemType, isFound: boolean): string {
  return isFound
    ? `font-semibold ${getItemQualityTextClass(itemType)}`
    : 'font-medium text-muted-foreground';
}

/**
 * Quality accents of a found ("lit") card: a quality-colored hairline border, which turns solid
 * on hover for clickable cards. Missing cards use the neutral border instead.
 */
const foundFrameStyles: Record<ItemType, { border: string; hover: string }> = {
  unique: { border: 'border-item-unique/60', hover: 'hover:border-item-unique' },
  set: { border: 'border-item-set/60', hover: 'hover:border-item-set' },
  rune: { border: 'border-item-rune/60', hover: 'hover:border-item-rune' },
  runeword: { border: 'border-item-runeword/60', hover: 'hover:border-item-runeword' },
};

/**
 * Card surface styles depending on whether the item has been found.
 * - Found: card surface with a quality-colored hairline border and a subtle elevation.
 * - Missing: muted neutral surface with a neutral hairline border, so the card recedes.
 * Opacity is never applied to the whole card so text keeps full contrast.
 */
const foundStateStyles = {
  found: 'bg-card shadow-sm',
  missing: 'border-border bg-muted/40 shadow-none dark:bg-muted/20',
} as const;

/**
 * Transition for the hover state. Only paint properties are animated, and only when the user
 * has not asked for reduced motion.
 */
const cardTransitionStyles =
  'motion-safe:transition-[box-shadow,border-color,background-color] motion-safe:duration-200';

/**
 * Returns the frame, surface and, for interactive cards only, hover classes for an item card.
 * Non-interactive cards (for example the statistics "last find" card) get no hover affordance,
 * so they do not look clickable.
 */
export function getCardStateClasses(
  itemType: ItemType,
  isFound: boolean,
  isInteractive = false,
): string {
  const frame = foundFrameStyles[itemType];
  const classes: string[] = [];
  if (isFound) {
    classes.push(frame.border, foundStateStyles.found);
  } else {
    classes.push(foundStateStyles.missing);
  }
  if (isInteractive) {
    if (isFound) {
      classes.push(frame.hover, 'hover:shadow-md');
    } else {
      classes.push('hover:border-muted-foreground/50');
    }
    classes.push(cardTransitionStyles);
  }
  return classes.join(' ');
}

/**
 * Pill classes for a version (normal / ethereal) that has been found: lit in the item's quality
 * color with a solid border. The quality text colors keep AA contrast on the faint tint.
 */
const foundVersionPillClasses: Record<ItemType, string> = {
  unique: 'border-item-unique/50 bg-item-unique/10 text-item-unique',
  set: 'border-item-set/50 bg-item-set/10 text-item-set',
  rune: 'border-item-rune/50 bg-item-rune/10 text-item-rune',
  runeword: 'border-item-runeword/50 bg-item-runeword/10 text-item-runeword',
};

/**
 * Returns the classes of a version pill: solid and quality-colored when the version is found,
 * dashed, neutral and transparent when it is still missing. The border style is the non-color
 * cue that tells the two states apart.
 */
export function getVersionPillClasses(itemType: ItemType, isFound: boolean): string {
  if (!isFound) return 'border-dashed border-muted-foreground/50 text-muted-foreground';
  return `border-solid ${foundVersionPillClasses[itemType]}`;
}

/**
 * Styles applied to the item artwork (icon or rune images) of missing items.
 */
export const missingArtworkStyles = 'opacity-40 grayscale';

/**
 * Focus and interaction styles shared by the clickable grid and list cards.
 */
export const interactiveCardStyles =
  'cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
