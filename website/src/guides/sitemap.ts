import { escapeHtml } from './escapeHtml';

export interface SitemapEntry {
  /** Absolute URL of the page */
  url: string;
  /** When the page's content last changed, as `YYYY-MM-DD` */
  lastmod?: string;
}

/** Renders a sitemap.xml (sitemaps.org protocol) that lists the given pages. */
export function renderSitemap(entries: readonly SitemapEntry[]): string {
  const urls = entries.map(({ url, lastmod }) => {
    const lastmodTag = lastmod ? `\n    <lastmod>${escapeHtml(lastmod)}</lastmod>` : '';
    return `  <url>\n    <loc>${escapeHtml(url)}</loc>${lastmodTag}\n  </url>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

/** The repository paths (relative to its root) that make up the home page */
const HOME_PAGE_PATHS = ['website', 'docs/screenshots'];

/** A guide page, as far as the sitemap needs to know it */
interface SitemapGuidePage {
  /** The guide's Markdown file in docs/ */
  file: string;
  meta: { url: string };
}

/**
 * The sitemap entries for the home page and the guide pages. A page's `lastmod` is when the files
 * its content comes from last changed, as told by `lastModified` (paths relative to the repository).
 */
export function sitemapEntries(
  siteUrl: string,
  guidePages: readonly SitemapGuidePage[],
  lastModified: (paths: string[]) => string,
): SitemapEntry[] {
  return [
    { url: siteUrl, lastmod: lastModified(HOME_PAGE_PATHS) },
    ...guidePages.map((page) => ({
      url: page.meta.url,
      lastmod: lastModified([`docs/${page.file}`]),
    })),
  ];
}
