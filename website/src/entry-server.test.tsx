import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { guides, SITE_URL } from './content';
import * as entryServer from './entry-server';

beforeEach(() => {
  // React warns about layout effects when server-rendering inside jsdom; the build runs in Node
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('When the server entry renders the home page', () => {
  it('Then the HTML contains the page content', () => {
    // Arrange / Act
    const html = entryServer.render();

    // Assert
    expect(html).toContain('id="main"');
    expect(html).toContain('Skip to content');
  });
});

describe('When the server entry lists the guide pages', () => {
  it('Then every guide has a page that goes to guides/<slug>/index.html', () => {
    // Arrange / Act
    const pages = entryServer.guidePages;

    // Assert
    expect(pages.map(({ slug, file, outputFile }) => ({ slug, file, outputFile }))).toEqual(
      guides.map((guide) => ({
        slug: guide.slug,
        file: guide.file,
        outputFile: `guides/${guide.slug}/index.html`,
      })),
    );
    expect(pages.map((page) => page.meta.url)).toEqual(
      guides.map((guide) => `${SITE_URL}guides/${guide.slug}/`),
    );
  });
});

describe('When the server entry renders a guide page', () => {
  it('Then the HTML contains the guide rendered from its Markdown, with the breadcrumb data', () => {
    // Arrange
    const markdown = '# Run Tracker Guide\n\nRecords farming sessions.';

    // Act
    const html = entryServer.renderGuide('run-tracker', markdown);

    // Assert
    expect(html).toContain('<article data-guide="run-tracker"');
    expect(html).toContain('<h1 id="run-tracker-guide">Run Tracker Guide</h1>');
    expect(html).toContain('"@type":"BreadcrumbList"');
  });

  it('If a heading of the guide has an id the page itself uses, then rendering fails', () => {
    // Arrange
    const markdown = '# Run Tracker Guide\n\n## Install\n\n## More Guides\n\n## Details';

    // Act
    const render = () => entryServer.renderGuide('run-tracker', markdown);

    // Assert
    expect(render).toThrow(
      'RUN_TRACKER.md has headings with ids the page uses itself: #install, #more-guides',
    );
  });

  it('If the slug is not a guide, then rendering fails', () => {
    // Arrange / Act
    const render = () => entryServer.renderGuide('no-such-guide', '# Nothing');

    // Assert
    expect(render).toThrow('Unknown guide: no-such-guide');
  });
});

describe('When the server entry exposes what the build needs', () => {
  it('Then it re-exports the site URL, the page metadata and the sitemap and robots.txt helpers', () => {
    // Arrange / Act
    const exported = entryServer;

    // Assert
    expect(exported.SITE_URL).toBe(SITE_URL);
    expect(typeof exported.applyPageMeta).toBe('function');
    expect(typeof exported.renderRobotsTxt).toBe('function');
    expect(typeof exported.renderSitemap).toBe('function');
    expect(typeof exported.sitemapEntries).toBe('function');
  });
});
