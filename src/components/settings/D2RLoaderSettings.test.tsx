import { act, fireEvent, render, screen } from '@testing-library/react';
import type { D2RLoaderInstallation, D2RLoaderStatus } from 'electron/types/d2rLoader';
import type { Settings } from 'electron/types/grail';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { createMainEventsMock } from '@/test/mainEventsMock';
import { D2RLoaderSettings } from './D2RLoaderSettings';

vi.mock('@/stores/grailStore');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const originalElectronAPI = window.electronAPI;
const mainEvents = createMainEventsMock();

const WAITING: D2RLoaderStatus = { enabled: true, listening: true, port: 41733, connected: false };

const INSTALLED: D2RLoaderInstallation = {
  gameFolder: 'C:/Games/Diablo II Resurrected',
  loaderFound: true,
  pluginBundled: true,
  pluginInstalled: true,
  pluginUpToDate: true,
  configured: true,
};

function setupGrailStore(settings: Partial<Settings>) {
  const storeState = { settings, setSettings: vi.fn().mockResolvedValue(undefined) };
  vi.mocked(useGrailStore).mockImplementation((selector?: unknown) => {
    if (typeof selector === 'function') {
      return (selector as (s: typeof storeState) => unknown)(storeState);
    }
    return storeState as unknown as ReturnType<typeof useGrailStore>;
  });
  return storeState;
}

function setupElectronAPI(installation: D2RLoaderInstallation, status = WAITING) {
  const d2rLoader = {
    getStatus: vi.fn().mockResolvedValue(status),
    getInstallation: vi.fn().mockResolvedValue(installation),
    installPlugin: vi.fn(),
    uninstallPlugin: vi.fn(),
    importRunCounter: vi.fn(),
  };
  window.electronAPI = { on: mainEvents.on, d2rLoader } as unknown as typeof window.electronAPI;
  return d2rLoader;
}

async function renderSettings() {
  // Flush the mount-time IPC requests inside act
  return await act(async () => render(<D2RLoaderSettings />));
}

