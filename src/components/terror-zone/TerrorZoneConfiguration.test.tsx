import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { TerrorZoneValidationResult } from 'electron/types/grail';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TerrorZoneConfiguration } from './TerrorZoneConfiguration';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const originalElectronAPI = window.electronAPI;

function setupTerrorZoneApi(validation: TerrorZoneValidationResult) {
  window.electronAPI = {
    terrorZone: {
      validatePath: vi.fn().mockResolvedValue(validation),
      getZones: vi.fn().mockResolvedValue([]),
      getConfig: vi.fn().mockResolvedValue({}),
    },
  } as unknown as typeof window.electronAPI;
}

const zones = [
  { id: '1', name: 'Blood Moor', levels: [] },
  { id: '2', name: 'Cold Plains', levels: [] },
];

function setupValidTerrorZoneApi(overrides: Record<string, unknown> = {}) {
  const terrorZone = {
    validatePath: vi.fn().mockResolvedValue({ valid: true, path: '/d2r' }),
    getZones: vi.fn().mockResolvedValue(zones),
    getConfig: vi.fn().mockResolvedValue({ '1': true, '2': false }),
    updateConfig: vi.fn().mockResolvedValue({ success: true, requiresRestart: true }),
    restoreOriginal: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
  const shell = { openExternal: vi.fn().mockResolvedValue({ success: true }) };
  window.electronAPI = { terrorZone, shell } as unknown as typeof window.electronAPI;
  return { ...terrorZone, shell };
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const saveSuccess = { success: true, requiresRestart: true };

describe('When TerrorZoneConfiguration validates the game installation', () => {
  afterEach(() => {
    window.electronAPI = originalElectronAPI;
  });

  describe('If the game file is missing', () => {
    it('Then the translated error and extraction guide are shown regardless of the raw error text', async () => {
      // Arrange
      setupTerrorZoneApi({
        valid: false,
        errorCode: 'gameFileNotFound',
        error: 'Spieldatei fehlt',
      });

      // Act
      render(<TerrorZoneConfiguration />);

      // Assert
      expect(
        await screen.findByText('desecratedzones.json file not found in D2R installation'),
      ).toBeInTheDocument();
      expect(screen.getByText('Game Files Must Be Extracted')).toBeInTheDocument();
      expect(screen.getByText("Ladik's CASC Viewer")).toBeInTheDocument();
      expect(screen.getByText('Always launch D2R using this shortcut')).toBeInTheDocument();
      expect(screen.queryByText('Spieldatei fehlt')).not.toBeInTheDocument();
    });
  });

  describe('If the error text mentions "not found" but the code is different', () => {
    it('Then the extraction guide is not shown', async () => {
      // Arrange
      setupTerrorZoneApi({
        valid: false,
        errorCode: 'directoryNotFound',
        error: 'Directory not found',
      });

      // Act
      render(<TerrorZoneConfiguration />);

      // Assert
      expect(
        await screen.findByText('D2R installation directory does not exist'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Game Files Must Be Extracted')).not.toBeInTheDocument();
    });
  });

  describe('If the path is not configured', () => {
    it('Then the translated path message is shown', async () => {
      // Arrange
      setupTerrorZoneApi({ valid: false, errorCode: 'pathNotConfigured' });

      // Act
      render(<TerrorZoneConfiguration />);

      // Assert
      expect(
        await screen.findByText('D2R installation path is not configured'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Game Files Must Be Extracted')).not.toBeInTheDocument();
    });
  });
});

describe('When TerrorZoneConfiguration lists zones', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
    vi.restoreAllMocks();
  });

  it('Then each zone switch has the zone name as its accessible name and reflects its state', async () => {
    // Arrange
    setupValidTerrorZoneApi();

    // Act
    render(<TerrorZoneConfiguration />);

    // Assert
    const bloodMoor = await screen.findByRole('switch', { name: 'Blood Moor' });
    const coldPlains = screen.getByRole('switch', { name: 'Cold Plains' });
    expect(bloodMoor).toBeChecked();
    expect(coldPlains).not.toBeChecked();
  });

  describe('If the zone name label is clicked', () => {
    it('Then the zone switch is toggled', async () => {
      // Arrange
      const terrorZone = setupValidTerrorZoneApi();
      render(<TerrorZoneConfiguration />);
      const coldPlains = await screen.findByRole('switch', { name: 'Cold Plains' });
      expect(coldPlains).not.toBeChecked();

      // Act
      fireEvent.click(screen.getByText('Cold Plains'));

      // Assert
      await waitFor(() => expect(coldPlains).toBeChecked());
      expect(terrorZone.updateConfig).toHaveBeenCalledWith({ '1': true, '2': true });
    });
  });

  describe('If saving a zone change fails', () => {
    it('Then the switch is rolled back to its saved state', async () => {
      // Arrange
      vi.mocked(toast.success).mockClear();
      setupValidTerrorZoneApi({
        updateConfig: vi.fn().mockRejectedValue(new Error('EACCES: raw failure')),
      });
      render(<TerrorZoneConfiguration />);
      const coldPlains = await screen.findByRole('switch', { name: 'Cold Plains' });

      // Act
      fireEvent.click(coldPlains);

      // Assert
      await screen.findByText('Failed to update terror zone configuration');
      expect(coldPlains).not.toBeChecked();
      expect(coldPlains).not.toHaveAttribute('data-disabled');
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('Then the translated update failure is shown instead of the raw error', async () => {
      // Arrange
      setupValidTerrorZoneApi({
        updateConfig: vi.fn().mockRejectedValue(new Error('EACCES: raw failure')),
      });
      render(<TerrorZoneConfiguration />);
      const coldPlains = await screen.findByRole('switch', { name: 'Cold Plains' });

      // Act
      fireEvent.click(coldPlains);

      // Assert
      expect(
        await screen.findByText('Failed to update terror zone configuration'),
      ).toBeInTheDocument();
      expect(screen.queryByText(/EACCES/)).not.toBeInTheDocument();
    });
  });

  describe('If enabling all zones fails', () => {
    it('Then the translated enable-all failure is shown', async () => {
      // Arrange
      setupValidTerrorZoneApi({ updateConfig: vi.fn().mockResolvedValue({ success: false }) });
      render(<TerrorZoneConfiguration />);
      await screen.findByRole('switch', { name: 'Blood Moor' });

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Enable All' }));

      // Assert
      expect(await screen.findByText('Failed to enable all zones')).toBeInTheDocument();
    });
  });

  describe('If disabling all zones fails', () => {
    it('Then the translated disable-all failure is shown and the zones are rolled back', async () => {
      // Arrange
      setupValidTerrorZoneApi({ updateConfig: vi.fn().mockRejectedValue(new Error('boom')) });
      render(<TerrorZoneConfiguration />);
      const bloodMoor = await screen.findByRole('switch', { name: 'Blood Moor' });
      fireEvent.click(screen.getByRole('button', { name: 'Disable All' }));
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Disable All' }));

      // Assert
      expect(await screen.findByText('Failed to disable all zones')).toBeInTheDocument();
      expect(bloodMoor).toBeChecked();
    });
  });

  describe('If restoring the original file fails', () => {
    it('Then the translated restore failure is shown', async () => {
      // Arrange
      setupValidTerrorZoneApi({ restoreOriginal: vi.fn().mockResolvedValue({ success: false }) });
      render(<TerrorZoneConfiguration />);
      await screen.findByRole('switch', { name: 'Blood Moor' });
      fireEvent.click(screen.getByRole('button', { name: 'Restore Original' }));
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Restore Original' }));

      // Assert
      await waitFor(() =>
        expect(screen.getByText('Failed to restore original file')).toBeInTheDocument(),
      );
    });
  });
});

describe('When TerrorZoneConfiguration saves changes', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(toast.success).mockClear();
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
    vi.restoreAllMocks();
  });

  describe('If zone changes are saved', () => {
    it('Then one deduplicated success toast with the restart hint is shown', async () => {
      // Arrange
      setupValidTerrorZoneApi();
      render(<TerrorZoneConfiguration />);
      const coldPlains = await screen.findByRole('switch', { name: 'Cold Plains' });
      const bloodMoor = screen.getByRole('switch', { name: 'Blood Moor' });

      // Act
      fireEvent.click(coldPlains);
      await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
      fireEvent.click(bloodMoor);
      await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(2));

      // Assert
      const [firstCall, secondCall] = vi.mocked(toast.success).mock.calls;
      expect(firstCall).toEqual([
        'Terror zones saved',
        {
          id: 'terror-zone-config-saved',
          description: 'Restart D2R with -direct -txt to apply.',
        },
      ]);
      expect(secondCall).toEqual(firstCall);
    });
  });

  describe('If a save succeeds after an earlier failure', () => {
    it('Then the previous error is cleared', async () => {
      // Arrange
      const updateConfig = vi
        .fn()
        .mockRejectedValueOnce(new Error('EBUSY'))
        .mockResolvedValue(saveSuccess);
      setupValidTerrorZoneApi({ updateConfig });
      render(<TerrorZoneConfiguration />);
      const coldPlains = await screen.findByRole('switch', { name: 'Cold Plains' });
      fireEvent.click(coldPlains);
      await screen.findByText('Failed to update terror zone configuration');

      // Act
      fireEvent.click(coldPlains);

      // Assert
      await waitFor(() =>
        expect(
          screen.queryByText('Failed to update terror zone configuration'),
        ).not.toBeInTheDocument(),
      );
      expect(coldPlains).toBeChecked();
      expect(toast.success).toHaveBeenCalledTimes(1);
    });
  });

  describe('If no zone has been configured yet', () => {
    it('Then toggling one zone saves an explicit state for every zone', async () => {
      // Arrange
      const terrorZone = setupValidTerrorZoneApi({ getConfig: vi.fn().mockResolvedValue({}) });
      render(<TerrorZoneConfiguration />);
      const bloodMoor = await screen.findByRole('switch', { name: 'Blood Moor' });

      // Act
      fireEvent.click(bloodMoor);

      // Assert
      await waitFor(() =>
        expect(terrorZone.updateConfig).toHaveBeenCalledWith({ '1': false, '2': true }),
      );
    });
  });

  describe('If a zone change is still being written', () => {
    it('Then only the toggled switch is pending and the other switches stay usable', async () => {
      // Arrange
      const write = createDeferred<typeof saveSuccess>();
      setupValidTerrorZoneApi({ updateConfig: vi.fn().mockReturnValue(write.promise) });
      render(<TerrorZoneConfiguration />);
      const coldPlains = await screen.findByRole('switch', { name: 'Cold Plains' });
      const bloodMoor = screen.getByRole('switch', { name: 'Blood Moor' });

      // Act
      fireEvent.click(coldPlains);

      // Assert
      await waitFor(() => expect(coldPlains).toHaveAttribute('data-disabled'));
      expect(coldPlains).toBeChecked();
      expect(coldPlains).toHaveAttribute('aria-busy', 'true');
      expect(bloodMoor).not.toHaveAttribute('data-disabled');
      expect(bloodMoor).not.toHaveAttribute('aria-busy');

      write.resolve(saveSuccess);
      await waitFor(() => expect(coldPlains).not.toHaveAttribute('data-disabled'));
      expect(coldPlains).not.toHaveAttribute('aria-busy');
    });

    it('Then a second change waits for the first write before it is written', async () => {
      // Arrange
      const firstWrite = createDeferred<typeof saveSuccess>();
      const updateConfig = vi
        .fn()
        .mockReturnValueOnce(firstWrite.promise)
        .mockResolvedValue(saveSuccess);
      setupValidTerrorZoneApi({ updateConfig });
      render(<TerrorZoneConfiguration />);
      const coldPlains = await screen.findByRole('switch', { name: 'Cold Plains' });
      const bloodMoor = screen.getByRole('switch', { name: 'Blood Moor' });
      fireEvent.click(coldPlains);
      await waitFor(() => expect(updateConfig).toHaveBeenCalledTimes(1));

      // Act
      fireEvent.click(bloodMoor);

      // Assert
      expect(bloodMoor).not.toBeChecked();
      expect(updateConfig).toHaveBeenCalledTimes(1);

      firstWrite.resolve(saveSuccess);
      await waitFor(() => expect(updateConfig).toHaveBeenCalledTimes(2));
      expect(updateConfig).toHaveBeenNthCalledWith(1, { '1': true, '2': true });
      expect(updateConfig).toHaveBeenNthCalledWith(2, { '1': false, '2': true });
    });
  });
});

describe('When TerrorZoneConfiguration disables all zones', () => {
  beforeEach(() => {
    vi.mocked(toast.success).mockClear();
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
    vi.restoreAllMocks();
  });

  describe('If Disable All is clicked', () => {
    it('Then a confirmation dialog is shown and nothing is written yet', async () => {
      // Arrange
      const terrorZone = setupValidTerrorZoneApi();
      render(<TerrorZoneConfiguration />);
      await screen.findByRole('switch', { name: 'Blood Moor' });

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Disable All' }));

      // Assert
      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText('Disable all terror zones?')).toBeInTheDocument();
      expect(terrorZone.updateConfig).not.toHaveBeenCalled();
    });
  });

  describe('If the confirmation is cancelled', () => {
    it('Then the zones are left unchanged', async () => {
      // Arrange
      const terrorZone = setupValidTerrorZoneApi();
      render(<TerrorZoneConfiguration />);
      const bloodMoor = await screen.findByRole('switch', { name: 'Blood Moor' });
      fireEvent.click(screen.getByRole('button', { name: 'Disable All' }));
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      // Assert
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      expect(terrorZone.updateConfig).not.toHaveBeenCalled();
      expect(bloodMoor).toBeChecked();
    });
  });

  describe('If the confirmation is accepted', () => {
    it('Then every zone is disabled and saved', async () => {
      // Arrange
      const terrorZone = setupValidTerrorZoneApi();
      render(<TerrorZoneConfiguration />);
      const bloodMoor = await screen.findByRole('switch', { name: 'Blood Moor' });
      fireEvent.click(screen.getByRole('button', { name: 'Disable All' }));
      const dialog = await screen.findByRole('alertdialog');

      // Act
      fireEvent.click(within(dialog).getByRole('button', { name: 'Disable All' }));

      // Assert
      await waitFor(() =>
        expect(terrorZone.updateConfig).toHaveBeenCalledWith({ '1': false, '2': false }),
      );
      await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
      expect(bloodMoor).not.toBeChecked();
    });
  });
});

describe('When TerrorZoneConfiguration is configured', () => {
  afterEach(() => {
    window.electronAPI = originalElectronAPI;
    vi.restoreAllMocks();
  });

  it('Then the launch requirements are shown', async () => {
    // Arrange
    setupValidTerrorZoneApi();

    // Act
    render(<TerrorZoneConfiguration />);

    // Assert
    expect(await screen.findByText('Before your changes show up in game')).toBeInTheDocument();
    expect(screen.getByText('-direct -txt')).toBeInTheDocument();
    expect(
      screen.getByText('Restart D2R after saving. A running game does not pick up changes.'),
    ).toBeInTheDocument();
  });

  describe('If the guide link is clicked', () => {
    it('Then the guide is opened in the system browser', async () => {
      // Arrange
      const { shell } = setupValidTerrorZoneApi();
      render(<TerrorZoneConfiguration />);
      const guideLink = await screen.findByRole('link', { name: 'Read the terror zone guide' });

      // Act
      fireEvent.click(guideLink);

      // Assert
      expect(shell.openExternal).toHaveBeenCalledWith(
        'https://github.com/hyperremix/d2r-arcane-tracker/blob/main/docs/TERROR_ZONE_CONFIGURATION.md',
      );
    });
  });
});
