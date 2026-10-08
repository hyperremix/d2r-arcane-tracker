import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RunewordCalculator } from './RunewordCalculator';

const originalElectronAPI: unknown = window.electronAPI;

// Assign rather than redefine: other suites define `window.electronAPI` as non-configurable.
function setElectronAPI(value: unknown) {
  (window as unknown as { electronAPI: unknown }).electronAPI = value;
}

describe('When RunewordCalculator is rendered', () => {
  const getAllRunewords = vi.fn();
  const refreshSaveFiles = vi.fn();
  const getAvailableRunes = vi.fn();

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    getAllRunewords.mockReset().mockResolvedValue([]);
    refreshSaveFiles.mockReset().mockResolvedValue(undefined);
    getAvailableRunes.mockReset().mockResolvedValue({});
    setElectronAPI({
      grail: { getAllRunewords },
      saveFile: { refreshSaveFiles, getAvailableRunes },
      icon: { getByFilename: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    setElectronAPI(originalElectronAPI);
    vi.restoreAllMocks();
  });

  it('If the data is still loading, Then exactly one level-1 heading is present', () => {
    // Arrange
    getAllRunewords.mockReturnValue(new Promise(() => undefined));

    // Act
    render(<RunewordCalculator />);

    // Assert
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Runeword Calculator' })).toBeVisible();
  });

  it('If the data has loaded, Then exactly one level-1 heading is present', async () => {
    // Arrange
    render(<RunewordCalculator />);

    // Act
    await screen.findByText('No runewords found');

    // Assert
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});
