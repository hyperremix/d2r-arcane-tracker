import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { TerrorZoneValidationResult } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TerrorZoneConfiguration } from './TerrorZoneConfiguration';

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
  window.electronAPI = { terrorZone } as unknown as typeof window.electronAPI;
  return terrorZone;
}

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
    it('Then the translated disable-all failure is shown', async () => {
      // Arrange
      setupValidTerrorZoneApi({ updateConfig: vi.fn().mockRejectedValue(new Error('boom')) });
      render(<TerrorZoneConfiguration />);
      await screen.findByRole('switch', { name: 'Blood Moor' });

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Disable All' }));

      // Assert
      expect(await screen.findByText('Failed to disable all zones')).toBeInTheDocument();
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

describe('When TerrorZoneConfiguration is rendered as a page', () => {
  afterEach(() => {
    window.electronAPI = originalElectronAPI;
  });

  it('If the zones are loaded, Then exactly one level-1 heading is present', async () => {
    // Arrange
    setupValidTerrorZoneApi();

    // Act
    render(<TerrorZoneConfiguration />);
    await screen.findByRole('switch', { name: 'Blood Moor' });

    // Assert
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('If the zones are still loading, Then exactly one level-1 heading is present', () => {
    // Arrange
    setupValidTerrorZoneApi({
      validatePath: vi.fn().mockReturnValue(new Promise(() => undefined)),
    });

    // Act
    render(<TerrorZoneConfiguration />);

    // Assert
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
