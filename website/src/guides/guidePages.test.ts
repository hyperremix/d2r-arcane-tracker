import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { features, guides, guideUrl } from '../content';
import { renderGuideMarkdown } from './renderGuideMarkdown';
import { RESERVED_IDS } from './reservedIds';

const docsDir = join(dirname(fileURLToPath(import.meta.url)), '../../../docs/');
const base = import.meta.env.BASE_URL;

/** Renders a guide from docs/ the way the build does */
function renderGuide(file: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = renderGuideMarkdown(readFileSync(`${docsDir}${file}`, 'utf8'));
  return container;
}

/** The heading ids of each guide page, by the page's path */
function headingIdsByPagePath(): Map<string, Set<string>> {
  return new Map(
    guides.map((guide) => {
      const headings = renderGuide(guide.file).querySelectorAll('h1, h2, h3, h4, h5, h6');
      return [guideUrl(guide.file), new Set([...headings].map((heading) => heading.id))];
    }),
  );
}

/** Whether `href` (a guide page URL, optionally with an anchor) lands on a heading of its page */
function landsOnHeading(href: string, headingIds: Map<string, Set<string>>): boolean {
  const [pagePath, anchor] = href.split('#');
  const ids = headingIds.get(pagePath);
  return ids !== undefined && (anchor === undefined || ids.has(anchor));
}

describe('When the guide pages are built from docs/', () => {
  it('Then every guide has its Markdown file in docs/', () => {
    // Arrange / Act
    const missing = guides.filter((guide) => !existsSync(`${docsDir}${guide.file}`));

    // Assert
    expect(missing).toEqual([]);
  });

  it('Then every guide has its own URL-safe slug', () => {
    // Arrange
    const slugs = guides.map((guide) => guide.slug);

    // Act
    const unique = new Set(slugs);

    // Assert
    expect(unique.size).toBe(guides.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('Then every guide page has a title and a description', () => {
    // Arrange / Act
    const rendered = guides.map((guide) => ({ guide, page: renderGuide(guide.file) }));

    // Assert
    for (const { guide, page } of rendered) {
      expect(page.querySelectorAll('h1')).toHaveLength(1);
      expect(guide.pageTitle.trim()).not.toBe('');
      expect(guide.metaDescription.length).toBeGreaterThan(50);
      expect(guide.metaDescription.length).toBeLessThanOrEqual(160);
    }
  });

  it('Then each guide title is the heading of its page', () => {
    // Arrange / Act
    const headings = guides.map((guide) => ({
      title: guide.title,
      heading: renderGuide(guide.file).querySelector('h1')?.textContent,
    }));

    // Assert
    expect(headings.map(({ heading }) => heading)).toEqual(headings.map(({ title }) => title));
  });

  it('Then no heading id of a guide collides with an id the page itself uses', () => {
    // Arrange / Act
    const collisions = guides.flatMap((guide) =>
      [...renderGuide(guide.file).querySelectorAll('[id]')]
        .map((element) => element.id)
        .filter((id) => RESERVED_IDS.has(id))
        .map((id) => `${guide.file} → #${id}`),
    );

    // Assert
    expect(collisions).toEqual([]);
  });

  it('Then each guide links to its page on the site', () => {
    // Arrange / Act
    const urls = guides.map((guide) => guideUrl(guide.file));

    // Assert
    expect(urls).toEqual(guides.map((guide) => `${base}guides/${guide.slug}/`));
  });

  it('Then the feature tour links to guide pages and headings that exist', () => {
    // Arrange
    const headingIds = headingIdsByPagePath();

    // Act
    const broken = features
      .map((feature) => guideUrl(feature.guide.file, feature.guide.hash))
      .filter((href) => !landsOnHeading(href, headingIds));

    // Assert
    expect(broken).toEqual([]);
  });

  it('Then links between the guides land on pages and headings that exist', () => {
    // Arrange
    const headingIds = headingIdsByPagePath();

    // Act
    const broken = guides.flatMap((guide) =>
      [...renderGuide(guide.file).querySelectorAll('a')]
        .map((link) => link.getAttribute('href') ?? '')
        .filter((href) => href.startsWith(`${base}guides/`))
        .filter((href) => !landsOnHeading(href, headingIds))
        .map((href) => `${guide.file} → ${href}`),
    );

    // Assert
    expect(broken).toEqual([]);
  });

  it('Then links within a guide land on headings of that guide', () => {
    // Arrange / Act
    const broken = guides.flatMap((guide) => {
      const page = renderGuide(guide.file);
      const ids = new Set([...page.querySelectorAll('[id]')].map((element) => element.id));
      return [...page.querySelectorAll('a')]
        .map((link) => link.getAttribute('href') ?? '')
        .filter((href) => href.startsWith('#'))
        .filter((href) => !ids.has(href.slice(1)))
        .map((href) => `${guide.file} → ${href}`);
    });

    // Assert
    expect(broken).toEqual([]);
  });

  it('Then no guide links to a repository file by a relative path', () => {
    // Arrange / Act
    const relative = guides.flatMap((guide) =>
      [...renderGuide(guide.file).querySelectorAll('a[href], img[src]')]
        .map((element) => element.getAttribute('href') ?? element.getAttribute('src') ?? '')
        .filter((url) => !/^(#|https?:|mailto:)/.test(url) && !url.startsWith(`${base}guides/`))
        .map((url) => `${guide.file} → ${url}`),
    );

    // Assert
    expect(relative).toEqual([]);
  });
});
