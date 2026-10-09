import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Minimal alias entry shape. Declared locally instead of importing vite's `Alias`
 * because vitest ships its own vite version whose `Alias` type differs from the
 * root vite package's; this structural shape is accepted by both.
 */
export interface D2sAlias {
  find: string | RegExp;
  replacement: string;
}

/**
 * Resolve aliases that point `@dschu012/d2s` at its TypeScript sources.
 *
 * The d2s fork is installed from a git ref and may lack a compiled `lib/`
 * directory. When `lib/index.js` is missing, both the bare package import and
 * deep `@dschu012/d2s/lib/...` imports are redirected to `src/`. When the
 * compiled build is present, no aliases are needed.
 *
 * Shared by vite.config.ts and vitest.config.ts so both resolve d2s the same way.
 *
 * @param rootDir - Absolute path to the repository root (the directory containing node_modules).
 */
export function getD2sSourceAliases(rootDir: string): D2sAlias[] {
  const d2sRoot = path.resolve(rootDir, './node_modules/@dschu012/d2s');
  const hasD2sLibBuild = existsSync(path.join(d2sRoot, 'lib/index.js'));
  if (hasD2sLibBuild) {
    return [];
  }

  return [
    { find: /^@dschu012\/d2s\/lib\//, replacement: `${path.join(d2sRoot, 'src')}/` },
    { find: '@dschu012/d2s', replacement: path.join(d2sRoot, 'src/index.ts') },
  ];
}
