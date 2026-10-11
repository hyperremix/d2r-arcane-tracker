import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Guide } from '../content';
import { requireGuide, SITE_URL } from '../content';
import type { PageMeta } from './pageMeta';
import { applyPageMeta, guideBreadcrumbJsonLd, guidePageMeta } from './pageMeta';

const indexHtml = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../index.html'),
  'utf8',
);

const holyGrailGuide = requireGuide('holy-grail');

const meta: PageMeta = {
  title: 'Run Tracker Guide – D2R Arcane Tracker',
  description: 'Time your "runs" & more',
  url: 'https://hyperremix.github.io/d2r-arcane-tracker/guides/run-tracker/',
};

function parseHead(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function attribute(document: Document, selector: string, name: string): string | undefined {
  return document.querySelector(selector)?.getAttribute(name) ?? undefined;
}

describe('When the metadata of a guide page is built', () => {
  it('Then the title names the guide and the site, and the URL is the absolute page URL', () => {
    // Arrange / Act
    const result = guidePageMeta(holyGrailGuide);

    // Assert
    expect(result).toEqual({
      title: 'Holy Grail Guide – D2R Arcane Tracker',
      description: holyGrailGuide.metaDescription,
      url: `${SITE_URL}guides/holy-grail/`,
    });
  });

  it('Then the breadcrumb structured data leads from the home page to the guide', () => {
    // Arrange / Act
    const result = JSON.parse(guideBreadcrumbJsonLd(holyGrailGuide));

    // Assert
    expect(result).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, item: SITE_URL },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Holy Grail Guide',
          item: `${SITE_URL}guides/holy-grail/`,
        },
      ],
    });
  });

  it('If a guide title contains "<", then the structured data cannot close its script element', () => {
    // Arrange
    const guide: Guide = { ...holyGrailGuide, title: '</script><b>' };

    // Act
    const result = guideBreadcrumbJsonLd(guide);

    // Assert
    expect(result).not.toContain('<');
    expect(JSON.parse(result).itemListElement[1].name).toBe('</script><b>');
  });
});

describe('When the metadata is put into the site template', () => {
  it('Then the title, description and canonical URL tags of website/index.html are replaced', () => {
    // Arrange / Act
    const document = parseHead(applyPageMeta(indexHtml, meta));

    // Assert
    expect(document.title).toBe(meta.title);
    expect(attribute(document, 'meta[name="description"]', 'content')).toBe(meta.description);
    expect(attribute(document, 'link[rel="canonical"]', 'href')).toBe(meta.url);
    expect(attribute(document, 'meta[property="og:title"]', 'content')).toBe(meta.title);
    expect(attribute(document, 'meta[property="og:description"]', 'content')).toBe(
      meta.description,
    );
    expect(attribute(document, 'meta[property="og:url"]', 'content')).toBe(meta.url);
  });

  it('Then the other head tags stay as they are', () => {
    // Arrange
    const before = parseHead(indexHtml);

    // Act
    const after = parseHead(applyPageMeta(indexHtml, meta));

    // Assert
    expect(attribute(after, 'meta[property="og:image"]', 'content')).toBe(
      attribute(before, 'meta[property="og:image"]', 'content'),
    );
    expect(after.querySelectorAll('head > *')).toHaveLength(
      before.querySelectorAll('head > *').length,
    );
    expect(applyPageMeta(indexHtml, meta)).toContain('<!--app-html-->');
  });

  it('If the template has Twitter title, description and URL tags, then they are replaced too', () => {
    // Arrange
    const template = [
      '<title>Home</title>',
      '<meta name="description" content="Home">',
      '<link href="https://example.com/" rel="canonical">',
      '<meta content="Home" property="og:title">',
      '<meta property="og:description" content="Home">',
      '<meta property="og:url" content="https://example.com/">',
      '<meta name="twitter:title" content="Home">',
      '<meta name="twitter:description" content="Home">',
    ].join('\n');

    // Act
    const document = parseHead(applyPageMeta(template, meta));

    // Assert
    expect(attribute(document, 'link[rel="canonical"]', 'href')).toBe(meta.url);
    expect(attribute(document, 'meta[property="og:title"]', 'content')).toBe(meta.title);
    expect(attribute(document, 'meta[name="twitter:title"]', 'content')).toBe(meta.title);
    expect(attribute(document, 'meta[name="twitter:description"]', 'content')).toBe(
      meta.description,
    );
  });

  it('If the metadata has quotes, ampersands or brackets, then they are escaped in the tags', () => {
    // Arrange
    const tricky: PageMeta = {
      title: `Ladik's <b>"CASC"</b> & more`,
      description: `Ladik's "CASC" <Viewer> & more`,
      url: 'https://example.com/?a=1&b=2',
    };

    // Act
    const html = applyPageMeta(indexHtml, tricky);
    const document = parseHead(html);

    // Assert
    expect(html).toContain('Ladik&#39;s &lt;b&gt;&quot;CASC&quot;&lt;/b&gt; &amp; more');
    expect(document.title).toBe(tricky.title);
    expect(attribute(document, 'meta[name="description"]', 'content')).toBe(tricky.description);
    expect(attribute(document, 'link[rel="canonical"]', 'href')).toBe(tricky.url);
  });

  it('If the template has no title element, then building the page fails', () => {
    // Arrange
    const template = indexHtml.replace(/<title>[^<]*<\/title>/, '');

    // Act
    const apply = () => applyPageMeta(template, meta);

    // Assert
    expect(apply).toThrow(/no <title>/);
  });

  it('If a tag to fill has no attribute to replace, then building the page fails', () => {
    // Arrange
    const template = indexHtml.replace(/<link rel="canonical"[^>]*>/, '<link rel="canonical">');

    // Act
    const apply = () => applyPageMeta(template, meta);

    // Assert
    expect(apply).toThrow(/no href attribute/);
  });

  it('If the template lacks a required tag, then building the page fails', () => {
    // Arrange
    const template = indexHtml.replace(/<link rel="canonical"[^>]*>/, '');

    // Act
    const apply = () => applyPageMeta(template, meta);

    // Assert
    expect(apply).toThrow(/canonical/);
  });
});
