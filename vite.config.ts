import { existsSync } from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import electron from 'vite-plugin-electron/simple';

const d2sRoot = path.resolve(__dirname, './node_modules/@dschu012/d2s');
const hasD2sLibBuild = existsSync(path.join(d2sRoot, 'lib/index.js'));
const d2sSourceAliases = hasD2sLibBuild
  ? []
  : [
      { find: /^@dschu012\/d2s\/lib\//, replacement: `${path.join(d2sRoot, 'src')}/` },
      { find: '@dschu012/d2s', replacement: path.join(d2sRoot, 'src/index.ts') },
    ];

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
          build: {
            rollupOptions: {
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
      // Ployfill the Electron and Node.js API for Renderer process.
      // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer:
        process.env.NODE_ENV === 'test'
          ? // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
            undefined
          : {},
    }),
  ],
});
