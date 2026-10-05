import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { GameMode } from 'electron/types/grail';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { SaveFileMonitor } from './SaveFileMonitor';

vi.mock('@/stores/grailStore');

const mockUseGrailStore = vi.mocked(useGrailStore);

function mockGameMode(gameMode: GameMode) {
  mockUseGrailStore.mockReturnValue({
    reloadData: vi.fn(),
    settings: { gameMode },
  } as unknown as ReturnType<typeof useGrailStore>);
}

describe('SaveFileMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('manual mode notice', () => {
    it('When game mode is manual, then the notice is a polite status and not an assertive alert', () => {
      // Arrange
      mockGameMode(GameMode.Manual);

      // Act
      render(<SaveFileMonitor />);

      // Assert
      const notice = screen.getByText(/Manual Mode Active:/).closest('[data-slot="alert"]');
      expect(notice).toHaveAttribute('role', 'status');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('If game mode is not manual, then the notice is not rendered', () => {
      // Arrange
      mockGameMode(GameMode.Both);

      // Act
      render(<SaveFileMonitor />);

      // Assert
      expect(screen.queryByText(/Manual Mode Active:/)).not.toBeInTheDocument();
    });
  });
});
