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
    ['/', '/statistics', '/runs', '/runs/:id', '/runewords', '/terror-zones', '/settings'].map(
      (path) => ({
        path,
        element: layout,
      }),
    ),
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

describe('When TitleBar is rendered', () => {
  afterEach(() => {
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
      'Inventory Browser',
      'Terror Zones',
      'Settings',
    ]);
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
    fireEvent.click(within(nav).getByRole('link', { name: 'Terror Zones' }));

    // Assert
    expect(screen.getByTestId('location')).toHaveTextContent('/terror-zones');
    expect(within(nav).getByRole('link', { name: 'Terror Zones' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Grail' })).not.toHaveAttribute('aria-current');
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
