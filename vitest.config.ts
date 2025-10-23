import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

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
    alias: {
      '@': resolve(__dirname, './src'),
      'electron/types/grail': resolve(__dirname, './electron/types/grail.ts'),
    },
  },
});
