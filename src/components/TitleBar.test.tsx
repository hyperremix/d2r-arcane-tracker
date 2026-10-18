import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createBrowserRouter, createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TitleBar } from './TitleBar';

vi.mock('./grail/NotificationButton', () => ({
  NotificationButton: () => <button type="button">notifications</button>,
}));

const browserRouters: ReturnType<typeof createBrowserRouter>[] = [];

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

/**
 * Memory routers never touch `window.history`, but TitleBar reads
 * `window.history.length`. Because the test environment is shared (isolate: false)
 * and jsdom cannot shrink the real history stack, pin the length so memory-router
 * tests do not depend on entries left behind by other tests or files.
 */
function renderTitleBar(initialPath = '/') {
  vi.spyOn(window.history, 'length', 'get').mockReturnValue(1);
  const layout = (
    <>
      <TitleBar />
      <LocationProbe />
    </>
  );
  const router = createMemoryRouter(
    [
      '/',
      '/statistics',
      '/runs',
      '/runs/:id',
      '/runewords',
      '/inventory-browser',
      '/farming',
      '/terror-zones',
      '/settings',
    ].map((path) => ({
      path,
      element: layout,
    })),
    { initialEntries: [initialPath] },
  );
  return render(<RouterProvider router={router} />);
}

/**
 * Renders the title bar on a browser router so that `window.history` (which the
 * back/forward buttons read) reflects real navigation.
 */
function renderTitleBarWithBrowserHistory(initialPath: string) {
  // Real history is required here, so make sure no length stub is active.
  vi.restoreAllMocks();
  window.history.replaceState(undefined, '', initialPath);
  const layout = (
    <>
      <TitleBar />
      <LocationProbe />
    </>
  );
  const router = createBrowserRouter(
    ['/', '/statistics', '/runs'].map((path) => ({ path, element: layout })),
  );
  browserRouters.push(router);
  return render(<RouterProvider router={router} />);
}

function getNavigation() {
  return screen.getByRole('navigation', { name: 'Main navigation' });
}

/** Width of every destination and of the More trigger in {@link stubTitleBarLayout}. */
const ITEM_WIDTH = 100;
const MORE_WIDTH = 60;
const NAME_WIDTH = 150;
const LOGO_WIDTH = 20;

/**
 * jsdom has no layout, so stub the widths the title bar measures (each destination 100px, the
 * More trigger 60px, the app name 150px, the logo 20px; gaps are 0) and capture the
 * ResizeObserver callbacks to simulate resizing the window.
 * @returns A function that resizes the brand and navigation area
 */
function stubTitleBarLayout(initialRegionWidth: number) {
  let regionWidth = initialRegionWidth;
  const resizeCallbacks: ResizeObserverCallback[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const part = this.getAttribute('data-overflow-part');
    const widths: Record<string, number> = {
      item: ITEM_WIDTH,
      more: MORE_WIDTH,
      name: NAME_WIDTH,
      logo: LOGO_WIDTH,
    };
    const isRegion = this.querySelector(':scope > [data-overflow-part="logo"]') !== null;
    const width = isRegion ? regionWidth : part ? (widths[part] ?? 0) : 0;
    return DOMRect.fromRect({ width, height: 32 });
  });

  return (width: number) => {
    regionWidth = width;
    act(() => {
      for (const callback of resizeCallbacks) callback([], {} as ResizeObserver);
    });
  };
}

/** Returns the app name shown in the title bar, ignoring its invisible measuring copy. */
function queryVisibleAppName() {
  return (
    screen
      .queryAllByText('D2R Arcane Tracker')
      .find((element) => !element.closest('[aria-hidden="true"]')) ?? null
  );
}

function getLinkNames() {
  return within(getNavigation())
    .getAllByRole('link')
    .map((link) => link.textContent);
}

/** Returns the visually hidden or visible label element inside a nav link. */
function getLinkLabel(name: string) {
  return within(within(getNavigation()).getByRole('link', { name })).getByText(name);
}

