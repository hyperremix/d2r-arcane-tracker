import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { getSourceAliases } from '../config/aliases';

const rootDir = path.resolve(import.meta.dirname, '..');

/**
 * Preloads the latin Cinzel and Inter fonts of the hero heading and text, so they don't wait for
 * the stylesheet to be parsed and the hero doesn't shift when they swap in for the fallback fonts.
 * Their file names are hashed, so the links are added once the build has emitted them. Only in
 * builds: the dev server serves the fonts from node_modules.
 */
function preloadHeroFonts(): Plugin {
  const fontFilePatterns = [
    /(?:^|\/)cinzel-latin-wght-normal-[\w-]+\.woff2$/,
    /(?:^|\/)inter-latin-wght-normal-[\w-]+\.woff2$/,
  ];
  let base = '/';

  return {
    name: 'website:preload-hero-fonts',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle }) {
        const outputs = Object.values(bundle ?? {});
        return fontFilePatterns.map((pattern) => {
          const font = outputs.find((output) => pattern.test(output.fileName));
          if (!font) {
            throw new Error(`No emitted font matches ${pattern}, so it can't be preloaded`);
          }
          return {
            tag: 'link',
            attrs: {
              rel: 'preload',
              href: `${base}${font.fileName}`,
              as: 'font',
              type: 'font/woff2',
              crossorigin: '',
            },
            injectTo: 'head',
          };
        });
      },
    },
  };
}

/**
 * The project website (GitHub Pages). It reuses the app's theme tokens and shadcn components from
 * `src/`, so `@/` resolves to the app's renderer source here too.
 * Built and prerendered by website/build.ts. The base is the GitHub Pages path, also for the dev
 * and preview servers: the prerender (server) build and the client build must produce the same
 * asset URLs, and a relative base would make the server build emit root-relative ones.
 */
export default defineConfig({
  root: import.meta.dirname,
  base: '/d2r-arcane-tracker/',
  resolve: {
    alias: getSourceAliases(rootDir),
  },
  plugins: [tailwindcss(), react(), preloadHeroFonts()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
