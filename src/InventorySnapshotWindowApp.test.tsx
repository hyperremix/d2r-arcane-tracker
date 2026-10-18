import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWindowBootstrap } from '@/hooks/useWindowBootstrap';
import InventorySnapshotWindowApp from './InventorySnapshotWindowApp';

const characterInventoryBrowserMock = vi.fn();

vi.mock('@/components/inventory/CharacterInventoryBrowser', () => ({
  CharacterInventoryBrowser: (props: unknown) => {
    characterInventoryBrowserMock(props);
    return <div data-testid="character-inventory-browser" />;
  },
}));

vi.mock('@/hooks/useWindowBootstrap', () => ({
  useWindowBootstrap: vi.fn(),
}));

vi.mock('/logo.png', () => ({
  default: '/logo.png',
}));

describe('When InventorySnapshotWindowApp is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      writable: true,
      value: {
        platform: 'darwin',
      },
    });
  });

  describe('If the hash includes a valid snapshot target', () => {
    it('Then it renders the draggable title bar and snapshot inventory view', () => {
      // Arrange
      window.history.replaceState(
        {},
        '',
        '#/inventory-snapshot?sourceFilePath=%2Ftmp%2Fsorc.d2s&sourceFileType=d2s&characterName=Sorc',
      );

      // Act
      render(<InventorySnapshotWindowApp />);

      // Assert
      expect(screen.getByText('Sorc')).toBeInTheDocument();
      expect(screen.getByText('Sorc').closest('.titlebar')).toBeInTheDocument();
      expect(screen.getByTestId('character-inventory-browser')).toBeInTheDocument();
      expect(characterInventoryBrowserMock).toHaveBeenCalledWith({
        mode: 'snapshot',
        snapshotTarget: {
          sourceFilePath: '/tmp/sorc.d2s',
          sourceFileType: 'd2s',
          characterName: 'Sorc',
        },
      });
    });
  });

  describe('If the snapshot target is a character save', () => {
    const getCharacterOverview = vi.fn();

    beforeEach(() => {
      getCharacterOverview.mockResolvedValue(undefined);
      Object.defineProperty(window, 'electronAPI', {
        configurable: true,
        writable: true,
        value: { platform: 'darwin', on: vi.fn(() => vi.fn()), saveFile: { getCharacterOverview } },
      });
      window.history.replaceState(
        {},
        '',
        '#/inventory-snapshot?sourceFilePath=%2Ftmp%2Fsorc.d2s&sourceFileType=d2s&characterName=Sorc',
      );
    });

    it('Then the items tab is selected', () => {
      // Act
      render(<InventorySnapshotWindowApp />);

      // Assert
      expect(screen.getByRole('tab', { name: 'Items' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('character-inventory-browser')).toBeInTheDocument();
    });

    it('Then selecting the overview tab reads the character overview of the save', async () => {
      // Arrange
      render(<InventorySnapshotWindowApp />);

      // Act
      fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));

      // Assert
      expect(
        await screen.findByText(/The overview couldn't be read from this save file/),
      ).toBeInTheDocument();
      expect(getCharacterOverview).toHaveBeenCalledWith('/tmp/sorc.d2s');
    });
  });

  describe('If the snapshot target is a shared stash', () => {
    it('Then only the items are shown, without tabs', () => {
      // Arrange
      window.history.replaceState(
        {},
        '',
        '#/inventory-snapshot?sourceFilePath=%2Ftmp%2FSharedStashSoftCoreV2.d2i&sourceFileType=d2i&characterName=Shared',
      );

      // Act
      render(<InventorySnapshotWindowApp />);

      // Assert
      expect(screen.getByTestId('character-inventory-browser')).toBeInTheDocument();
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });
  });

  describe('If the window mounts', () => {
    it('Then it bootstraps the window and follows settings saved in the main window', () => {
      // Arrange
      window.history.replaceState({}, '', '#/inventory-snapshot?foo=bar');

      // Act
      render(<InventorySnapshotWindowApp />);

      // Assert
      expect(useWindowBootstrap).toHaveBeenCalledWith({ followSettingsUpdates: true });
    });
  });

  describe('If the hash is missing a valid snapshot target', () => {
    it('Then it renders the invalid target state and does not render snapshot inventory', () => {
      // Arrange
      window.history.replaceState({}, '', '#/inventory-snapshot?foo=bar');

      // Act
      render(<InventorySnapshotWindowApp />);

      // Assert
      expect(
        screen.getByText('Unable to open inventory snapshot. Missing or invalid snapshot target.'),
      ).toBeInTheDocument();
      expect(screen.queryByTestId('character-inventory-browser')).not.toBeInTheDocument();
      expect(characterInventoryBrowserMock).not.toHaveBeenCalled();
    });
  });
});
