import { render, screen, within } from '@testing-library/react';
import { runes } from 'electron/items/runes';
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

describe('When RuneFilters is placed in a height-bounded sidebar', () => {
  beforeEach(() => {
    setElectronAPI({ icon: { getByFilename: vi.fn().mockResolvedValue(undefined) } });
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
  });

  it('Then the root is a shrinkable flex column and the rune list is the scroll container', () => {
    // Arrange & Act
    const { container } = renderRuneFilters([]);

    // Assert
    // The root must shrink to the space left in the sidebar so the list below gets a bounded height
    expect(container.firstElementChild).toHaveClass('flex', 'min-h-0', 'flex-1', 'flex-col');
    const runeList = screen.getByRole('group', { name: 'Filter by Runes' });
    expect(runeList).toHaveClass('min-h-0', 'flex-1', 'overflow-y-auto');
  });

  it('Then every rune, including the highest runes, is inside the scrollable list', () => {
    // Arrange & Act
    renderRuneFilters([]);

    // Assert
    const runeList = screen.getByRole('group', { name: 'Filter by Runes' });
    expect(within(runeList).getAllByRole('checkbox')).toHaveLength(runes.length);
    expect(within(runeList).getByLabelText(/^Zod/)).toBeInTheDocument();
    expect(within(runeList).getByLabelText(/^Cham/)).toBeInTheDocument();
  });
});
