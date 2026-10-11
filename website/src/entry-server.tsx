import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { App } from './App';
import { GuidePage } from './components/GuidePage';
import { guidePagePath, guides, requireGuide, SITE_URL } from './content';
import type { PageMeta } from './guides/pageMeta';
import { guidePageMeta } from './guides/pageMeta';
import { renderGuideMarkdown } from './guides/renderGuideMarkdown';
import { reservedHeadingIds } from './guides/reservedIds';

export { applyPageMeta } from './guides/pageMeta';
export { renderRobotsTxt, renderSitemap, sitemapEntries } from './guides/sitemap';
export { SITE_URL };

/** Renders the home page to HTML for the prerendered build (website/build.ts). */
export function render(): string {
  return renderToString(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

/** A guide page for website/build.ts to prerender */
export interface GuidePageEntry {
  slug: string;
  /** The guide's Markdown file in docs/ */
  file: string;
  /** Where the page goes, relative to the build output folder */
  outputFile: string;
  meta: PageMeta;
}

export const guidePages: GuidePageEntry[] = guides.map((guide) => ({
  slug: guide.slug,
  file: guide.file,
  outputFile: `${guidePagePath(guide)}index.html`,
  meta: guidePageMeta(guide),
}));

/** Renders a guide page, with the guide's Markdown from docs/, to HTML. Fails on unknown guides and reserved heading ids. */
export function renderGuide(slug: string, markdown: string): string {
  const guide = requireGuide(slug);
  const html = renderGuideMarkdown(markdown);
  const reserved = reservedHeadingIds(html);
  if (reserved.length > 0) {
    throw new Error(
      `${guide.file} has headings with ids the page uses itself: ${reserved.map((id) => `#${id}`).join(', ')}`,
    );
  }
  return renderToString(
    <StrictMode>
      <GuidePage guide={guide} html={html} />
    </StrictMode>,
  );
}
