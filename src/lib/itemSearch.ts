import type { Item } from 'electron/types/grail';

/**
 * Pre-processed search data for a single item.
 */
interface ItemSearchIndex {
  /** All searchable fields joined by spaces (normalized). */
  text: string;
  /** Individual normalized words of all searchable fields. */
  words: string[];
}

/**
 * Cache of search data per item object. Items are immutable once loaded, so the index is built
 * once per item and reused for every keystroke instead of re-normalizing all fields each time.
 */
const searchIndexCache = new WeakMap<Item, ItemSearchIndex>();

/**
 * Normalizes text for matching: lowercases, strips diacritics and apostrophes (so "tal rashas"
 * matches "Tal Rasha's") and turns every other non-alphanumeric character into a word separator.
 * @param {string} value - The text to normalize
 * @returns {string} The normalized text with single spaces between words
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Splits a search query into normalized tokens.
 * @param {string} query - The raw search query
 * @returns {string[]} The normalized query tokens (empty if the query has no searchable text)
 */
export function tokenizeSearchQuery(query: string): string[] {
  const normalized = normalizeSearchText(query);
  return normalized ? normalized.split(' ') : [];
}

/**
 * Returns the (cached) search index of an item. Searchable fields are the item name, its base
 * item, its set name and, for runewords, the names of the runes it is made of.
 * @param {Item} item - The item to index
 * @returns {ItemSearchIndex} The search index for the item
 */
function getItemSearchIndex(item: Item): ItemSearchIndex {
  const cached = searchIndexCache.get(item);
  if (cached) return cached;

  const fields = [item.name, item.itemBase, item.setName, ...(item.runes ?? [])];
  const text = fields
    .filter((field): field is string => Boolean(field))
    .map(normalizeSearchText)
    .filter(Boolean)
    .join(' ');
  const index: ItemSearchIndex = { text, words: text ? text.split(' ') : [] };
  searchIndexCache.set(item, index);
  return index;
}

/**
 * Checks whether all characters of the token appear in order within the word.
 * @param {string} token - The query token
 * @param {string} word - The word to check against
 * @returns {boolean} True if the token is a subsequence of the word
 */
function isSubsequence(token: string, word: string): boolean {
  let tokenIndex = 0;
  for (let wordIndex = 0; wordIndex < word.length && tokenIndex < token.length; wordIndex++) {
    if (word[wordIndex] === token[tokenIndex]) tokenIndex++;
  }
  return tokenIndex === token.length;
}

/**
 * Calculates the optimal string alignment distance (Levenshtein distance that also counts an
 * adjacent transposition as a single edit). Stops early and returns `maxDistance + 1` once the
 * distance is guaranteed to exceed `maxDistance`.
 * @param {string} a - First string
 * @param {string} b - Second string
 * @param {number} maxDistance - The largest distance that is of interest
 * @returns {number} The edit distance, or `maxDistance + 1` if it is larger than `maxDistance`
 */
function boundedEditDistance(a: string, b: string, maxDistance: number): number {
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;

  let previousPrevious: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, previousPrevious[j - 2] + 1);
      }
      current[j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    previousPrevious = previous;
    previous = current;
  }

  return previous[b.length];
}

/**
 * Number of typos tolerated for a fuzzy token: none for short tokens (they are matched by prefix
 * or subsequence only), one for medium tokens and two for long tokens.
 * @param {number} length - The token length
 * @returns {number} The allowed edit distance
 */
function allowedTypos(length: number): number {
  if (length < 5) return 0;
  if (length < 9) return 1;
  return 2;
}

/**
 * Checks whether a single query token fuzzily matches a word. A token matches if it is a prefix
 * of the word, if it abbreviates the word (at least three of its letters appear in order and
 * cover more than half of the word, e.g. "hrlqn" for "harlequin"), or if it is within a small
 * number of typos of the whole word (e.g. "windfroce" for "windforce"). Every rule requires the
 * first letter to match, which keeps results precise (e.g. "shako" does not match every name
 * containing "sha", and does not match "shadow").
 * @param {string} token - The normalized query token
 * @param {string} word - The normalized word to match against
 * @returns {boolean} True if the token fuzzily matches the word
 */
function fuzzyTokenMatchesWord(token: string, word: string): boolean {
  if (word[0] !== token[0]) return false;
  if (word.startsWith(token)) return true;
  // In-order letters only count for abbreviations that cover a good part of the word
  if (token.length >= 3 && token.length * 2 > word.length && isSubsequence(token, word)) {
    return true;
  }

  const maxTypos = allowedTypos(token.length);
  return maxTypos > 0 && boundedEditDistance(token, word, maxTypos) <= maxTypos;
}

/**
 * Checks whether an item matches a search query. The query is split into words and every word
 * must match the item's name, base item, set name or runeword runes.
 * - Exact mode: every query word must appear somewhere in those fields.
 * - Fuzzy mode: additionally tolerates abbreviations (prefixes and in-order letters such as
 *   "lacq plt" for "Lacquered Plate") and small typos (such as "windfroce").
 * @param {Item} item - The item to check
 * @param {string[]} tokens - The normalized query tokens (see {@link tokenizeSearchQuery})
 * @param {boolean} [fuzzy=false] - Whether to use fuzzy matching
 * @returns {boolean} True if the item matches every token (or there are no tokens)
 */
export function itemMatchesSearch(item: Item, tokens: string[], fuzzy = false): boolean {
  if (tokens.length === 0) return true;

  const { text, words } = getItemSearchIndex(item);
  return tokens.every(
    (token) =>
      text.includes(token) || (fuzzy && words.some((word) => fuzzyTokenMatchesWord(token, word))),
  );
}
