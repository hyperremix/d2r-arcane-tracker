import { render, screen } from '@testing-library/react';
import type { TerrorZoneValidationResult } from 'electron/types/grail';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
