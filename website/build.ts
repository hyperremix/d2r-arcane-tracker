import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

/**
 * Builds the website and prerenders it to static HTML:
 *
 * 1. Client build into website/dist (hydrates the page in the browser).
 * 2. Server build of src/entry-server.tsx into website/.ssr.
 * 3. Renders the page with the server build and writes it into dist/index.html, so the content is
 *    in the HTML for search engines and readers without JavaScript.
 */
const websiteDir = import.meta.dirname;
const configFile = path.join(websiteDir, 'vite.config.ts');
const distDir = path.join(websiteDir, 'dist');
const ssrDir = path.join(websiteDir, '.ssr');

async function main(): Promise<void> {
  await build({ configFile });
  await build({
    configFile,
    build: {
      ssr: 'src/entry-server.tsx',
      outDir: ssrDir,
      emptyOutDir: true,
      // The server build only renders HTML; the client build already emitted the assets.
      copyPublicDir: false,
    },
  });

  try {
    const { render } = (await import(pathToFileURL(path.join(ssrDir, 'entry-server.js')).href)) as {
      render: () => string;
    };
    const indexFile = path.join(distDir, 'index.html');
    const template = await readFile(indexFile, 'utf8');
    if (!template.includes('<!--app-html-->')) {
      throw new Error('website/index.html is missing the <!--app-html--> placeholder');
    }
    await writeFile(indexFile, template.replace('<!--app-html-->', render()));
  } finally {
    await rm(ssrDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
