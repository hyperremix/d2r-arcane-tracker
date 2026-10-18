import { fireEvent, render, screen, within } from '@testing-library/react';
import { runes } from 'electron/items/runes';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RuneFilters } from './RuneFilters';

const originalElectronAPI: unknown = window.electronAPI;

// Assign rather than redefine: other suites define `window.electronAPI` as non-configurable.
function setElectronAPI(value: unknown) {
  (window as unknown as { electronAPI: unknown }).electronAPI = value;
}

function renderRuneFilters(
  selectedRunes: string[],
  availableRunes: Record<string, number> = {},
  onRuneSelectionChange = vi.fn(),
) {
  return render(
    <RuneFilters
      selectedRunes={selectedRunes}
      onRuneSelectionChange={onRuneSelectionChange}
      availableRunes={availableRunes}
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

  it('If no rune is selected, Then no summary is shown and Clear selection is disabled', () => {
    // Arrange & Act
    renderRuneFilters([]);

    // Assert
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeDisabled();
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

  it('When Clear selection is clicked, Then the selection is emptied', () => {
    // Arrange
    const onRuneSelectionChange = vi.fn();
    renderRuneFilters(['el', 'tir'], {}, onRuneSelectionChange);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));

    // Assert
    expect(onRuneSelectionChange).toHaveBeenCalledWith([]);
  });
});

describe('When RuneFilters is placed in a height-bounded sidebar', () => {
  beforeEach(() => {
    setElectronAPI({ icon: { getByFilename: vi.fn().mockResolvedValue(undefined) } });
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
  });

  it('Then the rune grid fits as many columns as the sidebar width allows and scrolls only as a fallback', () => {
    // Arrange & Act
    renderRuneFilters([]);

    // Assert
    const runeGrid = screen.getByRole('group', { name: 'Filter by runes' });
    expect(runeGrid).toHaveClass(
      'grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))]',
      'overflow-y-auto',
    );
  });

  it('Then every rune, including the highest runes, is a toggle button in the rune grid', () => {
    // Arrange & Act
    renderRuneFilters([]);

    // Assert
    const runeGrid = screen.getByRole('group', { name: 'Filter by runes' });
    expect(within(runeGrid).getAllByRole('button', { pressed: false })).toHaveLength(runes.length);
    expect(within(runeGrid).getByRole('button', { name: 'Zod, 0 owned' })).toBeInTheDocument();
    expect(within(runeGrid).getByRole('button', { name: 'Cham, 0 owned' })).toBeInTheDocument();
  });
});

describe('When a rune toggle is clicked', () => {
  beforeEach(() => {
    setElectronAPI({ icon: { getByFilename: vi.fn().mockResolvedValue(undefined) } });
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
  });

  it('If the rune is not selected, Then it is added to the selection', () => {
    // Arrange
    const onRuneSelectionChange = vi.fn();
    renderRuneFilters(['el'], {}, onRuneSelectionChange);

    // Act
    fireEvent.click(screen.getByRole('button', { name: /^Ber,/ }));

    // Assert
    expect(onRuneSelectionChange).toHaveBeenCalledWith(['el', 'ber']);
  });

  it('If the rune is selected, Then it is pressed and clicking it removes it from the selection', () => {
    // Arrange
    const onRuneSelectionChange = vi.fn();
    renderRuneFilters(['el', 'ber'], {}, onRuneSelectionChange);
    const ber = screen.getByRole('button', { name: /^Ber,/ });
    expect(ber).toHaveAttribute('aria-pressed', 'true');
    // Selected runes are outlined and checked, so the state is not shown by color alone
    expect(ber).toHaveClass('border-primary');
    expect(ber.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('button', { name: /^Zod,/ }).querySelector('svg')).toBeNull();

    // Act
    fireEvent.click(ber);

    // Assert
    expect(onRuneSelectionChange).toHaveBeenCalledWith(['el']);
  });
});

describe('When RuneFilters shows owned counts', () => {
  beforeEach(() => {
    setElectronAPI({ icon: { getByFilename: vi.fn().mockResolvedValue(undefined) } });
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
  });

  it('Then each rune button shows its name and owned count and says both in its accessible name', () => {
    // Arrange & Act
    renderRuneFilters([], { cham: 123 });

    // Assert
    const cham = screen.getByRole('button', { name: 'Cham, 123 owned' });
    expect(within(cham).getByText('Cham')).toBeInTheDocument();
    expect(within(cham).getByText('123')).toBeInTheDocument();
  });

  it('If a rune is not owned, Then its button is dimmed rather than marked as an error', () => {
    // Arrange & Act
    renderRuneFilters([], { el: 2 });

    // Assert
    const zod = screen.getByRole('button', { name: 'Zod, 0 owned' });
    expect(within(zod).getByText('Zod')).toHaveClass('text-muted-foreground');
    expect(within(zod).getByText('0')).toHaveClass('text-muted-foreground');
    expect(within(zod).getByText('0')).not.toHaveClass('text-missing', 'bg-missing/15');
  });

  it('If a rune is owned, Then its count is a plain number without a colored pill', () => {
    // Arrange & Act
    renderRuneFilters([], { el: 2 });

    // Assert
    const el = screen.getByRole('button', { name: 'El, 2 owned' });
    const count = within(el).getByText('2');
    expect(count).not.toHaveClass('bg-info/15', 'text-info', 'text-muted-foreground');
    expect(within(el).getByText('El')).not.toHaveClass('text-muted-foreground');
  });
});
