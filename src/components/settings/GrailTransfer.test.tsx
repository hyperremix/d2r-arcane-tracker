import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Character } from 'electron/types/grail';
import type { GrailImportPreview } from 'electron/types/grailTransfer';
import { toast } from 'sonner';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { mockStoreState } from '@/test/storeMock';
import { GrailTransferCard } from './GrailTransfer';

vi.mock('sonner', () => import('@/test/sonnerMock'));

vi.mock('@/stores/grailStore');

const sorc = { id: 'char-1', name: 'Sorc' } as Character;

const preview: GrailImportPreview = {
  importId: 'import-1',
  source: 'nasicus-json',
  fileName: 'HolyGrail_me.json',
  matchedCount: 5,
  newCount: 3,
  existingCount: 2,
  earlierDateCount: 0,
  unmatched: [{ name: 'Mystery Item' }, { name: 'Annihilus', version: 'ethereal' }],
};

const mockElectronAPI = {
  dialog: {
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
    writeFile: vi.fn(),
  },
  grail: {
    exportProgress: vi.fn(),
    previewImport: vi.fn(),
    applyImport: vi.fn(),
  },
};

const originalElectronAPI: unknown = window.electronAPI;

// Assign rather than redefine: other suites define `window.electronAPI` as non-configurable.
function setElectronAPI(value: unknown) {
  (window as unknown as { electronAPI: unknown }).electronAPI = value;
}

async function openPreview() {
  mockElectronAPI.dialog.showOpenDialog.mockResolvedValue({
    canceled: false,
    filePaths: ['/exports/HolyGrail_me.json'],
  });
  fireEvent.click(screen.getByRole('button', { name: 'Import from file' }));
  return screen.findByRole('alertdialog');
}

describe('When the grail import and export card is used', () => {
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockStoreState(vi.mocked(useGrailStore), { characters: [sorc] });
    mockElectronAPI.grail.previewImport.mockResolvedValue(preview);
    mockElectronAPI.grail.applyImport.mockResolvedValue({ added: 3, earlierDates: 0 });
    setElectronAPI(mockElectronAPI);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
  });

  it('If CSV is exported to a picked file, Then the export text is written there', async () => {
    // Arrange
    mockElectronAPI.dialog.showSaveDialog.mockResolvedValue({
      canceled: false,
      filePath: '/exports/grail.csv',
    });
    mockElectronAPI.grail.exportProgress.mockResolvedValue('item\n');
    render(<GrailTransferCard />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    // Assert
    await waitFor(() =>
      expect(mockElectronAPI.dialog.writeFile).toHaveBeenCalledWith('/exports/grail.csv', 'item\n'),
    );
    expect(mockElectronAPI.grail.exportProgress).toHaveBeenCalledWith('csv');
    expect(toast.success).toHaveBeenCalledWith('Grail progress exported', {
      description: 'Saved to grail.csv',
    });
  });

  it('If the export dialog is canceled, Then nothing is exported', async () => {
    // Arrange
    mockElectronAPI.dialog.showSaveDialog.mockResolvedValue({ canceled: true });
    render(<GrailTransferCard />);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));

    // Assert
    await waitFor(() => expect(mockElectronAPI.dialog.showSaveDialog).toHaveBeenCalled());
    expect(mockElectronAPI.grail.exportProgress).not.toHaveBeenCalled();
    expect(mockElectronAPI.dialog.writeFile).not.toHaveBeenCalled();
  });

  it('If an import file is picked, Then the preview shows the counts and unmatched names', async () => {
    // Arrange
    render(<GrailTransferCard />);

    // Act
    const dialog = await openPreview();

    // Assert
    expect(mockElectronAPI.grail.previewImport).toHaveBeenCalledWith('/exports/HolyGrail_me.json');
    expect(within(dialog).getByText('Nasicus/d2-holy-grail export')).toBeInTheDocument();
    expect(within(dialog).getByText('3 finds will be added')).toBeInTheDocument();
    expect(
      within(dialog).getByText("2 item versions are already found and won't be added again"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Mystery Item')).toBeInTheDocument();
    expect(within(dialog).getByText('Annihilus (ethereal)')).toBeInTheDocument();
    expect(mockElectronAPI.grail.applyImport).not.toHaveBeenCalled();
  });

  it('If the preview is confirmed, Then the import is applied for the chosen character', async () => {
    // Arrange
    render(<GrailTransferCard />);
    const dialog = await openPreview();

    // Act
    fireEvent.click(within(dialog).getByRole('button', { name: 'Import' }));

    // Assert
    await waitFor(() =>
      expect(mockElectronAPI.grail.applyImport).toHaveBeenCalledWith('import-1', 'char-1'),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Grail progress imported', {
        description: 'Finds added: 3. Dates moved earlier: 0.',
      }),
    );
  });

  it('If the app has no characters, Then finds can not be imported', async () => {
    // Arrange
    mockStoreState(vi.mocked(useGrailStore), { characters: [] });
    render(<GrailTransferCard />);

    // Act
    const dialog = await openPreview();

    // Assert
    expect(within(dialog).getByText(/^The app has no characters yet/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('If the file is not a supported export, Then the reason is shown', async () => {
    // Arrange
    mockElectronAPI.grail.previewImport.mockRejectedValue(
      new Error(
        "Error invoking remote method 'grail:previewImport': Error: IMPORT_FORMAT_UNSUPPORTED",
      ),
    );
    render(<GrailTransferCard />);
    mockElectronAPI.dialog.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/exports/notes.json'],
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Import from file' }));

    // Assert
    expect(
      await screen.findByText("This file isn't a supported grail export."),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