describe('When TitleBar is rendered', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    for (const router of browserRouters.splice(0)) {
      router.dispose();
    }
    window.history.replaceState(undefined, '', '/');
  });

  it('Then it exposes a labeled navigation landmark with a link per destination', () => {
    // Arrange & Act
    renderTitleBar();

    // Assert
    const nav = getNavigation();
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Grail',
      'Statistics',
      'Runs',
      'Runewords',
      'Inventory',
      'Farming advisor',
      'Terror zones',
      'Settings',
    ]);
  });

  it('Then every destination comes first and Settings follows as a separate group', () => {
    // Arrange & Act
    renderTitleBar();

    // Assert
    const [destinations, utilities] = within(getNavigation()).getAllByRole('list');
    expect(
      within(destinations)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Grail',
      'Statistics',
      'Runs',
      'Runewords',
      'Inventory',
      'Farming advisor',
      'Terror zones',
    ]);
    expect(
      within(utilities)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Settings']);
  });

  it('Then every destination shows its label as visible text', () => {
    // Arrange & Act
    renderTitleBar();

    // Assert
    for (const name of [
      'Grail',
      'Statistics',
      'Runs',
      'Runewords',
      'Inventory',
      'Farming advisor',
      'Terror zones',
    ]) {
      expect(getLinkLabel(name)).not.toHaveClass('sr-only');
    }
  });

  it('Then the Terror zones link shows the terror zone emblem rather than a lucide icon', () => {
    // Arrange & Act
    renderTitleBar();

    // Assert
    const link = within(getNavigation()).getByRole('link', { name: 'Terror zones' });
    const icon = link.querySelector('svg');
    expect(icon).toHaveAttribute('viewBox', '12 12 198 208');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).not.toHaveClass('lucide');
  });

  it('Then Settings is an icon-only link with an accessible name', () => {
    // Arrange & Act
    renderTitleBar();

    // Assert
    expect(getLinkLabel('Settings')).toHaveClass('sr-only');
  });

  it('Then the logo is always shown and the app name uses the display font', () => {
    // Arrange & Act
    renderTitleBar();

    // Assert
    const banner = screen.getByRole('banner');
    const logo = banner.querySelector('img');
    expect(logo).toBeInTheDocument();
    expect(logo).not.toHaveClass('hidden');
    expect(queryVisibleAppName()).toHaveClass('font-display');
  });

  it('If the window fits every destination and the app name, then nothing moves into a More menu', () => {
    // Arrange
    stubTitleBarLayout(LOGO_WIDTH + 7 * ITEM_WIDTH + NAME_WIDTH);

    // Act
    renderTitleBar();

    // Assert
    expect(getLinkNames()).toHaveLength(8);
    expect(queryVisibleAppName()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
  });

  it('If the window fits every destination but not the app name, then only the logo is shown', () => {
    // Arrange
    stubTitleBarLayout(LOGO_WIDTH + 7 * ITEM_WIDTH + NAME_WIDTH - 1);

    // Act
    renderTitleBar();

    // Assert
    expect(getLinkNames()).toHaveLength(8);
    expect(queryVisibleAppName()).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
  });

  it('If the window is too narrow for every destination, then the last ones move into the More menu', async () => {
    // Arrange - four destinations and the More trigger fit
    stubTitleBarLayout(LOGO_WIDTH + 4 * ITEM_WIDTH + MORE_WIDTH);
    renderTitleBar();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'More' }));

    // Assert
    expect(getLinkNames()).toEqual(['Grail', 'Statistics', 'Runs', 'Runewords', 'Settings']);
    const menu = await screen.findByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Inventory', 'Farming advisor', 'Terror zones']);
  });

  it('If the current page is in the More menu, then the trigger shows the active state and the menu marks the page as current', async () => {
    // Arrange
    stubTitleBarLayout(LOGO_WIDTH + 4 * ITEM_WIDTH + MORE_WIDTH);
    renderTitleBar('/terror-zones');
    const trigger = screen.getByRole('button', { name: 'More' });

    // Act
    fireEvent.click(trigger);

    // Assert
    expect(trigger).toHaveClass('bg-accent');
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Terror zones' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Inventory' })).not.toHaveAttribute(
      'aria-current',
    );
    for (const link of within(getNavigation()).getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('If the current page is not in the More menu, then the trigger is not shown as active', () => {
    // Arrange
    stubTitleBarLayout(LOGO_WIDTH + 4 * ITEM_WIDTH + MORE_WIDTH);

    // Act
    renderTitleBar('/runs');

    // Assert
    expect(screen.getByRole('button', { name: 'More' })).not.toHaveClass('bg-accent');
  });

  it('If a destination in the More menu is chosen, then it navigates there', async () => {
    // Arrange
    stubTitleBarLayout(LOGO_WIDTH + 4 * ITEM_WIDTH + MORE_WIDTH);
    renderTitleBar('/');
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const menu = await screen.findByRole('menu');

    // Act
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Farming advisor' }));

    // Assert
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/farming'));
  });

  it('If the window grows again, then destinations move back out of the More menu', () => {
    // Arrange
    const resize = stubTitleBarLayout(LOGO_WIDTH + 4 * ITEM_WIDTH + MORE_WIDTH);
    renderTitleBar();

    // Act
    resize(LOGO_WIDTH + 7 * ITEM_WIDTH + NAME_WIDTH);

    // Assert
    expect(getLinkNames()).toHaveLength(8);
    expect(queryVisibleAppName()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More' })).not.toBeInTheDocument();
  });

  it('If an icon-only link receives keyboard focus, then its tooltip shows the label', async () => {
    // Arrange
    renderTitleBar();
    const link = within(getNavigation()).getByRole('link', { name: 'Settings' });

    // Act
    act(() => {
      link.focus();
    });

    // Assert
    expect(
      await screen.findByText('Settings', { selector: '[data-slot="tooltip-content"]' }),
    ).toBeInTheDocument();
  });

  it('If there is no history, then the labeled back and forward buttons are disabled', () => {
    // Arrange & Act
    renderTitleBar();

    // Assert
    expect(screen.getByRole('button', { name: 'Go back' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Go forward' })).toBeDisabled();
  });

  it('Then nav items do not rely on native title tooltips', () => {
    // Arrange & Act
    renderTitleBar();

    // Assert
    for (const link of within(getNavigation()).getAllByRole('link')) {
      expect(link).not.toHaveAttribute('title');
    }
  });

  it('If the current route is /runs, then only the Runs link has aria-current="page"', () => {
    // Arrange & Act
    renderTitleBar('/runs');

    // Assert
    const nav = getNavigation();
    expect(within(nav).getByRole('link', { name: 'Runs' })).toHaveAttribute('aria-current', 'page');
    const otherLinks = within(nav)
      .getAllByRole('link')
      .filter((link) => link.textContent !== 'Runs');
    for (const link of otherLinks) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('If the current route is /, then the Grail link is the active page', () => {
    // Arrange & Act
    renderTitleBar('/');

    // Assert
    expect(within(getNavigation()).getByRole('link', { name: 'Grail' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('If a nav link is clicked, then it navigates and marks the new destination as current', () => {
    // Arrange
    renderTitleBar('/');
    const nav = getNavigation();

    // Act
    fireEvent.click(within(nav).getByRole('link', { name: 'Terror zones' }));

    // Assert
    expect(screen.getByTestId('location')).toHaveTextContent('/terror-zones');
    expect(within(nav).getByRole('link', { name: 'Terror zones' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Grail' })).not.toHaveAttribute('aria-current');
  });

  it('If the current route is /inventory-browser, then the Inventory link is the active page', () => {
    // Arrange & Act
    renderTitleBar('/inventory-browser');

    // Assert
    expect(within(getNavigation()).getByRole('link', { name: 'Inventory' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('If the current route is a nested path like /runs/123, then the Runs link stays active', () => {
    // Arrange & Act
    renderTitleBar('/runs/123');

    // Assert
    const nav = getNavigation();
    expect(within(nav).getByRole('link', { name: 'Runs' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Grail' })).not.toHaveAttribute('aria-current');
  });

  it('If the current route is /runs, then the root Grail link is not active', () => {
    // Arrange & Act
    renderTitleBar('/runs');

    // Assert
    expect(within(getNavigation()).getByRole('link', { name: 'Grail' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('If the user navigates to a new route, then back is enabled and after going back forward is enabled', async () => {
    // Arrange
    renderTitleBarWithBrowserHistory('/');
    const nav = getNavigation();
    const back = screen.getByRole('button', { name: 'Go back' });
    const forward = screen.getByRole('button', { name: 'Go forward' });

    // Act - navigate to a new route
    fireEvent.click(within(nav).getByRole('link', { name: 'Statistics' }));

    // Assert - back is enabled, forward is not
    await waitFor(() => expect(back).toBeEnabled());
    expect(forward).toBeDisabled();

    // Act - go back
    fireEvent.click(back);

    // Assert - now at the start, so back is disabled and forward is enabled
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/'));
    await waitFor(() => expect(forward).toBeEnabled());
    expect(back).toBeDisabled();
  });
});
