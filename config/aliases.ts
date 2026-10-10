import path from 'node:path';
import type { D2sAlias } from './d2sAliases';

/**
 * Resolve aliases for the repository's own source folders, matching the `paths` in tsconfig.base.json:
 *
 * - `@/...` resolves to `src/...`.
 * - `electron/...` resolves to `electron/...` (main-process code shared with the renderer).
 *
 * Both are anchored regexes that require the trailing slash, so the bare `electron` module and
 * scoped packages such as `@dschu012/d2s` are left alone.
 *
 * Shared by vite.config.ts and vitest.config.ts so both resolve imports the same way.
 *
 * @param rootDir - Absolute path to the repository root.
 */
export function getSourceAliases(rootDir: string): D2sAlias[] {
  return [
    { find: /^@\//, replacement: `${path.resolve(rootDir, 'src')}/` },
    { find: /^electron\//, replacement: `${path.resolve(rootDir, 'electron')}/` },
  ];
}
