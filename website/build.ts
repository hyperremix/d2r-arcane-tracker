import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import type * as EntryServer from './src/entry-server';
import { createLastModified } from './src/guides/lastModified';

/**
 * Builds the website and prerenders it to static HTML:
 *
 * 1. Client build into website/dist (hydrates the pages in the browser).
 * 2. Server build of src/entry-server.tsx into website/.ssr.
 * 3. Renders the home page with the server build into dist/index.html, so the content is in the
 *    HTML for search engines and readers without JavaScript.
 * 4. Renders each guide from docs/ into dist/guides/<slug>/index.html, with its own title,
 *    description and canonical URL.
 * 5. Writes dist/sitemap.xml listing the home page and the guide pages.
 */
const websiteDir = import.meta.dirname;
const repositoryDir = path.resolve(websiteDir, '..');
const docsDir = path.join(repositoryDir, 'docs');
const configFile = path.join(websiteDir, 'vite.config.ts');
const distDir = path.join(websiteDir, 'dist');
const ssrDir = path.join(websiteDir, '.ssr');

const APP_HTML_PLACEHOLDER = '<!--app-html-->';

function withAppHtml(template: string, appHtml: string): string {
  // A replacer function, so `$` sequences in the HTML are not treated as replacement patterns
  return template.replace(APP_HTML_PLACEHOLDER, () => appHtml);
}

async function main(): Promise<void> {
  const lastModified = createLastModified({ repositoryDir });

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
    const {
      render,
      renderGuide,
      guidePages,
      applyPageMeta,
      renderSitemap,
      sitemapEntries,
      SITE_URL,
    } = (await import(
      pathToFileURL(path.join(ssrDir, 'entry-server.js')).href
    )) as typeof EntryServer;
    const indexFile = path.join(distDir, 'index.html');
    const template = await readFile(indexFile, 'utf8');
    if (!template.includes(APP_HTML_PLACEHOLDER)) {
      throw new Error(`website/index.html is missing the ${APP_HTML_PLACEHOLDER} placeholder`);
    }
    await writeFile(indexFile, withAppHtml(template, render()));

    for (const page of guidePages) {
      const markdown = await readFile(path.join(docsDir, page.file), 'utf8');
      const outputFile = path.join(distDir, page.outputFile);
      await mkdir(path.dirname(outputFile), { recursive: true });
      await writeFile(
        outputFile,
        withAppHtml(applyPageMeta(template, page.meta), renderGuide(page.slug, markdown)),
      );
    }

    const sitemap = renderSitemap(sitemapEntries(SITE_URL, guidePages, lastModified));
    await writeFile(path.join(distDir, 'sitemap.xml'), sitemap);
  } finally {
    await rm(ssrDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
