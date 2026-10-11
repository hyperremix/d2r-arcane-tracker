import { useCallback, useEffect, useState } from 'react';

export interface HashSelection<T extends string> {
  selected: T;
  /** Selects an id without scrolling, e.g. when its tab is clicked */
  select: (id: T) => void;
  /** Selects an id and scrolls its element into view, e.g. when a link to it is clicked */
  show: (id: T) => void;
}

/**
 * A selection that the URL hash can set, so `#id` links open a tab. When the page loads with or
 * changes to a hash that is one of `ids`, that id is selected and the element with that id is
 * scrolled into view once it is shown. `ids` must be a stable array.
 */
export function useHashSelection<T extends string>(
  ids: readonly T[],
  initial: T,
): HashSelection<T> {
  const [selected, setSelected] = useState<T>(initial);
  // An object, so showing the same id again scrolls to it again
  const [scrollTarget, setScrollTarget] = useState<{ id: T } | undefined>(undefined);

  const show = useCallback((id: T) => {
    setSelected(id);
    setScrollTarget({ id });
  }, []);

  useEffect(() => {
    const showFromHash = () => {
      const hash = window.location.hash.slice(1);
      const id = ids.find((candidate) => candidate === hash);
      if (id !== undefined) show(id);
    };

    showFromHash();
    window.addEventListener('hashchange', showFromHash);
    return () => {
      window.removeEventListener('hashchange', showFromHash);
    };
  }, [ids, show]);

  // Scroll after the render that shows the element: a hidden element can't be scrolled to
  useEffect(() => {
    if (scrollTarget === undefined) return;
    document.getElementById(scrollTarget.id)?.scrollIntoView({ block: 'start' });
  }, [scrollTarget]);

  return { selected, select: setSelected, show };
}
