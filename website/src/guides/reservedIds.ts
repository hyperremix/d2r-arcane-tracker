import { SECTION_LINKS } from '../components/SiteTitleBar';

/**
 * The element ids the pages use themselves: the title bar looks up its sections by id, and the
 * skip link and the "more" lists target theirs. A heading in a guide with one of these ids would
 * clash with them, so the build rejects it. A test checks that this lists every id the pages render,
 * apart from the home page's feature anchors, which never share a page with a guide.
 */
export const RESERVED_IDS: ReadonlySet<string> = new Set([
  ...SECTION_LINKS.map((section) => section.id),
  'root',
  'main',
  'top',
  'more-features',
  'more-guides',
]);

/** The ids of the headings in a guide's rendered HTML that are in RESERVED_IDS */
export function reservedHeadingIds(html: string): string[] {
  const ids = [...html.matchAll(/<h[1-6]\b[^>]*\bid="([^"]*)"/g)].map((match) => match[1]);
  return ids.filter((id) => RESERVED_IDS.has(id));
}
