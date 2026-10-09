import { cpSync, rmSync } from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import electron from 'vite-plugin-electron/simple';
import { getD2sSourceAliases } from './config/d2sAliases';

const d2sSourceAliases = getD2sSourceAliases(__dirname);

/**
 * Copies the SQL migrations next to the bundled main process (`dist-electron/migrations`), where
 * `resolveMigrationsFolder` in electron/database/migrator.ts looks for them at runtime.
 * electron-builder packs `dist-electron` into the app archive.
 */
function copyMigrations(): Plugin {
  const source = path.resolve(__dirname, 'electron/database/migrations');
  return {
    name: 'copy-database-migrations',
    buildStart() {
      // Rebuild in watch mode (bun run dev) when a migration is generated.
      this.addWatchFile(path.join(source, 'meta', '_journal.json'));
    },
    writeBundle(options) {
      const outDir = options.dir ?? path.dirname(options.file ?? '');
      const target = path.join(outDir, 'migrations');
      rmSync(target, { recursive: true, force: true });
      // drizzle-kit snapshots are only needed to generate migrations, not to apply them.
      cpSync(source, target, {
        recursive: true,
        filter: (file) => !file.endsWith('_snapshot.json'),
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: 'electron', replacement: path.resolve(__dirname, './electron') },
      ...d2sSourceAliases,
    ],
  },
  plugins: [
    tailwindcss(),
    react(),
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: 'electron/main.ts',
        vite: {
          // vite-plugin-electron does not inherit root resolve.alias — pass d2s
          // aliases explicitly so the main-process build can resolve the package
          // source when the compiled lib/ directory is absent.
          resolve: {
            alias: d2sSourceAliases,
          },
          plugins: [copyMigrations()],
          build: {
            // Vite 8 bundles with Rolldown; vite-plugin-electron 1.x only reads
            // `rolldownOptions` here, so `rollupOptions` would silently drop the externals.
            rolldownOptions: {
              external: ['better-sqlite3', 'koffi'],
            },
          },
        },
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      // No `renderer` option: the renderer is sandboxed (no Node.js integration, see
      // electron/window/appWindow.ts), so it needs no Electron/Node.js polyfills and talks to the
      // main process only through the preload bridge.
    }),
  ],
});
