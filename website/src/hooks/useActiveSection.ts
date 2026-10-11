import { useEffect, useState } from 'react';

/**
 * How far down the viewport (as a share of its height) a section's top must have scrolled for the
 * section to count as current. Sections start with generous padding, so a lower line marks a
 * section as its heading comes into view rather than once it fills the screen.
 */
const ACTIVATION_LINE = 2 / 3;

/** Distance from the end of the page (px) that still counts as scrolled to the bottom. */
const BOTTOM_TOLERANCE = 2;

/**
 * Returns the id of the section the reader is in: the last of `ids` whose top has scrolled above
 * {@link ACTIVATION_LINE}, or the last section once the page is scrolled to the bottom (a short
 * final section may never reach the line). `undefined` while above the first of them (the hero).
 */
export function useActiveSection(ids: readonly string[]): string | undefined {
  const [activeId, setActiveId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => section !== null);
    if (sections.length === 0) return;

    const update = () => {
      const { innerHeight, scrollY } = window;
      const atBottom =
        innerHeight + scrollY >= document.documentElement.scrollHeight - BOTTOM_TOLERANCE;
      if (atBottom && scrollY > 0) {
        setActiveId(sections[sections.length - 1].id);
        return;
      }
      const line = innerHeight * ACTIVATION_LINE;
      const passed = sections.filter((section) => section.getBoundingClientRect().top <= line);
      setActiveId(passed[passed.length - 1]?.id);
    };

    // Measure at most once per frame while scrolling or resizing
    let frame: number | undefined;
    const scheduleUpdate = () => {
      if (frame !== undefined) return;
      frame = window.requestAnimationFrame(() => {
        frame = undefined;
        update();
      });
    };

    update();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [ids]);

  return activeId;
}
