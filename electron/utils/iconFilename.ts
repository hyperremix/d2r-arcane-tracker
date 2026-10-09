/**
 * Helpers that turn item names and parser `inv_file` values into sprite icon filenames.
 *
 * Renderer-safe: no Node or Electron dependencies.
 */

const KNOWN_IMAGE_EXTENSION_PATTERN = /\.(png|sprite|dc6|dds|jpg|jpeg|webp)$/i;

/** Last segment of a path, splitting on both POSIX (`/`) and Windows (`\`) separators. */
export function getPathBasename(input: string): string {
  const segments = input.split(/[\\/]/);
  return segments[segments.length - 1] ?? input;
}

/** Removes a known image extension (png, sprite, dc6, dds, jpg, jpeg, webp) from a filename. */
export function stripKnownImageExtension(value: string): string {
  return value.replace(KNOWN_IMAGE_EXTENSION_PATTERN, '');
}

/**
 * Normalizes an icon reference (a numeric parser `inv_file`, a filename or a path) into a
 * lower-case `.png` filename. Returns undefined when nothing usable is left.
 */
export function normalizeIconFilename(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}.png`;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const withoutExtension = stripKnownImageExtension(getPathBasename(trimmed)).trim().toLowerCase();
  if (!withoutExtension) {
    return undefined;
  }

  return `${withoutExtension}.png`;
}

/** Turns an item name into a snake_case `.png` filename, e.g. "Harlequin Crest" → "harlequin_crest.png". */
export function toSnakeCaseIconFilename(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const slug = value
    .trim()
    .toLowerCase()
    .replace(/['`]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!slug) {
    return undefined;
  }

  return `${slug}.png`;
}
