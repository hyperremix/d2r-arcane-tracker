import { fireEvent, render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { TitleBar } from './TitleBar';

vi.mock('./grail/NotificationButton', () => ({
  NotificationButton: () => <button type="button">notifications</button>,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderTitleBar(initialPath = '/') {
  const layout = (
    <>
      <TitleBar />
      <LocationProbe />
    </>
  );
  const router = createMemoryRouter(
    ['/', '/statistics', '/runs', '/runewords', '/terror-zones', '/settings'].map((path) => ({
      path,
      element: layout,
    })),
    { initialEntries: [initialPath] },
  );
  return render(<RouterProvider router={router} />);
}

function getNavigation() {
  return screen.getByRole('navigation', { name: 'Main navigation' });
}

describe('When TitleBar is rendered', () => {
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
});
