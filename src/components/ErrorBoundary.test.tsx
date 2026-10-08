import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ISSUE_TRACKER_URL } from '@/lib/links';
import { ErrorBoundary } from './ErrorBoundary';

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

function BrokenChild() {
  if (shouldThrow) {
    throw new Error('Child exploded');
  }
  return <p>Child recovered</p>;
}

function renderBoundary() {
  return render(
    <ErrorBoundary>
      <BrokenChild />
    </ErrorBoundary>,
  );
}

describe('When a component outside the router throws', () => {
  beforeEach(() => {
    shouldThrow = true;
    // React logs caught render errors; keep test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockElectronAPI.shell.openExternal.mockResolvedValue({ success: true });
    mockElectronAPI.update.getUpdateInfo.mockResolvedValue({
      currentVersion: '4.5.6',
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

  it('Then the error screen shows the error with recovery, copy and report actions', () => {
    // Arrange & Act
    renderBoundary();

    // Assert
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toHaveFocus();
    expect(screen.getByText('Error: Child exploded')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try to Recover' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload Application' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy Error Details' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Report Issue' })).toBeInTheDocument();
  });

  it('If the user copies the error details, Then the component stack is included', async () => {
    // Arrange
    renderBoundary();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Copy Error Details' }));

    // Assert
    expect(await screen.findByText('Error details copied to clipboard')).toBeInTheDocument();
    const report = mockClipboard.writeText.mock.calls[0][0] as string;
    expect(report).toContain('App Version: 4.5.6');
    expect(report).toContain('Error Message: Error: Child exploded');
    expect(report).toContain('Component Stack:');
    expect(report).toContain('BrokenChild');
  });

  it('If the user reports the issue, Then the issue tracker opens externally', async () => {
    // Arrange
    renderBoundary();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Report Issue' }));

    // Assert
    await waitFor(() =>
      expect(mockElectronAPI.shell.openExternal).toHaveBeenCalledWith(ISSUE_TRACKER_URL),
    );
  });

  it('If the main process reports the issue tracker could not be opened, Then a failure message is shown', async () => {
    // Arrange
    mockElectronAPI.shell.openExternal.mockResolvedValue({ success: false, error: 'no browser' });
    renderBoundary();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Report Issue' }));

    // Assert
    expect(await screen.findByText("Couldn't open the issue tracker")).toBeInTheDocument();
  });

  it('If opening the issue tracker rejects, Then a failure message is shown', async () => {
    // Arrange
    mockElectronAPI.shell.openExternal.mockRejectedValue(new Error('ipc failed'));
    renderBoundary();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Report Issue' }));

    // Assert
    expect(await screen.findByText("Couldn't open the issue tracker")).toBeInTheDocument();
  });

  it('If the Electron bridge is unavailable, Then reporting shows a failure message', async () => {
    // Arrange
    setElectronAPI(undefined);
    renderBoundary();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Report Issue' }));

    // Assert
    expect(await screen.findByText("Couldn't open the issue tracker")).toBeInTheDocument();
  });

  it('If the cause is fixed and the user tries to recover, Then the children render again', () => {
    // Arrange
    renderBoundary();
    shouldThrow = false;

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Try to Recover' }));

    // Assert
    expect(screen.getByText('Child recovered')).toBeInTheDocument();
  });
});
