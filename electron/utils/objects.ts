/**
 * Simplifies an item name by removing all non-alphanumeric characters and converting to lowercase.
 * @param {string} name - The item name to simplify.
 * @returns {string} The simplified item name.
 * @example
 * simplifyItemName("Harlequin Crest") // Returns: "harlequincrest"
 */
export const simplifyItemName = (name: string): string =>
  name.replace(/[^a-z0-9]/gi, '').toLowerCase();

/**
 * Determines if an item is a rune based on its type identifier.
 * @param {{ type?: string }} item - The item to check.
 * @returns {boolean} True if the item is a rune (type matches pattern r01-r33), false otherwise.
 */
export const isRune = (item: { type?: string }): boolean =>
  !!item.type && /^r[0-3][0-9]$/.test(item.type);
