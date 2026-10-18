import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * Widths (in px) that decide how much of the title bar navigation fits.
 */
interface TitleBarOverflowInput {
  /** Width left for the app name and the destination list once the fixed parts are taken out. */
  availableWidth: number;
  /** Width of the app name next to the logo. */
  nameWidth: number;
  /** Widths of the destinations, in display order. */
  itemWidths: number[];
  /** Width of the More menu trigger. */
  moreWidth: number;
  /** Gap between the entries of the destination list. */
  listGap: number;
  /** Gap between the app name and its neighbours. */
  nameGap: number;
}

/**
 * How the title bar fits into the available width.
 */
interface TitleBarOverflow {
  /** Number of leading destinations shown in the bar; the rest go into the More menu. */
  visibleCount: number;
  /** Whether the app name is shown next to the logo. */
  showName: boolean;
}

/**
 * Decides which parts of the title bar navigation fit. The app name collapses first; then whole
 * destinations move into the More menu, starting with the last one.
 * @returns The number of visible destinations and whether the app name is shown
 */
export function getTitleBarOverflow({
  availableWidth,
  nameWidth,
  itemWidths,
  moreWidth,
  listGap,
  nameGap,
}: TitleBarOverflowInput): TitleBarOverflow {
  const listWidth = (widths: number[]) =>
    widths.reduce((sum, width) => sum + width, 0) + listGap * Math.max(widths.length - 1, 0);

  const allItemsWidth = listWidth(itemWidths);
  if (allItemsWidth + nameGap + nameWidth <= availableWidth) {
    return { visibleCount: itemWidths.length, showName: true };
  }
  if (allItemsWidth <= availableWidth) {
    return { visibleCount: itemWidths.length, showName: false };
  }
  for (let count = itemWidths.length - 1; count > 0; count--) {
    if (listWidth([...itemWidths.slice(0, count), moreWidth]) <= availableWidth) {
      return { visibleCount: count, showName: false };
    }
  }
  return { visibleCount: 0, showName: false };
}

/** Marks the title bar elements that {@link useTitleBarOverflow} measures. */
type TitleBarOverflowPart = 'logo' | 'nav' | 'list' | 'item' | 'more' | 'name';

function getGap(element: Element | null): number {
  return element ? Number.parseFloat(getComputedStyle(element).columnGap) || 0 : 0;
}

/**
 * Measures the title bar and decides how much of its navigation fits, again whenever the bar or
 * the measured labels change size (window resize, font load, language change).
 *
 * Expects, inside the element of `regionRef` (a flex row of the logo, the app name and the
 * navigation): the live `logo`, `nav` (everything right of the brand) and `list` (the destination
 * list inside `nav`) parts, and inside the element of `measureRef` an invisible copy of every
 * `item`, the `more` trigger and the `name`, each marked with `data-overflow-part`.
 * @returns Refs for the measured elements and the current overflow
 */
export function useTitleBarOverflow(itemCount: number) {
  const regionRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<TitleBarOverflow>({
    visibleCount: itemCount,
    showName: true,
  });

  const measure = useCallback(() => {
    const region = regionRef.current;
    const replica = measureRef.current;
    if (!region || !replica) return;

    const find = (root: Element, part: TitleBarOverflowPart) =>
      root.querySelector(`[data-overflow-part="${part}"]`);
    const width = (element: Element | null) => element?.getBoundingClientRect().width ?? 0;

    const regionGap = getGap(region);
    const nav = find(region, 'nav');
    const list = find(region, 'list');
    const next = getTitleBarOverflow({
      availableWidth:
        width(region) - width(find(region, 'logo')) - regionGap - (width(nav) - width(list)),
      nameWidth: width(find(replica, 'name')),
      itemWidths: Array.from(replica.querySelectorAll('[data-overflow-part="item"]'), width),
      moreWidth: width(find(replica, 'more')),
      listGap: getGap(list),
      nameGap: regionGap,
    });
    setOverflow((current) =>
      current.visibleCount === next.visibleCount && current.showName === next.showName
        ? current
        : next,
    );
  }, []);

  useLayoutEffect(() => {
    measure();
    if (typeof ResizeObserver === 'undefined' || !regionRef.current || !measureRef.current) {
      return;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(regionRef.current);
    observer.observe(measureRef.current);
    return () => observer.disconnect();
  }, [measure]);

  return { regionRef, measureRef, overflow };
}
