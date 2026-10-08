import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const d2sRoot = resolve(__dirname, './node_modules/@dschu012/d2s');
const hasD2sLibBuild = existsSync(join(d2sRoot, 'lib/index.js'));
const d2sSourceAliases = hasD2sLibBuild
  ? []
  : [
      { find: /^@dschu012\/d2s\/lib\//, replacement: `${join(d2sRoot, 'src')}/` },
      { find: '@dschu012/d2s', replacement: join(d2sRoot, 'src/index.ts') },
    ];

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
        isolate: false,
      },
    },
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
    alias: [
      { find: '@', replacement: resolve(__dirname, './src') },
      { find: /^electron\//, replacement: `${resolve(__dirname, './electron')}/` },
      ...d2sSourceAliases,
    ],
  },
});
