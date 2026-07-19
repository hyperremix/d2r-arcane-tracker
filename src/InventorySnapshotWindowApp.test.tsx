import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InventorySnapshotWindowApp from './InventorySnapshotWindowApp';

const characterInventoryBrowserMock = vi.fn();

vi.mock('@/components/inventory/CharacterInventoryBrowser', () => ({
  CharacterInventoryBrowser: (props: unknown) => {
    characterInventoryBrowserMock(props);
    return <div data-testid="character-inventory-browser" />;
  },
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: vi.fn(),
}));

vi.mock('/logo.png', () => ({
  default: '/logo.png',
}));

describe('When InventorySnapshotWindowApp is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(window, 'electronAPI', {
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
