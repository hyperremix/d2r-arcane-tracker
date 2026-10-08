import { render, screen } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RuneFilters } from './RuneFilters';

const originalElectronAPI: unknown = window.electronAPI;

// Assign rather than redefine: other suites define `window.electronAPI` as non-configurable.
function setElectronAPI(value: unknown) {
  (window as unknown as { electronAPI: unknown }).electronAPI = value;
}

function renderRuneFilters(selectedRunes: string[]) {
  return render(
    <RuneFilters
      selectedRunes={selectedRunes}
      onRuneSelectionChange={vi.fn()}
      availableRunes={{}}
    />,
  );
}

describe('When RuneFilters shows the selection summary', () => {
  beforeEach(() => {
    setElectronAPI({ icon: { getByFilename: vi.fn().mockResolvedValue(undefined) } });
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
  });

  it('If no rune is selected, Then no summary is shown', () => {
    // Arrange & Act
    renderRuneFilters([]);

    // Assert
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
  });

  it('If one rune is selected, Then the singular form is used', async () => {
    // Arrange & Act
    renderRuneFilters(['el']);

    // Assert
    expect(await screen.findByText('1 rune selected')).toBeInTheDocument();
  });

  it('If several runes are selected, Then the plural form is used', async () => {
    // Arrange & Act
    renderRuneFilters(['el', 'eld', 'tir']);

    // Assert
    expect(await screen.findByText('3 runes selected')).toBeInTheDocument();
  });
});
