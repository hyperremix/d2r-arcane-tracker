import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Settings } from 'electron/types/grail';
import type { SaveFileSnapshotGroup } from 'electron/types/saveFileSnapshots';
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
import { SaveSnapshotsCard } from './SaveSnapshots';

vi.mock('sonner', () => import('@/test/sonnerMock'));

vi.mock('@/stores/grailStore');

const SNAPSHOT_ID = 'snapshot:0123abcd-Hero.d2s.2026-10-18T08-52-23-468Z-000022.snap';
const BACKUP_ID = 'backup:0123abcd-Hero.d2s.2026-10-18T09-10-00-000Z-000023.bak';

const groups: SaveFileSnapshotGroup[] = [
  {
    fileName: 'Hero.d2s',
    fileExists: true,
    snapshots: [
      {
        id: BACKUP_ID,
        kind: 'backup',
        createdAt: new Date('2026-10-18T09:10:00.000Z'),
        sizeBytes: 2048,
        characterLevel: 81,
      },
      {
        id: SNAPSHOT_ID,
        kind: 'snapshot',
        createdAt: new Date('2026-10-18T08:52:23.468Z'),
        sizeBytes: 1536,
        characterLevel: 80,
      },
    ],
  },
];

const mockElectronAPI = {
  saveSnapshots: {
    list: vi.fn(),
    restore: vi.fn(),
  },
};

const originalElectronAPI: unknown = window.electronAPI;

// Assign rather than redefine: other suites define `window.electronAPI` as non-configurable.
function setElectronAPI(value: unknown) {
  (window as unknown as { electronAPI: unknown }).electronAPI = value;
}

function setupStore(settings: Partial<Settings> = {}) {
  const setSettings = vi.fn().mockResolvedValue({ ok: true });
  mockStoreState(vi.mocked(useGrailStore), { settings, setSettings });
  return setSettings;
}

describe('When the save file snapshots card is shown', () => {
  let consoleErrorSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockElectronAPI.saveSnapshots.list.mockResolvedValue(groups);
    mockElectronAPI.saveSnapshots.restore.mockResolvedValue({ success: true });
    setElectronAPI(mockElectronAPI);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    setElectronAPI(originalElectronAPI);
  });

  it('Then the timeline of the first save file lists its copies with type, size and level', async () => {
    // Arrange
    setupStore();

    // Act
    render(<SaveSnapshotsCard />);

    // Assert
    const table = await screen.findByRole('table', { name: 'Copies of Hero.d2s' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(within(rows[1]).getByText('Before app change')).toBeInTheDocument();
    expect(within(rows[1]).getByText('81')).toBeInTheDocument();
    expect(within(rows[1]).getByText('2 kB')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Snapshot')).toBeInTheDocument();
  });

  it('If a copy is restored and confirmed, Then the restore is requested with its ID', async () => {
    // Arrange
    setupStore();
    render(<SaveSnapshotsCard />);
    const table = await screen.findByRole('table', { name: 'Copies of Hero.d2s' });
    const [, , snapshotRow] = within(table).getAllByRole('row');

    // Act
    fireEvent.click(within(snapshotRow).getByRole('button', { name: /^Restore Hero\.d2s from/ }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restore' }));

    // Assert
    expect(within(dialog).getByText(/^Replace Hero\.d2s with the copy from/)).toBeInTheDocument();
    await waitFor(() =>
      expect(mockElectronAPI.saveSnapshots.restore).toHaveBeenCalledWith(SNAPSHOT_ID),
    );
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Save file restored', expect.anything()),
    );
  });

  it('If the game is running, Then the restore error says to close the game', async () => {
    // Arrange
    setupStore();
    mockElectronAPI.saveSnapshots.restore.mockRejectedValue(
      new Error("Error invoking remote method 'saveSnapshots:restore': Error: GAME_RUNNING"),
    );
    render(<SaveSnapshotsCard />);
    const table = await screen.findByRole('table', { name: 'Copies of Hero.d2s' });

    // Act
    fireEvent.click(within(table).getAllByRole('button', { name: /^Restore Hero\.d2s from/ })[0]);
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Restore' }),
    );

    // Assert
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Close Diablo II: Resurrected first. The game would overwrite the restored file. Nothing was changed.',
      ),
    );
  });

  it('If the restore dialog is canceled, Then nothing is restored', async () => {
    // Arrange
    setupStore();
    render(<SaveSnapshotsCard />);
    const table = await screen.findByRole('table', { name: 'Copies of Hero.d2s' });
    fireEvent.click(within(table).getAllByRole('button', { name: /^Restore Hero\.d2s from/ })[0]);

    // Act
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );

    // Assert
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(mockElectronAPI.saveSnapshots.restore).not.toHaveBeenCalled();
  });

  it('If no copies exist yet, Then an empty state is shown', async () => {
    // Arrange
    setupStore();
    mockElectronAPI.saveSnapshots.list.mockResolvedValue([]);

    // Act
    render(<SaveSnapshotsCard />);

    // Assert
    expect(await screen.findByText(/^No snapshots yet/)).toBeInTheDocument();
  });

  it('If snapshots are turned off, Then the setting is saved', async () => {
    // Arrange
    const setSettings = setupStore({ saveSnapshotsEnabled: true });
    render(<SaveSnapshotsCard />);

    // Act
    fireEvent.click(screen.getByRole('switch', { name: 'Keep snapshots' }));

    // Assert
    expect(setSettings).toHaveBeenCalledWith({ saveSnapshotsEnabled: false });
  });

  it('If a valid number of snapshots per file is entered, Then it is saved on blur', () => {
    // Arrange
    const setSettings = setupStore({ saveSnapshotsPerFile: 50 });
    render(<SaveSnapshotsCard />);
    const input = screen.getByLabelText('Snapshots per file');

    // Act
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.blur(input);

    // Assert
    expect(setSettings).toHaveBeenCalledWith({ saveSnapshotsPerFile: 25 });
  });

  it('If an out-of-range number of snapshots per file is entered, Then the stored value is kept', () => {
    // Arrange
    const setSettings = setupStore({ saveSnapshotsPerFile: 50 });
    render(<SaveSnapshotsCard />);
    const input = screen.getByLabelText('Snapshots per file');

    // Act
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.blur(input);

    // Assert
    expect(setSettings).not.toHaveBeenCalled();
    expect(input).toHaveValue(50);
  });
});
