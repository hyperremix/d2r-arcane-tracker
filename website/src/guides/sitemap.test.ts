import { describe, expect, it } from 'vitest';
import { renderSitemap, sitemapEntries } from './sitemap';

function parseSitemap(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

describe('When the sitemap is rendered', () => {
  it('Then it lists every page with its last modification date', () => {
    // Arrange
    const entries = [
      { url: 'https://d2rarcanetracker.com/', lastmod: '2026-10-01' },
      {
        url: 'https://d2rarcanetracker.com/guides/holy-grail/',
        lastmod: '2026-09-15',
      },
    ];

    // Act
    const document = parseSitemap(renderSitemap(entries));

    // Assert
    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.documentElement.namespaceURI).toBe(
      'http://www.sitemaps.org/schemas/sitemap/0.9',
    );
    const urls = [...document.getElementsByTagName('url')].map((url) => ({
      url: url.getElementsByTagName('loc')[0]?.textContent,
      lastmod: url.getElementsByTagName('lastmod')[0]?.textContent,
    }));
    expect(urls).toEqual(entries);
  });

  it('If a page has no date or its URL has XML special characters, then the XML stays valid', () => {
    // Arrange
    const entries = [{ url: 'https://example.com/?a=1&b=2' }];

    // Act
    const xml = renderSitemap(entries);

    // Assert
    const document = parseSitemap(xml);
    expect(document.querySelector('parsererror')).toBeNull();
    expect(document.getElementsByTagName('loc')[0]?.textContent).toBe(entries[0].url);
    expect(document.getElementsByTagName('lastmod')).toHaveLength(0);
  });
});

describe('When the sitemap entries are composed', () => {
  const siteUrl = 'https://example.com/site/';
  const pages = [
    { file: 'A_GUIDE.md', meta: { url: `${siteUrl}guides/a/` } },
    { file: 'B_GUIDE.md', meta: { url: `${siteUrl}guides/b/` } },
  ];

  it('Then the home page comes first, followed by every guide page', () => {
    // Arrange
    const lastModified = () => '2026-10-01';

    // Act
    const entries = sitemapEntries(siteUrl, pages, lastModified);

    // Assert
    expect(entries.map((entry) => entry.url)).toEqual([
      siteUrl,
      `${siteUrl}guides/a/`,
      `${siteUrl}guides/b/`,
    ]);
  });

  it('Then each page is dated by the files its content comes from', () => {
    // Arrange
    const dates: Record<string, string> = {
      'website,docs/screenshots': '2026-10-05',
      'docs/A_GUIDE.md': '2026-09-01',
      'docs/B_GUIDE.md': '2026-09-15',
    };
    const lastModified = (paths: string[]) => dates[paths.join(',')] ?? 'unknown';

    // Act
    const entries = sitemapEntries(siteUrl, pages, lastModified);

    // Assert
    expect(entries.map((entry) => entry.lastmod)).toEqual([
      '2026-10-05',
      '2026-09-01',
      '2026-09-15',
    ]);
  });

  it('If there are no guide pages, then only the home page is listed', () => {
    // Arrange
    const lastModified = () => '2026-10-01';

    // Act
    const entries = sitemapEntries(siteUrl, [], lastModified);

    // Assert
    expect(entries).toEqual([{ url: siteUrl, lastmod: '2026-10-01' }]);
  });
});
