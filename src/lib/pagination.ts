/** A gap in the page list, standing for the pages it hides. */
export type PageGap = 'gap-start' | 'gap-end';

/** Entry of a page list: a page number or a gap. */
export type PageListEntry = number | PageGap;

/** Most entries (pages and gaps) a page list shows, so its width stays stable while paging. */
const MAX_ENTRIES = 7;

/**
 * Returns the pages to offer for a paginated list: the first and last page and a window around
 * the current page, with gaps for the pages in between. The list always contains the current page.
 * @param currentPage - The current page (1-based)
 * @param totalPages - Number of pages
 * @returns The page numbers and gaps, in order
 */
export function getPageList(currentPage: number, totalPages: number): PageListEntry[] {
  if (totalPages <= MAX_ENTRIES) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const current = Math.max(1, Math.min(currentPage, totalPages));
  // Near either end a gap would hide a single page, so show a longer run of pages instead
  if (current <= 4) {
    return [1, 2, 3, 4, 5, 'gap-end', totalPages];
  }
  if (current >= totalPages - 3) {
    return [
      1,
      'gap-start',
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ];
  }
  return [1, 'gap-start', current - 1, current, current + 1, 'gap-end', totalPages];
}
