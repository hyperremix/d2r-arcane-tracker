/**
 * Parses the raw d2s item JSON stored with parsed inventory and vault items
 * (`rawItemJson` / `vault_items.raw_item_json`).
 *
 * Renderer-safe: no Node or Electron dependencies.
 */

/**
 * Parses raw item JSON into an object of the caller's expected shape. Returns undefined when the
 * JSON is malformed or does not hold an object. Fields are not validated: callers should type
 * them as `unknown` and check each one before use.
 */
export function parseRawItemJson<T extends object>(rawItemJson: string): T | undefined {
  try {
    const parsed: unknown = JSON.parse(rawItemJson);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as T;
    }
  } catch {
    return undefined;
  }

  return undefined;
}
