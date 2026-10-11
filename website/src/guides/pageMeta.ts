import type { Guide } from '../content';
import { guidePagePath, SITE_URL } from '../content';
import { escapeHtml } from './escapeHtml';

const SITE_NAME = 'D2R Arcane Tracker';

/** The head tags that differ between the site's pages */
export interface PageMeta {
  title: string;
  description: string;
  /** Absolute canonical URL */
  url: string;
}

export function guidePageMeta(guide: Guide): PageMeta {
  return {
    title: `${guide.pageTitle} – ${SITE_NAME}`,
    description: guide.metaDescription,
    url: `${SITE_URL}${guidePagePath(guide)}`,
  };
}

/** BreadcrumbList structured data for a guide page: home page → guide. */
export function guideBreadcrumbJsonLd(guide: Guide): string {
  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      {
        '@type': 'ListItem',
        position: 2,
        name: guide.title,
        item: guidePageMeta(guide).url,
      },
    ],
  };
  // Escapes `<` so the JSON can't close the script element it is embedded in
  return JSON.stringify(breadcrumbs).replace(/</g, '\\u003c');
}

interface HeadAttribute {
  /** Matches the whole start tag */
  tag: RegExp;
  attribute: string;
  /** Missing optional tags are skipped; a missing required tag fails the build */
  required: boolean;
}

function metaTag(key: 'name' | 'property', value: string, required: boolean): HeadAttribute {
  return {
    tag: new RegExp(`<meta\\b[^>]*\\b${key}="${value}"[^>]*>`),
    attribute: 'content',
    required,
  };
}

const HEAD_ATTRIBUTES: Record<keyof PageMeta, HeadAttribute[]> = {
  title: [metaTag('property', 'og:title', true), metaTag('name', 'twitter:title', false)],
  description: [
    metaTag('name', 'description', true),
    metaTag('property', 'og:description', true),
    metaTag('name', 'twitter:description', false),
  ],
  url: [
    { tag: /<link\b[^>]*\brel="canonical"[^>]*>/, attribute: 'href', required: true },
    metaTag('property', 'og:url', true),
    metaTag('name', 'twitter:url', false),
  ],
};

/**
 * Puts a page's title, description and canonical URL into the site's HTML template (built from
 * website/index.html), in the `<title>` and the matching meta and link tags. All other head tags
 * are shared by every page and stay as they are.
 */
export function applyPageMeta(template: string, meta: PageMeta): string {
  if (!/<title>[^<]*<\/title>/.test(template)) {
    throw new Error('The HTML template has no <title>');
  }
  let html = template.replace(
    /<title>[^<]*<\/title>/,
    () => `<title>${escapeHtml(meta.title)}</title>`,
  );

  for (const [key, targets] of Object.entries(HEAD_ATTRIBUTES) as [
    keyof PageMeta,
    HeadAttribute[],
  ][]) {
    for (const { tag, attribute, required } of targets) {
      const match = tag.exec(html);
      if (!match) {
        if (required) throw new Error(`The HTML template has no tag matching ${tag}`);
        continue;
      }
      const attributePattern = new RegExp(`\\b${attribute}="[^"]*"`);
      if (!attributePattern.test(match[0])) {
        throw new Error(`The tag ${match[0]} has no ${attribute} attribute`);
      }
      const updatedTag = match[0].replace(
        attributePattern,
        () => `${attribute}="${escapeHtml(meta[key])}"`,
      );
      html = html.slice(0, match.index) + updatedTag + html.slice(match.index + match[0].length);
    }
  }
  return html;
}
