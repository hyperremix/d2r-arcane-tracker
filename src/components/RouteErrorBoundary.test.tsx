import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, Link, Outlet, RouterProvider } from 'react-router';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ISSUE_TRACKER_URL } from '@/lib/links';
import { RouteErrorBoundary } from './RouteErrorBoundary';

const mockElectronAPI = {
  shell: { openExternal: vi.fn() },
  update: { getUpdateInfo: vi.fn() },
};
const mockClipboard = { writeText: vi.fn() };

const originalElectronAPI: unknown = window.electronAPI;
const originalClipboard = navigator.clipboard;

// Assign rather than redefine: other suites define `window.electronAPI` as non-configurable.
function setElectronAPI(value: unknown) {
  (window as unknown as { electronAPI: unknown }).electronAPI = value;
}

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, writable: true, configurable: true });
}

let shouldThrow = true;

function BrokenPage() {
  if (shouldThrow) {
    throw new Error('Page exploded');
  }
  return <p>Broken page recovered</p>;
}

function HealthyPage() {
  return <p>Healthy page content</p>;
}

function Layout() {
  return (
    <div>
      <nav aria-label="Test navigation">
        <Link to="/healthy">Go to healthy page</Link>
      </nav>
      <Outlet />
    </div>
  );
}

/**
 * Mirrors the app router: a root layout with a pathless child route that owns
 * the page error element, so the layout stays mounted when a page throws.
 */
function renderRouter(initialPath = '/broken') {
  const router = createMemoryRouter(
    [
      {
        element: <Layout />,
        errorElement: <RouteErrorBoundary fullScreen />,
        children: [
          {
            errorElement: <RouteErrorBoundary />,
            children: [
              { path: '/broken', Component: BrokenPage },
              { path: '/healthy', Component: HealthyPage },
            ],
          },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('When a routed page throws while rendering', () => {
  beforeEach(() => {
    shouldThrow = true;
    // React and React Router log caught render errors; keep test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockElectronAPI.shell.openExternal.mockResolvedValue({ success: true });
    mockElectronAPI.update.getUpdateInfo.mockResolvedValue({
      currentVersion: '1.2.3',
      status: {},
    });
    mockClipboard.writeText.mockResolvedValue(undefined);
    setElectronAPI(mockElectronAPI);
    setClipboard(mockClipboard);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
    setClipboard(originalClipboard);
  });

  it('Then the in-app error screen renders inside the layout with recovery actions', () => {
    // Arrange & Act
    renderRouter();

    // Assert
    const heading = screen.getByRole('heading', { name: 'Something went wrong' });
    expect(heading).toHaveFocus();
    expect(screen.getByText(/This page ran into an unexpected error/)).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Test navigation' })).toBeInTheDocument();
    expect(screen.getByText('Error: Page exploded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try to Recover' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload Application' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Error Details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report Issue' })).toBeInTheDocument();
    expect(screen.queryByText(/Unexpected Application Error/)).not.toBeInTheDocument();
  });

  it('If the user copies the error details, Then the message, stack and app version are written to the clipboard', async () => {
    // Arrange
    renderRouter();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Copy Error Details' }));

    // Assert
    expect(await screen.findByText('Error details copied to clipboard')).toBeInTheDocument();
    expect(mockClipboard.writeText).toHaveBeenCalledTimes(1);
    const report = mockClipboard.writeText.mock.calls[0][0] as string;
    expect(report).toContain('App Version: 1.2.3');
    expect(report).toContain('Error Message: Error: Page exploded');
    expect(report).toContain('Stack Trace:');
    expect(report).toContain('BrokenPage');
  });

  it('If the app version is unavailable, Then the copied report still includes the error', async () => {
    // Arrange
    mockElectronAPI.update.getUpdateInfo.mockRejectedValue(new Error('IPC down'));
    renderRouter();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Copy Error Details' }));

    // Assert
    await waitFor(() => expect(mockClipboard.writeText).toHaveBeenCalledTimes(1));
    const report = mockClipboard.writeText.mock.calls[0][0] as string;
    expect(report).toContain('App Version: Unknown');
    expect(report).toContain('Error Message: Error: Page exploded');
  });

  it('If writing to the clipboard fails, Then a failure message is announced', async () => {
    // Arrange
    mockClipboard.writeText.mockRejectedValue(new Error('denied'));
    renderRouter();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Copy Error Details' }));

    // Assert
    expect(await screen.findByRole('status')).toHaveTextContent("Couldn't copy the error details");
  });

  it('If the user reports the issue, Then the issue tracker opens externally', async () => {
    // Arrange
    renderRouter();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Report Issue' }));

    // Assert
    await waitFor(() =>
      expect(mockElectronAPI.shell.openExternal).toHaveBeenCalledWith(ISSUE_TRACKER_URL),
    );
  });

  it('If the user navigates to another page from the layout, Then that page renders normally', async () => {
    // Arrange
    renderRouter();

    // Act
    fireEvent.click(screen.getByRole('link', { name: 'Go to healthy page' }));

    // Assert
    expect(await screen.findByText('Healthy page content')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Something went wrong' })).not.toBeInTheDocument();
  });

  it('If the cause is fixed and the user tries again, Then the same page renders again', async () => {
    // Arrange
    const router = renderRouter();
    shouldThrow = false;

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Try to Recover' }));

    // Assert
    expect(await screen.findByText('Broken page recovered')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/broken');
  });

  it('If the layout itself throws, Then the full-screen error screen renders', () => {
    // Arrange
    function BrokenLayout(): never {
      throw new Error('Layout exploded');
    }
    const router = createMemoryRouter(
      [
        {
          Component: BrokenLayout,
          errorElement: <RouteErrorBoundary fullScreen />,
          children: [{ path: '/', Component: HealthyPage }],
        },
      ],
      { initialEntries: ['/'] },
    );

    // Act
    render(<RouterProvider router={router} />);

    // Assert
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByText('Error: Layout exploded')).toBeInTheDocument();
    expect(screen.queryByText(/This page ran into an unexpected error/)).not.toBeInTheDocument();
  });
});
