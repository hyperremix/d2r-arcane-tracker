import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

const originalElectronAPI = window.electronAPI;

function setPlatform(platform: 'darwin' | 'win32' | 'linux') {
  Object.defineProperty(window, 'electronAPI', {
    value: { platform },
    configurable: true,
    writable: true,
  });
}

/** Returns the visually hidden or visible label element inside a nav link. */
function getLinkLabel(name: string) {
  return within(within(getNavigation()).getByRole('link', { name })).getByText(name);
}

describe('When TitleBar is rendered', () => {
  afterEach(() => {
    Object.defineProperty(window, 'electronAPI', {
      value: originalElectronAPI,
      configurable: true,
      writable: true,
    });
    vi.restoreAllMocks();
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
      'Terror zones',
      'Settings',
    ]);
  });

  it('Then the daily destinations come first and Terror zones and Settings follow as a separate group', () => {
    // Arrange & Act
    renderTitleBar();

    // Assert
    const [primary, secondary] = within(getNavigation()).getAllByRole('list');
    expect(
      within(primary)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Grail', 'Statistics', 'Runs', 'Runewords', 'Inventory']);
    expect(
      within(secondary)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Terror zones', 'Settings']);
  });

  it('Then primary link labels are visible from the lg breakpoint and hidden text below it', () => {
    // Arrange & Act
    renderTitleBar();

    // Assert
    for (const name of ['Grail', 'Statistics', 'Runs', 'Runewords', 'Inventory']) {
      expect(getLinkLabel(name)).toHaveClass('sr-only', 'lg:not-sr-only');
    }
  });

  it('Then Terror zones and Settings are icon-only links with an accessible name at every width', () => {
    // Arrange & Act
    renderTitleBar();

    // Assert
    for (const name of ['Terror zones', 'Settings']) {
      const label = getLinkLabel(name);
      expect(label).toHaveClass('sr-only');
      expect(label).not.toHaveClass('lg:not-sr-only');
    }
  });

  it('Then the logo is always shown and the app name uses the display font', () => {
    // Arrange & Act
    renderTitleBar();

    // Assert
    const banner = screen.getByRole('banner');
    const logo = banner.querySelector('img');
    expect(logo).toBeInTheDocument();
    expect(logo).not.toHaveClass('hidden');
    expect(screen.getByText('D2R Arcane Tracker')).toHaveClass('font-display');
  });

  it('If the platform is macOS, then the app name is shown from the lg breakpoint', () => {
    // Arrange
    setPlatform('darwin');

    // Act
    renderTitleBar();

    // Assert
    expect(screen.getByText('D2R Arcane Tracker')).toHaveClass('hidden', 'lg:block');
  });

  it('If the platform is Windows, then the app name waits for the xl breakpoint to leave room for the window controls', () => {
    // Arrange
    setPlatform('win32');

    // Act
    renderTitleBar();

    // Assert
    const name = screen.getByText('D2R Arcane Tracker');
    expect(name).toHaveClass('hidden', 'xl:block');
    expect(name).not.toHaveClass('lg:block');
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
