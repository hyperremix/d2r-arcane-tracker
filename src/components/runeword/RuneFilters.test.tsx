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

  it('Then the rune list is a two-column list that scrolls only as a fallback', () => {
    // Arrange & Act
    renderRuneFilters([]);

    // Assert
    const runeList = screen.getByRole('group', { name: 'Filter by Runes' });
    expect(runeList).toHaveClass('grid-cols-2', 'overflow-y-auto');
  });

  it('Then every rune, including the highest runes, is inside the rune list', () => {
    // Arrange & Act
    renderRuneFilters([]);

    // Assert
    const runeList = screen.getByRole('group', { name: 'Filter by Runes' });
    expect(within(runeList).getAllByRole('checkbox')).toHaveLength(runes.length);
    expect(within(runeList).getByLabelText(/^Zod/)).toBeInTheDocument();
    expect(within(runeList).getByLabelText(/^Cham/)).toBeInTheDocument();
  });
});

describe('When RuneFilters shows long rune names or counts', () => {
  beforeEach(() => {
    setElectronAPI({ icon: { getByFilename: vi.fn().mockResolvedValue(undefined) } });
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
  });

  it('Then each rune name is truncated rather than overflowing and keeps its full name as a title', () => {
    // Arrange & Act
    render(
      <RuneFilters
        selectedRunes={[]}
        onRuneSelectionChange={vi.fn()}
        availableRunes={{ cham: 123 }}
      />,
    );

    // Assert
    const name = screen.getByTitle('Cham');
    expect(name).toHaveTextContent('Cham');
    expect(name).toHaveClass('truncate', 'min-w-0');
    expect(screen.getByLabelText(/^Cham\s*123$/)).toBeInTheDocument();
  });
});

describe('When RuneFilters shows owned counts', () => {
  beforeEach(() => {
    setElectronAPI({ icon: { getByFilename: vi.fn().mockResolvedValue(undefined) } });
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
  });

  it('If a rune is not owned, Then its zero count is muted text rather than a red pill', () => {
    // Arrange & Act
    render(
      <RuneFilters selectedRunes={[]} onRuneSelectionChange={vi.fn()} availableRunes={{ el: 2 }} />,
    );

    // Assert
    const zodCount = within(screen.getByLabelText(/^Zod/).closest('div') as HTMLElement).getByText(
      '0',
    );
    expect(zodCount).toHaveClass('text-muted-foreground');
    expect(zodCount).not.toHaveClass('text-missing', 'bg-missing/15', 'bg-info/15');
  });

  it('If a rune is owned, Then its count is shown in a filled pill', () => {
    // Arrange & Act
    render(
      <RuneFilters selectedRunes={[]} onRuneSelectionChange={vi.fn()} availableRunes={{ el: 2 }} />,
    );

    // Assert
    const elCount = within(
      screen.getByLabelText(/^El\s*2$/).closest('div') as HTMLElement,
    ).getByText('2');
    expect(elCount).toHaveClass('bg-info/15', 'text-info');
  });
});
