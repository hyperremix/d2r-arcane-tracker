import { normalizeItemCodeKey } from '../utils/d2rFormat';

/**
 * HD inventory sprites of base items whose uniques and set items use a different sprite, keyed by
 * item code. The values are the sprite names of `Data/hd/items/items.json` as converted PNGs.
 *
 * Without this map, a normal, magic or rare item of these bases would show the sprite of the first
 * catalog item with the same code (for example a Burnt Text would show Measured Wrath), and bases
 * without a catalog item would show no icon at all.
 */
const baseItemIconFilenameByCode: ReadonlyMap<string, string> = new Map([
  // Warlock grimoires: normal, exceptional and elite tiers
  ['wa1', 'oldbook.png'],
  ['wa2', 'tome_book.png'],
  ['wa3', 'codex.png'],
  ['wa4', 'compendium.png'],
  ['wa5', 'grimoire.png'],
  ['wa6', 'oldbook.png'],
  ['wa7', 'tome_book.png'],
  ['wa8', 'codex.png'],
  ['wa9', 'compendium.png'],
  ['waa', 'grimoire.png'],
  ['wab', 'oldbook.png'],
  ['wac', 'tome_book.png'],
  ['wad', 'codex.png'],
  ['wae', 'compendium.png'],
  ['waf', 'grimoire.png'],
  // Colossal Jewel
  ['cjw', 'perfect_diamond.png'],
]);

/** Returns the base item sprite for an item code from the map above, or undefined. */
export function resolveBaseItemIconFilename(code: unknown): string | undefined {
  const codeKey = normalizeItemCodeKey(code);
  return codeKey ? baseItemIconFilenameByCode.get(codeKey) : undefined;
}
