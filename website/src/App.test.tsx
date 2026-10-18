import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { features, links } from './content';

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

/** Sets the URL hash without the browser's hashchange event (as when the page is opened). */
function setHash(hash: string) {
  window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
}

describe('When the website is rendered', () => {
  const scrollIntoViewMock = vi.fn();
  const originalScrollIntoView = Element.prototype.scrollIntoView;

  beforeEach(() => {
    scrollIntoViewMock.mockClear();
    Element.prototype.scrollIntoView = scrollIntoViewMock;
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
    setHash('');
    vi.restoreAllMocks();
  });

  it('Then the main heading names the app and what it is', () => {
    // Arrange / Act
    render(<App />);

    // Assert
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'D2R Arcane Tracker – Holy Grail tracker for Diablo II: Resurrected',
      }),
    ).toBeInTheDocument();
  });

  it('Then the main download button links to the latest release', () => {
    // Arrange / Act
    render(<App />);

    // Assert
    expect(screen.getByRole('link', { name: 'Download for Windows and Linux' })).toHaveAttribute(
      'href',
      links.latestRelease,
    );
  });

  it('Then every title bar section link points to a section on the page', () => {
    // Arrange / Act
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });

    // Assert
    for (const name of ['Features', 'Install', 'FAQ', 'Guides']) {
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

  it('Then every feature is summarized outside the tabs and links to its own anchor', () => {
    // Arrange / Act
    render(<App />);

    // Assert
    for (const feature of features) {
      const summary = screen.getByText(feature.summary);
      expect(summary).toBeVisible();
      expect(summary.closest('[role="tabpanel"]')).toBeNull();
      expect(summary.closest('a')).toHaveAttribute('href', `#${feature.id}`);
      expect(document.getElementById(feature.id)).not.toBeNull();
    }
  });

  it('If a feature in the summary is clicked, then its tab is selected and scrolled into view', () => {
    // Arrange
    render(<App />);
    const runTracker = features.find((feature) => feature.id === 'run-tracker');
    if (!runTracker) throw new Error('Run Tracker feature not found');

    // Following the link would add an entry to jsdom's history, which the test files run after
    // this one share (the app's TitleBar tests count history entries), so only the click is tested.
    const preventNavigation = (event: Event) => event.preventDefault();
    document.addEventListener('click', preventNavigation);

    // Act
    fireEvent.click(screen.getByText(runTracker.summary));
    document.removeEventListener('click', preventNavigation);

    // Assert
    expect(screen.getByRole('tab', { name: 'Runs' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Run Tracker', level: 3 })).toBeVisible();
    expect(scrollIntoViewMock.mock.contexts).toContain(document.getElementById('run-tracker'));
  });

  it('If the page is opened with the anchor of a feature, then its tab is selected and scrolled into view', () => {
    // Arrange
    setHash('#runeword-calculator');

    // Act
    render(<App />);

    // Assert
    expect(screen.getByRole('tab', { name: 'Runewords' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Runeword Calculator', level: 3 })).toBeVisible();
    expect(scrollIntoViewMock.mock.contexts).toContain(
      document.getElementById('runeword-calculator'),
    );
  });

  it('If the URL hash changes to the anchor of a feature, then its tab is selected', () => {
    // Arrange
    render(<App />);

    // Act
    act(() => {
      setHash('#inventory-browser');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    // Assert
    expect(screen.getByRole('tab', { name: 'Inventory' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Inventory Browser', level: 3 })).toBeVisible();
  });

  it('If the page is opened with the anchor of a section, then the first feature tab stays selected and nothing is scrolled', () => {
    // Arrange
    setHash('#install');

    // Act
    render(<App />);

    // Assert
    expect(screen.getByRole('tab', { name: 'Grail' })).toHaveAttribute('aria-selected', 'true');
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
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
      sectionTops: { features: -2000, install: 600, faq: 1200, guides: 1500 },
    });

    // Assert
    expect(within(nav).getByRole('link', { name: 'Install' })).toHaveAttribute(
      'aria-current',
      'location',
    );
    expect(within(nav).getByRole('link', { name: 'Features' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('link', { name: 'Guides' })).not.toHaveAttribute('aria-current');
  });

  it('If the FAQ heading has scrolled into view, then the FAQ title bar link is marked as current', async () => {
    // Arrange
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });

    // Act: the FAQ starts in the upper two thirds of the viewport, guides below them
    await scrollPage({
      innerHeight: 1000,
      scrollY: 4000,
      scrollHeight: 7000,
      sectionTops: { features: -3000, install: -1000, faq: 500, guides: 2000 },
    });

    // Assert
    expect(within(nav).getByRole('link', { name: 'FAQ' })).toHaveAttribute(
      'aria-current',
      'location',
    );
    expect(within(nav).getByRole('link', { name: 'Install' })).not.toHaveAttribute('aria-current');
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
      sectionTops: { features: -4000, install: -1500, faq: -500, guides: 800 },
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
      sectionTops: { features: 900, install: 3000, faq: 3500, guides: 4000 },
    });

    // Assert
    for (const name of ['Features', 'Install', 'FAQ', 'Guides']) {
      expect(within(nav).getByRole('link', { name })).not.toHaveAttribute('aria-current');
    }
  });
});
