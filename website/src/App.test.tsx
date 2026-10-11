import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { links } from './content';

interface PageScroll {
  innerHeight: number;
  scrollY: number;
  scrollHeight: number;
  /** Top edge of each section, in px from the top of the viewport */
  sectionTops: Record<string, number>;
}

/** Fakes the page geometry, fires a scroll event and waits for the frame that measures it. */
async function scrollPage({ innerHeight, scrollY, scrollHeight, sectionTops }: PageScroll) {
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(innerHeight);
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(scrollY);
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(scrollHeight);
  for (const [id, top] of Object.entries(sectionTops)) {
    const section = document.getElementById(id);
    if (!section) throw new Error(`Section #${id} not found`);
    vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect);
  }
  await act(async () => {
    window.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  });
}

describe('When the website is rendered', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Then the main download button links to the latest release', () => {
    // Arrange / Act
    render(<App />);

    // Assert
    expect(screen.getByRole('link', { name: 'Download for Windows' })).toHaveAttribute(
      'href',
      links.latestRelease,
    );
  });

  it('Then every title bar section link points to a section on the page', () => {
    // Arrange / Act
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });

    // Assert
    for (const name of ['Features', 'Install', 'Guides']) {
      const href = within(nav).getByRole('link', { name }).getAttribute('href') ?? '';
      expect(href).toMatch(/^#/);
      expect(document.getElementById(href.slice(1))).not.toBeNull();
    }
  });

  it('If a tab of the feature tour is selected, then its page is shown', () => {
    // Arrange
    render(<App />);

    // Act
    fireEvent.click(screen.getByRole('tab', { name: 'Statistics' }));

    // Assert
    expect(screen.getByRole('tab', { name: 'Statistics' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('heading', { name: 'Statistics', level: 3 })).toBeVisible();
  });

  it('If a section heading has scrolled into view, then its title bar link is marked as current', async () => {
    // Arrange
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });

    // Act: install starts in the upper two thirds of the viewport, guides below them
    await scrollPage({
      innerHeight: 1000,
      scrollY: 3000,
      scrollHeight: 6000,
      sectionTops: { features: -2000, install: 600, guides: 1500 },
    });

    // Assert
    expect(within(nav).getByRole('link', { name: 'Install' })).toHaveAttribute(
      'aria-current',
      'location',
    );
    expect(within(nav).getByRole('link', { name: 'Features' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('link', { name: 'Guides' })).not.toHaveAttribute('aria-current');
  });

  it('If the page is scrolled to the bottom, then the last section link is marked as current', async () => {
    // Arrange
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });

    // Act: guides still starts below two thirds of the viewport, but the page can't scroll further
    await scrollPage({
      innerHeight: 1000,
      scrollY: 5000,
      scrollHeight: 6000,
      sectionTops: { features: -4000, install: -1500, guides: 800 },
    });

    // Assert
    expect(within(nav).getByRole('link', { name: 'Guides' })).toHaveAttribute(
      'aria-current',
      'location',
    );
    expect(within(nav).getByRole('link', { name: 'Install' })).not.toHaveAttribute('aria-current');
  });

  it('If the reader is still in the hero, then no title bar link is marked as current', async () => {
    // Arrange
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });

    // Act
    await scrollPage({
      innerHeight: 1000,
      scrollY: 100,
      scrollHeight: 6000,
      sectionTops: { features: 900, install: 3000, guides: 4000 },
    });

    // Assert
    for (const name of ['Features', 'Install', 'Guides']) {
      expect(within(nav).getByRole('link', { name })).not.toHaveAttribute('aria-current');
    }
  });
});
