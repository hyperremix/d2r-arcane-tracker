import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { getD2sSourceAliases } from './config/d2sAliases';

const d2sSourceAliases = getD2sSourceAliases(__dirname);

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
