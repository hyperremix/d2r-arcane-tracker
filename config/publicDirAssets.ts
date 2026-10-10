import { statSync } from 'node:fs';
import path from 'node:path';

/**
 * Resolve a root-relative import specifier (e.g. `/logo.png`) to the absolute path of a regular
 * file inside `publicDir`, or `undefined` when it does not name one.
 *
 * Directories, missing files and specifiers that escape `publicDir` (e.g. `/../package.json`)
 * are rejected. Only plain specifiers are handled: ones with a query or hash suffix such as
 * `?url` or `?raw` do not name a file on disk and therefore fall through to Vite unchanged. The
 * repo only imports public files without a suffix.
 *
 * @param publicDir - Absolute path to the `public/` directory.
 * @param source - The import specifier as passed to the plugin's `resolveId` hook.
 */
export function resolvePublicDirFile(publicDir: string, source: string): string | undefined {
  if (!source.startsWith('/')) return undefined;
  const root = path.resolve(publicDir);
  const file = path.resolve(root, `.${source}`);
  const relativePath = path.relative(root, file);
  if (relativePath === '' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return undefined;
  }
  try {
    return statSync(file).isFile() ? file : undefined;
  } catch {
    return undefined;
  }
}
