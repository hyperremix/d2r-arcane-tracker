import { relative, resolve } from 'node:path';
import { normalizePath, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { getSourceAliases } from './config/aliases';
import { getD2sSourceAliases } from './config/d2sAliases';
import { resolvePublicDirFile } from './config/publicDirAssets';

const d2sSourceAliases = getD2sSourceAliases(__dirname);

/**
 * Serves root-relative imports of `public/` files (e.g. `import logoUrl from '/logo.png'`) as
 * their public URL, as Vite does in the app build. Left to Vite, the module keeps the drive-less
 * file path `/logo.png`, which Vitest rejects on Windows when it creates the module's `require`.
 */
function publicDirAssetUrls(): Plugin {
  const publicDir = normalizePath(resolve(__dirname, 'public'));
  return {
    name: 'test:public-dir-asset-urls',
    enforce: 'pre',
    resolveId(source) {
      const file = resolvePublicDirFile(publicDir, source);
      return file === undefined ? undefined : normalizePath(file);
    },
    load(id) {
      if (!id.startsWith(`${publicDir}/`)) return undefined;
      return `export default ${JSON.stringify(`/${normalizePath(relative(publicDir, id))}`)};`;
    },
  };
}

export default defineConfig({
  test: {
    globals: true,
    pool: 'threads',
    projects: [
      {
        // Electron main process and build config: plain Node, one module registry per file
        extends: true,
        test: {
          name: 'main',
          include: ['electron/**/*.test.ts', 'config/**/*.test.ts'],
          environment: 'node',
          setupFiles: ['./electron/test/setup.ts'],
          isolate: true,
          // Projects with different worker settings must run in separate groups
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        plugins: [publicDirAssetUrls()],
        test: {
          name: 'renderer',
          include: ['src/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts'],
          // Renderer suites share one jsdom and module registry: isolating each file (fresh jsdom
          // and setup per file) measured about twice as slow, even with parallel workers
          maxWorkers: 1,
          isolate: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/',
        'dist/',
        'dist-electron/',
        'build/',
        'release/',
        'scripts/',
        '**/*.d.ts',
        '**/*.config.*',
        'public/**',
        '**/test/**',
        '**/__tests__/**',
        '**/*.test.*',
        '**/*.spec.*',
      ],
    },
    outputFile: {
      junit: './coverage/test-results.xml',
    },
    reporters: ['verbose', 'junit'],
  },
  resolve: {
    alias: [...getSourceAliases(__dirname), ...d2sSourceAliases],
  },
});
