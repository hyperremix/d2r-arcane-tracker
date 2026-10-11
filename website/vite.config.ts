import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { getSourceAliases } from '../config/aliases';

const rootDir = path.resolve(__dirname, '..');

/**
 * The project website (GitHub Pages). It reuses the app's theme tokens and shadcn components from
 * `src/`, so `@/` resolves to the app's renderer source here too.
 * Built and prerendered by website/build.ts. The base is the GitHub Pages path, also for the dev
 * and preview servers: the prerender (server) build and the client build must produce the same
 * asset URLs, and a relative base would make the server build emit root-relative ones.
 */
export default defineConfig({
  root: __dirname,
  base: '/d2r-arcane-tracker/',
  resolve: {
    alias: getSourceAliases(rootDir),
  },
  plugins: [tailwindcss(), react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
