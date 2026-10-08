import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, Link, RouterProvider, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { Statistics } from './Statistics';

vi.mock('./StatsDashboard', () => ({
  StatsDashboard: () => <div>grail dashboard</div>,
}));

vi.mock('./RunAnalytics', () => ({
  RunAnalytics: () => <div>run analytics</div>,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderStatistics(initialPath = '/statistics') {
  const router = createMemoryRouter(
    [
      {
        path: '/statistics',
        element: (
          <>
            <Statistics />
            <LocationProbe />
          </>
        ),
      },
      {
        path: '/runs',
        element: (
          <>
            <Link to="/statistics">statistics</Link>
            <LocationProbe />
          </>
        ),
      },
    ],
    { initialEntries: [initialPath] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('When the Statistics page is rendered', () => {
  it('Then it shows a single translated page heading', () => {
    // Arrange & Act
    renderStatistics();

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Statistics' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('If no tab is in the URL, Then the grail statistics tab is selected', () => {
    // Arrange & Act
    renderStatistics();

    // Assert
    expect(screen.getByRole('tab', { name: 'Grail Statistics' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('grail dashboard')).toBeInTheDocument();
  });

  it('If the URL contains ?tab=runs, Then the run statistics tab is selected', () => {
    // Arrange & Act
    renderStatistics('/statistics?tab=runs');

    // Assert
    expect(screen.getByRole('tab', { name: 'Run Statistics' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('run analytics')).toBeInTheDocument();
  });

  it('If the URL contains an unknown tab, Then it falls back to the grail statistics tab', () => {
    // Arrange & Act
    renderStatistics('/statistics?tab=unknown');

    // Assert
    expect(screen.getByRole('tab', { name: 'Grail Statistics' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});

describe('When the user switches statistics tabs', () => {
  it('Then the selected tab is written to the URL and removed again for the default tab', () => {
    // Arrange
    renderStatistics();

    // Act
    fireEvent.click(screen.getByRole('tab', { name: 'Run Statistics' }));

    // Assert
    expect(screen.getByTestId('location')).toHaveTextContent('/statistics?tab=runs');
    expect(screen.getByText('run analytics')).toBeInTheDocument();

    // Act
    fireEvent.click(screen.getByRole('tab', { name: 'Grail Statistics' }));

    // Assert
    expect(screen.getByTestId('location').textContent).toBe('/statistics');
  });

  it('If the user navigates away and back, Then the previously selected tab is restored', async () => {
    // Arrange
    const router = renderStatistics();
    fireEvent.click(screen.getByRole('tab', { name: 'Run Statistics' }));

    // Act
    await router.navigate('/runs');
    await router.navigate(-1);

    // Assert
    expect(await screen.findByText('run analytics')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/statistics?tab=runs');
    expect(screen.getByRole('tab', { name: 'Run Statistics' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