describe('When D2RLoaderSettings is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mainEvents.reset();
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
  });

  it('If the connection is off, Then only the switch and the Run Counter import are offered', async () => {
    // Arrange
    setupGrailStore({ d2rLoaderBridge: false });
    setupElectronAPI(INSTALLED, { ...WAITING, enabled: false, listening: false });

    // Act
    await renderSettings();

    // Assert
    expect(screen.getByRole('switch', { name: 'Connect with the plugin' })).not.toBeChecked();
    expect(screen.queryByLabelText('Port')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove plugin' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import Run Counter history' })).toBeEnabled();
  });

  it('If the switch is turned on, Then the connection setting is saved', async () => {
    // Arrange
    const store = setupGrailStore({ d2rLoaderBridge: false });
    setupElectronAPI(INSTALLED);
    await renderSettings();

    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('switch', { name: 'Connect with the plugin' }));
    });

    // Assert
    expect(store.setSettings).toHaveBeenCalledWith({ d2rLoaderBridge: true });
  });

  it('If the plugin connects, Then the status line follows the pushed status', async () => {
    // Arrange
    setupGrailStore({ d2rLoaderBridge: true });
    setupElectronAPI(INSTALLED);
    await renderSettings();
    const waitingBefore = screen.queryByText('Waiting for the plugin. Start D2R with D2RLoader.');

    // Act
    await act(async () => {
      mainEvents.emit('d2rLoader:status', { ...WAITING, connected: true, pluginVersion: '1.0.0' });
    });

    // Assert
    expect(waitingBefore).toBeInTheDocument();
    expect(
      screen.queryByText('Waiting for the plugin. Start D2R with D2RLoader.'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Connected to plugin 1.0.0.')).toBeInTheDocument();
  });

  it('If the port is used by another program, Then the error names the port', async () => {
    // Arrange
    setupGrailStore({ d2rLoaderBridge: true });
    setupElectronAPI(INSTALLED, { ...WAITING, listening: false, error: 'portInUse' });

    // Act
    await renderSettings();

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      'Port 41733 is used by another program. Choose another port.',
    );
  });

  it('If an invalid port is entered, Then it is flagged and not saved', async () => {
    // Arrange
    const store = setupGrailStore({ d2rLoaderBridge: true, d2rLoaderPort: 41733 });
    setupElectronAPI(INSTALLED);
    await renderSettings();
    const port = screen.getByLabelText('Port');

    // Act
    fireEvent.change(port, { target: { value: '80' } });
    await act(async () => {
      fireEvent.blur(port);
    });

    // Assert
    expect(port).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Enter a port from 1024 to 65535.')).toBeInTheDocument();
    expect(store.setSettings).not.toHaveBeenCalled();
  });

  it('If a valid port is entered, Then it is saved when the field is left', async () => {
    // Arrange
    const store = setupGrailStore({ d2rLoaderBridge: true, d2rLoaderPort: 41733 });
    setupElectronAPI(INSTALLED);
    await renderSettings();
    const port = screen.getByLabelText('Port');

    // Act
    fireEvent.change(port, { target: { value: '41800' } });
    await act(async () => {
      fireEvent.blur(port);
    });

    // Assert
    expect(store.setSettings).toHaveBeenCalledWith({ d2rLoaderPort: 41800 });
  });

  it.each([
    [
      'D2RLoader is missing',
      { ...INSTALLED, loaderFound: false, pluginInstalled: false },
      undefined,
    ],
    [
      'the plugin is not installed',
      { ...INSTALLED, pluginInstalled: false, pluginUpToDate: false },
      'Install plugin',
    ],
    [
      'another plugin version is installed',
      { ...INSTALLED, pluginUpToDate: false },
      'Update plugin',
    ],
    [
      'the plugin lacks the connection settings',
      { ...INSTALLED, configured: false },
      'Connect plugin',
    ],
    ['the plugin is installed and connected', INSTALLED, undefined],
  ])('If %s, Then the plugin action is %s', async (_, installation, action) => {
    // Arrange
    setupGrailStore({ d2rLoaderBridge: true });
    setupElectronAPI(installation);

    // Act
    await renderSettings();

    // Assert
    for (const name of ['Install plugin', 'Update plugin', 'Connect plugin']) {
      const button = screen.queryByRole('button', { name });
      if (name === action) {
        expect(button).toBeInTheDocument();
      } else {
        expect(button).not.toBeInTheDocument();
      }
    }
  });

  it('If installing is declined at the administrator prompt, Then an error explains it', async () => {
    // Arrange
    setupGrailStore({ d2rLoaderBridge: true });
    const notInstalled = { ...INSTALLED, pluginInstalled: false, pluginUpToDate: false };
    const d2rLoader = setupElectronAPI(notInstalled);
    d2rLoader.installPlugin.mockResolvedValue({ installation: notInstalled, canceled: true });
    await renderSettings();

    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install plugin' }));
    });

    // Assert
    expect(toast.error).toHaveBeenCalledWith(
      'Nothing was changed. Writing to the D2R folder needs administrator rights, and the request was declined or failed.',
    );
  });

  it('If the plugin is installed, Then the success message asks to restart D2R', async () => {
    // Arrange
    setupGrailStore({ d2rLoaderBridge: true });
    const d2rLoader = setupElectronAPI({ ...INSTALLED, pluginInstalled: false });
    d2rLoader.installPlugin.mockResolvedValue({ installation: INSTALLED });
    await renderSettings();

    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install plugin' }));
    });

    // Assert
    expect(toast.success).toHaveBeenCalledWith('Plugin installed. Restart D2R to load it.');
    expect(screen.queryByRole('button', { name: 'Install plugin' })).not.toBeInTheDocument();
  });

  it('If installing the plugin throws, Then the toast shows only the translated message', async () => {
    // Arrange
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setupGrailStore({ d2rLoaderBridge: true });
    const d2rLoader = setupElectronAPI({ ...INSTALLED, pluginInstalled: false });
    d2rLoader.installPlugin.mockRejectedValue(
      new Error('D2RLoader was not found in the D2R folder'),
    );
    await renderSettings();

    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Install plugin' }));
    });

    // Assert
    expect(toast.error).toHaveBeenCalledWith("The plugin couldn't be changed.");
    consoleErrorSpy.mockRestore();
  });

  it('If the Run Counter import throws, Then the toast shows only the translated message', async () => {
    // Arrange
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    setupGrailStore({ d2rLoaderBridge: false });
    const d2rLoader = setupElectronAPI(INSTALLED);
    d2rLoader.importRunCounter.mockRejectedValue(new Error('EACCES: permission denied'));
    await renderSettings();

    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Import Run Counter history' }));
    });

    // Assert
    expect(toast.error).toHaveBeenCalledWith("The Run Counter history couldn't be imported.");
    consoleErrorSpy.mockRestore();
  });

  it.each([
    [
      'finds no data',
      { found: false, runs: 0, items: 0 },
      'error',
      'No Run Counter data in C:/rc.',
    ],
    ['finds no new runs', { found: true, runs: 0, items: 0 }, 'success', 'No new runs to import.'],
  ] as const)('If the Run Counter import %s, Then a %s message says so', async (_, result, kind, message) => {
    // Arrange
    setupGrailStore({ d2rLoaderBridge: false });
    const d2rLoader = setupElectronAPI(INSTALLED);
    d2rLoader.importRunCounter.mockResolvedValue({
      folder: 'C:/rc',
      sessions: 1,
      skippedRuns: 0,
      ...result,
    });
    await renderSettings();

    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Import Run Counter history' }));
    });

    // Assert
    expect(toast[kind]).toHaveBeenCalledWith(message);
  });

  it('If the Run Counter import adds runs, Then the message counts the runs and their grail items', async () => {
    // Arrange
    setupGrailStore({ d2rLoaderBridge: false });
    const d2rLoader = setupElectronAPI(INSTALLED);
    d2rLoader.importRunCounter.mockResolvedValue({
      folder: 'C:/rc',
      found: true,
      sessions: 1,
      runs: 2,
      items: 1,
      skippedRuns: 0,
    });
    await renderSettings();

    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Import Run Counter history' }));
    });

    // Assert
    expect(toast.success).toHaveBeenCalledWith('Imported 2 runs.', {
      description: '1 grail item was found in them.',
    });
  });

  it('If only the connection settings are missing, Then connecting says the plugin connects shortly', async () => {
    // Arrange
    setupGrailStore({ d2rLoaderBridge: true });
    const d2rLoader = setupElectronAPI({ ...INSTALLED, configured: false });
    d2rLoader.installPlugin.mockResolvedValue({ installation: INSTALLED });
    await renderSettings();

    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Connect plugin' }));
    });

    // Assert
    expect(toast.success).toHaveBeenCalledWith(
      'Connection settings saved. The plugin connects within a few seconds.',
    );
  });
});
