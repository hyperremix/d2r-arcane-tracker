import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { INVENTORY_DRAG_STATE_CHANNEL, VAULT_DRAG_STATE_CHANNEL } from 'electron/ipc/contract';
import type { Character, VaultItem } from 'electron/types/grail';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INVENTORY_DRAG_MIME,
  serializeInventoryTextPayload,
} from '@/components/inventory/dragPayloads';
import { useGrailStore } from '@/stores/grailStore';
import { createMainEventsMock } from '@/test/mainEventsMock';
import { InventoryBrowserMain } from './InventoryBrowserMain';

const searchAllMock = vi.fn();
const searchVaultMock = vi.fn();
const addItemMock = vi.fn();
const openSnapshotWindowMock = vi.fn();
const unvaultItemMock = vi.fn();
const getActiveDragStateMock = vi.fn();
const mainEvents = createMainEventsMock();
const DROP_TEXT = 'Drop an item here to remove it from its save file and keep it in the vault';

/** Drag state another window relays while it drags an inventory item. */
const REMOTE_INVENTORY_DRAG = {
  fingerprint: 'fp-remote',
  sourceFilePath: '/tmp/sorc.d2s',
  sourceFileType: 'd2s',
  sourceLocationContext: 'inventory',
  rawItemJson: '{"id":7}',
};

function createCharacter(overrides: Partial<Character>): Character {
  return {
    id: 'char-1',
    name: 'Sorc',
    characterClass: 'sorceress',
    level: 90,
    hardcore: false,
    expansion: true,
    lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
    created: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

async function reportRemoteInventoryDrag(extra: Record<string, unknown> = {}): Promise<void> {
  await waitFor(() => expect(mainEvents.listenerCount(INVENTORY_DRAG_STATE_CHANNEL)).toBe(1));
  act(() => {
    mainEvents.emit(INVENTORY_DRAG_STATE_CHANNEL, {
      active: true,
      ...REMOTE_INVENTORY_DRAG,
      ...extra,
    });
  });
}

/** A drag that carries inventory item data enters the window, as when dragged from a snapshot window. */
function enterWindowWithInventoryDrag(): void {
  fireEvent.dragEnter(document.body, {
    dataTransfer: { types: [INVENTORY_DRAG_MIME], getData: () => '' },
  });
}

/** jsdom has no DragEvent, so a mouse event stands in for one that carries a pointer position. */
function dragLeave(
  target: Element,
  {
    relatedTarget,
    clientX,
    clientY,
  }: { relatedTarget: Element | null; clientX: number; clientY: number },
): void {
  act(() => {
    target.dispatchEvent(
      new MouseEvent('dragleave', { bubbles: true, relatedTarget, clientX, clientY }),
    );
  });
}

const EMPTY_INVENTORY = { snapshots: [], totalSnapshots: 0, totalItems: 0 };

function createVaultItem(overrides: Partial<VaultItem>): VaultItem {
  return {
    id: 'vault-1',
    fingerprint: 'vfp-1',
    itemName: 'Shako',
    quality: 'unique',
    ethereal: false,
    rawItemJson: '{}',
    sourceFileType: 'd2s',
    locationContext: 'inventory',
    isPresentInLatestScan: false,
    created: new Date('2024-01-01T00:00:00.000Z'),
    lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function mockVaultOnly(items: VaultItem[]): void {
  searchAllMock.mockResolvedValue({
    inventory: EMPTY_INVENTORY,
    vault: { items, total: items.length, page: 1, pageSize: 200 },
  });
}

describe('When InventoryBrowserMain is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mainEvents.reset();
    getActiveDragStateMock.mockResolvedValue({});
    useGrailStore.setState({ items: [], characters: [] });

    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      writable: true,
      value: {
        on: mainEvents.on,
        grail: {
          getItems: vi.fn().mockResolvedValue([]),
        },
        inventory: {
          searchAll: searchAllMock,
          openSnapshotWindow: openSnapshotWindowMock,
          getActiveDragState: getActiveDragStateMock,
          sendVaultDragState: vi.fn(),
        },
        vault: {
          search: searchVaultMock,
          addItem: addItemMock,
          unvaultItem: unvaultItemMock,
        },
        saveFile: {
          refreshSaveFiles: vi.fn().mockResolvedValue({ success: true }),
        },
      },
    });

    searchVaultMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 200,
    });

    searchAllMock.mockResolvedValue({
      inventory: {
        snapshots: [
          {
            snapshotId: 'snap-1',
            characterName: 'Sorc',
            characterId: 'char-1',
            sourceFileType: 'd2s',
            sourceFilePath: '/tmp/sorc.d2s',
            capturedAt: new Date('2024-01-01T00:00:00.000Z'),
            items: [
              {
                fingerprint: 'fp-1',
                fingerprintInputs: {
                  sourceFileType: 'd2s',
                  characterName: 'Sorc',
                  locationContext: 'inventory',
                  quality: 'unique',
                  ethereal: false,
                  socketCount: 0,
                  gridX: 1,
                  gridY: 1,
                  gridWidth: 2,
                  gridHeight: 2,
                  isSocketedItem: false,
                  itemName: 'Shako',
                },
                characterName: 'Sorc',
                characterId: 'char-1',
                sourceFileType: 'd2s',
                sourceFilePath: '/tmp/sorc.d2s',
                locationContext: 'inventory',
                type: 'unique',
                gridX: 1,
                gridY: 1,
                gridWidth: 2,
                gridHeight: 2,
                isSocketedItem: false,
                itemName: 'Shako',
                quality: 'unique',
                ethereal: false,
                socketCount: 0,
                rawItemJson: '{}',
                rawParsedItem: {},
                seenAt: new Date('2024-01-01T00:00:00.000Z'),
              },
            ],
          },
        ],
        totalSnapshots: 1,
        totalItems: 1,
      },
      vault: {
        items: [],
        total: 0,
        page: 1,
        pageSize: 200,
      },
    });

    addItemMock.mockResolvedValue({ id: 'vault-1' });
    openSnapshotWindowMock.mockResolvedValue({ success: true });
    unvaultItemMock.mockResolvedValue({ success: true });
    for (const method of ['success', 'error'] as const) {
      vi.spyOn(toast, method).mockImplementation(() => 'toast-id');
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('If the page is shown', () => {
    it('Then it has the shared page heading and a short save file notice', async () => {
      // Arrange

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Inventory browser' }),
      ).toBeInTheDocument();
      const notice = screen.getByTestId('save-write-notice');
      expect(notice).toHaveTextContent(
        'Close Diablo II: Resurrected first. Changes here are written to your save files.',
      );
      expect(within(notice).getByRole('button', { name: 'Details' })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      expect(screen.getByText(/the game will overwrite your changes/)).not.toBeVisible();
    });

    it('Then the characters and stashes list comes before the vault and the filters sit inside it', async () => {
      // Arrange
      mockVaultOnly([createVaultItem({})]);

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      const listTitle = await screen.findByText('Characters & stashes');
      const vaultTitle = await screen.findByText('Vaulted items');
      const filters = screen.getByRole('group', { name: 'Filter items' });
      expect(
        listTitle.compareDocumentPosition(vaultTitle) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        listTitle.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        screen.getByText('Open a character or stash in its own window to move its items.'),
      ).toBeInTheDocument();
    });

    it('Then the item property filters are collapsed behind More filters and no chips are shown', async () => {
      // Arrange

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      const toggle = await screen.findByRole('button', { name: 'More filters' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      const panelId = toggle.getAttribute('aria-controls');
      expect(panelId).toBeTruthy();
      expect(document.getElementById(panelId as string)).not.toBeVisible();
      expect(screen.queryByRole('group', { name: 'Item properties' })).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Search' })).toBeVisible();
      expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
    });

    it('Then each filter dropdown has a label and shows the selected option', async () => {
      // Arrange

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      expect(await screen.findByRole('combobox', { name: 'Character' })).toHaveTextContent(
        'All characters',
      );
      expect(screen.getByRole('combobox', { name: 'Location' })).toHaveTextContent('All locations');
      expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('All types');
    });

    it('Then the vault drop area is hidden while nothing is dragged', async () => {
      // Arrange

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      await screen.findByText('Characters & stashes');
      expect(screen.queryByTestId('vault-dropzone')).not.toBeInTheDocument();
    });
  });

  describe('If More filters is opened', () => {
    it('Then the item property filters are shown and the toggle says it is expanded', async () => {
      // Arrange
      render(<InventoryBrowserMain />);
      const toggle = await screen.findByRole('button', { name: 'More filters' });

      // Act
      fireEvent.click(toggle);

      // Assert
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('group', { name: 'Item properties' })).toBeVisible();
      expect(screen.getByRole('textbox', { name: 'Base item or type' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Add stat' })).toBeVisible();
    });
  });

  describe('If the search and type filters are set', () => {
    async function setSearchAndTypeFilters(): Promise<void> {
      await screen.findByRole('button', { name: 'Vaulted item Shako' });
      fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
        target: { value: 'shako' },
      });
      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }));
      const option = await screen.findByRole('option', { name: 'Unique' });
      fireEvent.mouseMove(option);
      fireEvent.click(option);
    }

    it('Then each shows as a chip', async () => {
      // Arrange
      mockVaultOnly([createVaultItem({ type: 'unique' })]);
      render(<InventoryBrowserMain />);

      // Act
      await setSearchAndTypeFilters();

      // Assert
      const chips = await screen.findByRole('list', { name: 'Active filters' });
      await waitFor(() => {
        expect(within(chips).getByText('Type: Unique')).toBeInTheDocument();
      });
      expect(within(chips).getByText('Search: shako')).toBeInTheDocument();
    });

    it('Then removing the Search chip clears the search, keeps the Type chip and moves the focus to the search box', async () => {
      // Arrange
      mockVaultOnly([createVaultItem({ type: 'unique' })]);
      render(<InventoryBrowserMain />);
      await setSearchAndTypeFilters();
      const chips = await screen.findByRole('list', { name: 'Active filters' });
      await waitFor(() => {
        expect(within(chips).getByText('Type: Unique')).toBeInTheDocument();
      });

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Search: shako' }));

      // Assert
      expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('');
      expect(within(chips).queryByText('Search: shako')).not.toBeInTheDocument();
      expect(within(chips).getByText('Type: Unique')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus();
    });

    it('Then removing the Type chip sets the type back to all types and moves the focus to the search box', async () => {
      // Arrange
      mockVaultOnly([createVaultItem({ type: 'unique' })]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: 'Vaulted item Shako' });
      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }));
      const option = await screen.findByRole('option', { name: 'Unique' });
      fireEvent.mouseMove(option);
      fireEvent.click(option);
      const removeButton = await screen.findByRole('button', {
        name: 'Remove filter: Type: Unique',
      });
      removeButton.focus();

      // Act
      fireEvent.click(removeButton);

      // Assert
      expect(screen.getByRole('combobox', { name: 'Type' })).toHaveTextContent('All types');
      expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus();
    });
  });

  describe('If the details of the save file notice are opened', () => {
    it('Then the full safety message is shown and the toggle says so', async () => {
      // Arrange
      render(<InventoryBrowserMain />);
      const toggle = await screen.findByRole('button', { name: 'Details' });

      // Act
      fireEvent.click(toggle);

      // Assert
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(toggle).toHaveAccessibleName('Hide details');
      expect(
        screen.getByText(
          'Moving, vaulting and unvaulting items edits your save files directly. Close Diablo II: Resurrected first, or the game will overwrite your changes. A backup is made before every change.',
        ),
      ).toBeVisible();
    });
  });

  describe('If another window reports that it drags an inventory item', () => {
    it('Then the vault drop area appears as a labelled region and not a button', async () => {
      // Arrange
      render(<InventoryBrowserMain />);

      // Act
      await reportRemoteInventoryDrag();

      // Assert
      expect(screen.getByRole('region', { name: DROP_TEXT })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: DROP_TEXT })).not.toBeInTheDocument();
    });

    it('Then the vault drop area goes away once that window reports the drag ended', async () => {
      // Arrange
      render(<InventoryBrowserMain />);
      await reportRemoteInventoryDrag();

      // Act
      act(() => {
        mainEvents.emit(INVENTORY_DRAG_STATE_CHANNEL, { active: false, ...REMOTE_INVENTORY_DRAG });
      });

      // Assert
      expect(screen.queryByTestId('vault-dropzone')).not.toBeInTheDocument();
    });
  });

  describe('If another window reports a stack pickup', () => {
    it('Then no vault drop area is shown, because a pickup is placed by clicking', async () => {
      // Arrange
      render(<InventoryBrowserMain />);

      // Act
      await reportRemoteInventoryDrag({
        itemCode: 'r01',
        stackPickup: true,
        stackPickupCount: 2,
        stackPickupMaxCount: 5,
      });

      // Assert
      expect(screen.queryByTestId('vault-dropzone')).not.toBeInTheDocument();
    });
  });

  describe('If an inventory drag was already running when the page opened', () => {
    it('Then the vault drop area is shown', async () => {
      // Arrange
      getActiveDragStateMock.mockResolvedValue({
        inventory: { active: true, ...REMOTE_INVENTORY_DRAG },
      });

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      expect(await screen.findByTestId('vault-dropzone')).toBeInTheDocument();
    });
  });

  describe('If a stack pickup was already running when the page opened', () => {
    it('Then no vault drop area is shown but dragging over a snapshot still opens its window', async () => {
      // Arrange
      getActiveDragStateMock.mockResolvedValue({
        inventory: {
          active: true,
          ...REMOTE_INVENTORY_DRAG,
          itemCode: 'r01',
          stackPickup: true,
          stackPickupCount: 2,
          stackPickupMaxCount: 5,
        },
      });
      render(<InventoryBrowserMain />);
      const snapshotButton = await screen.findByRole('button', { name: /^Sorc Character/ });
      await waitFor(() => expect(getActiveDragStateMock).toHaveBeenCalled());
      await act(async () => {
        await Promise.resolve();
      });
      vi.useFakeTimers();

      // Act
      fireEvent.dragOver(snapshotButton, { dataTransfer: { types: [], getData: () => '' } });
      try {
        await vi.advanceTimersByTimeAsync(650);
        await Promise.resolve();

        // Assert
        expect(openSnapshotWindowMock).toHaveBeenCalledWith({
          sourceFilePath: '/tmp/sorc.d2s',
          sourceFileType: 'd2s',
          characterName: 'Sorc',
        });
        expect(screen.queryByTestId('vault-dropzone')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('If a drag with inventory item data enters the window', () => {
    it('Then the vault drop area is shown even without a drag state from another window', async () => {
      // Arrange
      render(<InventoryBrowserMain />);
      await screen.findByText('Characters & stashes');

      // Act
      enterWindowWithInventoryDrag();

      // Assert
      expect(screen.getByTestId('vault-dropzone')).toBeInTheDocument();
    });

    it('Then the vault drop area goes away when the drag ends', async () => {
      // Arrange
      render(<InventoryBrowserMain />);
      await screen.findByText('Characters & stashes');
      enterWindowWithInventoryDrag();

      // Act
      fireEvent.dragEnd(document.body);

      // Assert
      expect(screen.queryByTestId('vault-dropzone')).not.toBeInTheDocument();
    });

    it('Then the vault drop area goes away when the drag leaves the window', async () => {
      // Arrange
      render(<InventoryBrowserMain />);
      await screen.findByText('Characters & stashes');
      enterWindowWithInventoryDrag();

      // Act
      dragLeave(document.body, { relatedTarget: null, clientX: 0, clientY: 0 });

      // Assert
      expect(screen.queryByTestId('vault-dropzone')).not.toBeInTheDocument();
    });

    it('Then the vault drop area stays while the drag only moves between elements of the window', async () => {
      // Arrange
      render(<InventoryBrowserMain />);
      const row = await screen.findByRole('button', { name: /^Sorc Character/ });
      enterWindowWithInventoryDrag();

      // Act
      dragLeave(document.body, { relatedTarget: row, clientX: 0, clientY: 0 });
      dragLeave(row, { relatedTarget: null, clientX: 120, clientY: 80 });

      // Assert
      expect(screen.getByTestId('vault-dropzone')).toBeInTheDocument();
    });

    it('Then the vault drop area stays when the drag moves between elements at the left or top edge', async () => {
      // Arrange
      render(<InventoryBrowserMain />);
      const row = await screen.findByRole('button', { name: /^Sorc Character/ });
      enterWindowWithInventoryDrag();

      // Act
      dragLeave(row, { relatedTarget: null, clientX: 0, clientY: 80 });
      dragLeave(row, { relatedTarget: null, clientX: 120, clientY: 0 });

      // Assert
      expect(screen.getByTestId('vault-dropzone')).toBeInTheDocument();
    });

    it.each([
      ['left', -1, 80],
      ['top', 120, -1],
      ['right', window.innerWidth, 80],
      ['bottom', 120, window.innerHeight],
    ])('Then the vault drop area goes away when the drag leaves past the %s edge', async (_edge, clientX, clientY) => {
      // Arrange
      render(<InventoryBrowserMain />);
      const row = await screen.findByRole('button', { name: /^Sorc Character/ });
      enterWindowWithInventoryDrag();

      // Act
      dragLeave(row, { relatedTarget: null, clientX, clientY });

      // Assert
      expect(screen.queryByTestId('vault-dropzone')).not.toBeInTheDocument();
    });

    it('Then a drag another window reported stays when a drag leaves this window', async () => {
      // Arrange
      render(<InventoryBrowserMain />);
      await reportRemoteInventoryDrag();

      // Act
      dragLeave(document.body, { relatedTarget: null, clientX: 0, clientY: 0 });

      // Assert
      expect(screen.getByTestId('vault-dropzone')).toBeInTheDocument();
    });

    it('Then it can be dropped on the vault drop area, which then goes away', async () => {
      // Arrange
      render(<InventoryBrowserMain />);
      await screen.findByText('Characters & stashes');
      enterWindowWithInventoryDrag();
      const payload = {
        fingerprint: 'fp-local',
        itemName: 'Harlequin Crest',
        quality: 'unique',
        ethereal: false,
        socketCount: 0,
        rawItemJson: '{"id":5}',
        sourceFileType: 'd2s' as const,
        sourceFilePath: '/tmp/sorc.d2s',
        locationContext: 'inventory' as const,
      };

      // Act
      fireEvent.drop(screen.getByText(DROP_TEXT), {
        dataTransfer: {
          getData: (format: string) =>
            format === 'text/plain' ? serializeInventoryTextPayload(payload) : '',
        },
      });

      // Assert
      await waitFor(() => {
        expect(addItemMock).toHaveBeenCalledWith(payload);
      });
      expect(screen.queryByTestId('vault-dropzone')).not.toBeInTheDocument();
    });
  });

  describe('If the page is closed', () => {
    it('Then every window and drag state listener it added is removed again', async () => {
      // Arrange
      const addSpy = vi.spyOn(window, 'addEventListener');
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = render(<InventoryBrowserMain />);
      await screen.findByText('Characters & stashes');
      await waitFor(() => expect(mainEvents.listenerCount(INVENTORY_DRAG_STATE_CHANNEL)).toBe(1));

      // Act
      unmount();

      // Assert
      for (const type of ['dragenter', 'dragleave', 'dragend', 'drop']) {
        const added = addSpy.mock.calls.filter(([addedType]) => addedType === type);
        expect(added).toHaveLength(1);
        expect(removeSpy).toHaveBeenCalledWith(type, added[0]?.[1]);
      }
      expect(mainEvents.listenerCount(INVENTORY_DRAG_STATE_CHANNEL)).toBe(0);
      expect(mainEvents.listenerCount(VAULT_DRAG_STATE_CHANNEL)).toBe(0);
    });
  });

  describe('If the active drag state cannot be read when the page opens', () => {
    it('Then the page still works without a vault drop area and logs a warning', async () => {
      // Arrange
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const failure = new Error('ipc failed');
      getActiveDragStateMock.mockRejectedValue(failure);

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      expect(await screen.findByRole('button', { name: /^Sorc Character/ })).toBeInTheDocument();
      await waitFor(() => {
        expect(warnSpy).toHaveBeenCalledWith('Failed to get active inventory drag state', failure);
      });
      expect(screen.queryByTestId('vault-dropzone')).not.toBeInTheDocument();

      // Act
      await reportRemoteInventoryDrag();

      // Assert
      expect(screen.getByTestId('vault-dropzone')).toBeInTheDocument();
    });
  });

  describe('If the Other type is chosen in the filters', () => {
    it('Then the vault only shows items of types other than unique, set, runeword and rune', async () => {
      // Arrange
      mockVaultOnly([
        createVaultItem({ id: 'vault-unique', type: 'unique', itemName: 'Shako' }),
        createVaultItem({ id: 'vault-rune', fingerprint: 'vfp-2', type: 'rune', itemName: 'Ber' }),
        createVaultItem({ id: 'vault-none', fingerprint: 'vfp-3', itemName: 'Mystery Charm' }),
        createVaultItem({
          id: 'vault-charm',
          fingerprint: 'vfp-4',
          type: 'charm',
          itemName: 'Annihilus',
        }),
      ]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: 'Vaulted item Shako' });

      // Act
      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }));
      const option = await screen.findByRole('option', { name: 'Other' });
      fireEvent.mouseMove(option);
      fireEvent.click(option);

      // Assert
      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: 'Vaulted item Shako' }),
        ).not.toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: 'Vaulted item Ber' })).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Vaulted item Mystery Charm' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Vaulted item Annihilus' })).toBeInTheDocument();
    });
  });

  describe('If a type is chosen in the filters', () => {
    it('Then the vault only shows items of that type and says that it is filtered', async () => {
      // Arrange
      mockVaultOnly([
        createVaultItem({ id: 'vault-unique', type: 'unique', itemName: 'Shako' }),
        createVaultItem({
          id: 'vault-set',
          fingerprint: 'vfp-2',
          type: 'set',
          itemName: 'Tal Rasha Wrappings',
        }),
      ]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: 'Vaulted item Shako' });

      // Act
      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }));
      const option = await screen.findByRole('option', { name: 'Set' });
      fireEvent.mouseMove(option);
      fireEvent.click(option);

      // Assert
      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: 'Vaulted item Shako' }),
        ).not.toBeInTheDocument();
      });
      expect(
        screen.getByRole('button', { name: 'Vaulted item Tal Rasha Wrappings' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Showing only vaulted items that match your filters.'),
      ).toBeInTheDocument();
    });
  });

  describe('If the type filter excludes every vaulted item', () => {
    it('Then the vault still says it is filtered and that nothing matches', async () => {
      // Arrange
      mockVaultOnly([createVaultItem({ type: 'unique', itemName: 'Shako' })]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: 'Vaulted item Shako' });

      // Act
      fireEvent.click(screen.getByRole('combobox', { name: 'Type' }));
      const option = await screen.findByRole('option', { name: 'Set' });
      fireEvent.mouseMove(option);
      fireEvent.click(option);

      // Assert
      await waitFor(() => {
        expect(
          screen.queryByRole('button', { name: 'Vaulted item Shako' }),
        ).not.toBeInTheDocument();
      });
      const vaultCard = screen.getByText('Vaulted items').closest('[data-slot="card"]');
      expect(vaultCard).not.toBeNull();
      expect(
        within(vaultCard as HTMLElement).getByText(
          'Showing only vaulted items that match your filters.',
        ),
      ).toBeInTheDocument();
      expect(
        within(vaultCard as HTMLElement).getByText('No inventory items match your filters.'),
      ).toBeInTheDocument();
    });
  });

  describe('If the search matches no vaulted item', () => {
    it('Then the vault still says it is filtered and that nothing matches', async () => {
      // Arrange
      mockVaultOnly([createVaultItem({})]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: 'Vaulted item Shako' });
      mockVaultOnly([]);

      // Act
      fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
        target: { value: 'nothing like this' },
      });

      // Assert
      expect(
        await screen.findByText('Showing only vaulted items that match your filters.'),
      ).toBeInTheDocument();
      expect(screen.getByText('Vaulted items')).toBeInTheDocument();
      expect(screen.getByText('No inventory items match your filters.')).toBeInTheDocument();
    });
  });

  describe('If the inventory reloads while the vault shows that nothing matches', () => {
    it('Then the vault card stays in place instead of being removed and added again', async () => {
      // Arrange
      mockVaultOnly([createVaultItem({})]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: 'Vaulted item Shako' });
      mockVaultOnly([]);
      fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
        target: { value: 'nothing like this' },
      });
      const vaultTitle = await screen.findByText('Vaulted items');
      const vaultCard = vaultTitle.closest('[data-slot="card"]');
      await waitFor(() => expect(searchAllMock).toHaveBeenCalledTimes(2));
      searchAllMock.mockReturnValue(new Promise(() => undefined));

      // Act
      act(() => {
        mainEvents.emit('save-file-event');
      });
      await waitFor(() => expect(searchAllMock).toHaveBeenCalledTimes(3));

      // Assert
      const cardDuringReload = screen.getByText('Vaulted items').closest('[data-slot="card"]');
      expect(cardDuringReload).not.toBeNull();
      expect(cardDuringReload).toBe(vaultCard);
    });
  });

  describe('If the first inventory load fails while a filter is active', () => {
    it('Then no vault card is shown', async () => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      searchAllMock.mockRejectedValue(new Error('search failed'));
      render(<InventoryBrowserMain />);
      await screen.findByRole('textbox', { name: 'Search' });

      // Act
      fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
        target: { value: 'shako' },
      });
      await waitFor(() => expect(searchAllMock).toHaveBeenCalledTimes(2));
      await act(async () => {
        await Promise.resolve();
      });

      // Assert
      expect(screen.queryByText('Vaulted items')).not.toBeInTheDocument();
    });
  });

  describe('If no filter is active and the vault is empty', () => {
    it('Then no vault section is shown', async () => {
      // Arrange

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      await screen.findByRole('button', { name: /^Sorc Character/ });
      expect(screen.queryByText('Vaulted items')).not.toBeInTheDocument();
      expect(
        screen.queryByText('Showing only vaulted items that match your filters.'),
      ).not.toBeInTheDocument();
    });
  });

  describe('If the character of a snapshot is tracked', () => {
    it('Then its row shows the class and level', async () => {
      // Arrange
      useGrailStore.setState({ characters: [createCharacter({})] });

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      const row = await screen.findByRole('button', { name: 'Sorc Level 90 Sorceress 1 item' });
      expect(within(row).getByText('Level 90 Sorceress')).toBeInTheDocument();
    });
  });

  describe('If the list holds shared stashes and characters', () => {
    function createListSnapshot(
      characterName: string,
      sourceFileType: 'd2s' | 'd2i',
      itemType = 'unique',
    ) {
      const sourceFilePath = `/tmp/${characterName}.${sourceFileType}`;
      return {
        snapshotId: `snap-${characterName}`,
        characterName,
        sourceFileType,
        sourceFilePath,
        capturedAt: new Date('2024-01-01T00:00:00.000Z'),
        items: [
          {
            fingerprint: `fp-${characterName}`,
            characterName,
            sourceFileType,
            sourceFilePath,
            locationContext: 'inventory',
            type: itemType,
            isSocketedItem: false,
            itemName: 'Shako',
            quality: 'unique',
            ethereal: false,
            socketCount: 0,
            rawItemJson: '{}',
            seenAt: new Date('2024-01-01T00:00:00.000Z'),
          },
        ],
      };
    }

    function mockListSnapshots(snapshots: ReturnType<typeof createListSnapshot>[]): void {
      searchAllMock.mockResolvedValue({
        inventory: { snapshots, totalSnapshots: snapshots.length, totalItems: snapshots.length },
        vault: { items: [], total: 0, page: 1, pageSize: 200 },
      });
    }

    describe('and none is filtered out', () => {
      beforeEach(() => {
        mockListSnapshots([
          createListSnapshot('Gems', 'd2s'),
          createListSnapshot('Runewords', 'd2s'),
          createListSnapshot('Shared Stash Softcore', 'd2i'),
          createListSnapshot('Sinsin', 'd2s'),
          createListSnapshot('Modern Shared Stash Softcore', 'd2i'),
        ]);
        useGrailStore.setState({
          characters: [
            createCharacter({ id: 'gems', name: 'Gems', level: 1 }),
            createCharacter({ id: 'runewords', name: 'Runewords', level: 1 }),
            createCharacter({ id: 'sinsin', name: 'Sinsin', level: 93 }),
          ],
        });
      });

      it('Then shared stashes come first, ordered by name, and characters follow under their own heading by level', async () => {
        // Arrange

        // Act
        render(<InventoryBrowserMain />);

        // Assert
        const stashes = await screen.findByRole('region', { name: 'Shared stashes' });
        const characters = screen.getByRole('region', { name: 'Characters' });
        expect(
          stashes.compareDocumentPosition(characters) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(
          within(stashes)
            .getAllByRole('button')
            .map((row) => row.textContent),
        ).toEqual([
          expect.stringMatching(/^Modern Shared Stash Softcore/),
          expect.stringMatching(/^Shared Stash Softcore/),
        ]);
        expect(
          within(characters)
            .getAllByRole('button')
            .map((row) => row.textContent),
        ).toEqual([
          expect.stringMatching(/^Sinsin/),
          expect.stringMatching(/^Gems/),
          expect.stringMatching(/^Runewords/),
        ]);
      });

      it('Then the list title is a page heading and not a card title', async () => {
        // Arrange

        // Act
        render(<InventoryBrowserMain />);

        // Assert
        const listHeading = await screen.findByRole('heading', {
          level: 2,
          name: 'Characters & stashes',
        });
        expect(listHeading.closest('[data-slot="card"]')).toBeNull();
      });
    });

    describe('and a type filter leaves only characters', () => {
      it('Then only the Characters heading is shown and the Shared stashes heading is gone', async () => {
        // Arrange
        mockListSnapshots([
          createListSnapshot('Shared Stash Softcore', 'd2i', 'rune'),
          createListSnapshot('Sinsin', 'd2s', 'unique'),
        ]);
        render(<InventoryBrowserMain />);
        await screen.findByRole('region', { name: 'Shared stashes' });

        // Act
        fireEvent.click(screen.getByRole('combobox', { name: 'Type' }));
        const option = await screen.findByRole('option', { name: 'Unique' });
        fireEvent.mouseMove(option);
        fireEvent.click(option);

        // Assert
        await waitFor(() => {
          expect(screen.queryByRole('region', { name: 'Shared stashes' })).not.toBeInTheDocument();
        });
        expect(screen.getByRole('region', { name: 'Characters' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Shared stashes' })).not.toBeInTheDocument();
      });
    });
  });

  describe('If the inventory is still loading', () => {
    it('Then a loading status is shown instead of an empty list', async () => {
      // Arrange
      searchAllMock.mockReturnValue(new Promise(() => undefined));

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      const loadingText = await screen.findByText('Loading...');
      expect(loadingText.closest('output')).not.toBeNull();
      expect(
        screen.queryByText('No character or stash snapshots match your current filters.'),
      ).not.toBeInTheDocument();
    });
  });

  describe('If a snapshot holds a single item', () => {
    it('Then its count uses the singular form and the row names the file kind in plain words', async () => {
      // Arrange

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      const row = await screen.findByRole('button', { name: 'Sorc Character 1 item' });
      expect(within(row).getByText('1 item')).toBeInTheDocument();
      expect(within(row).queryByText(/Captured/)).not.toBeInTheDocument();
    });
  });

  describe('If a vaulted item is shown', () => {
    it('Then its tile is named after the item', async () => {
      // Arrange
      mockVaultOnly([createVaultItem({})]);

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      expect(await screen.findByRole('button', { name: 'Vaulted item Shako' })).toBeInTheDocument();
    });
  });

  describe('If a vaulted item that came from an inventory cell is selected', () => {
    it('Then putting it back writes it to its original cell', async () => {
      // Arrange
      mockVaultOnly([createVaultItem({ sourceFilePath: '/tmp/sorc.d2s', gridX: 4, gridY: 2 })]);
      render(<InventoryBrowserMain />);
      fireEvent.click(await screen.findByRole('button', { name: 'Vaulted item Shako' }));

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Put back where it was' }));

      // Assert
      await waitFor(() => {
        expect(unvaultItemMock).toHaveBeenCalledWith('vault-1', {
          targetFilePath: '/tmp/sorc.d2s',
          targetFileType: 'd2s',
          targetLocationContext: 'inventory',
          targetGridX: 4,
          targetGridY: 2,
        });
      });
      expect(screen.queryByRole('button', { name: 'Unvault' })).not.toBeInTheDocument();
    });
  });

  describe('If a vaulted item that came from an equipped slot is selected', () => {
    it('Then there is no unvault button, only how to drag it into a character', async () => {
      // Arrange
      mockVaultOnly([
        createVaultItem({
          sourceFilePath: '/tmp/sorc.d2s',
          locationContext: 'equipped',
          equippedSlotId: 1,
        }),
      ]);
      render(<InventoryBrowserMain />);

      // Act
      fireEvent.click(await screen.findByRole('button', { name: 'Vaulted item Shako' }));

      // Assert
      expect(
        screen.getByText(
          'To take this item out of the vault, open a character or stash and drag the item onto a free spot.',
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Unvault' })).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'Put back where it was' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('If a vaulted item that was not taken out of a save file is selected', () => {
    it('Then the unvault button unvaults it without a target', async () => {
      // Arrange
      mockVaultOnly([createVaultItem({})]);
      render(<InventoryBrowserMain />);
      fireEvent.click(await screen.findByRole('button', { name: 'Vaulted item Shako' }));

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Unvault' }));

      // Assert
      await waitFor(() => {
        expect(unvaultItemMock).toHaveBeenCalledWith('vault-1');
      });
    });
  });

  describe('If snapshot data is available', () => {
    it('Then it renders snapshot names and not inline inventory boards', async () => {
      // Arrange

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      await waitFor(() => {
        expect(screen.getByText('Characters & stashes')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Sorc Character 1 item' })).toBeInTheDocument();
      expect(screen.queryByTestId('inventory-board-snap-1')).not.toBeInTheDocument();
    });
  });

  describe('If a snapshot name is clicked', () => {
    it('Then it opens the snapshot popup window for that target', async () => {
      // Arrange
      render(<InventoryBrowserMain />);

      // Act
      const snapshotButton = await screen.findByRole('button', {
        name: /^Sorc Character/,
      });
      fireEvent.click(snapshotButton);

      // Assert
      await waitFor(() => {
        expect(openSnapshotWindowMock).toHaveBeenCalledWith({
          sourceFilePath: '/tmp/sorc.d2s',
          sourceFileType: 'd2s',
          characterName: 'Sorc',
        });
      });
    });
  });

  describe('If an item is dragged over a snapshot name', () => {
    it('Then it opens the snapshot popup after a hover delay', async () => {
      // Arrange
      render(<InventoryBrowserMain />);
      const snapshotButton = await screen.findByRole('button', {
        name: /^Sorc Character/,
      });
      vi.useFakeTimers();

      const payload = {
        fingerprint: 'fp-hover',
        itemName: 'Harlequin Crest',
        quality: 'unique',
        ethereal: false,
        socketCount: 0,
        rawItemJson: '{"id":321}',
        sourceFileType: 'd2s' as const,
        sourceFilePath: '/tmp/sorc.d2s',
        locationContext: 'inventory' as const,
      };

      // Act
      fireEvent.dragOver(snapshotButton, {
        dataTransfer: {
          types: ['text/plain'],
          getData: (format: string) =>
            format === 'text/plain' ? serializeInventoryTextPayload(payload) : '',
        },
      });
      try {
        await vi.advanceTimersByTimeAsync(649);

        // Assert
        expect(openSnapshotWindowMock).not.toHaveBeenCalled();

        // Act
        await vi.advanceTimersByTimeAsync(1);
        await Promise.resolve();

        // Assert
        expect(openSnapshotWindowMock).toHaveBeenCalledWith({
          sourceFilePath: '/tmp/sorc.d2s',
          sourceFileType: 'd2s',
          characterName: 'Sorc',
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it('Then it does not open the snapshot popup if hover ends before delay', async () => {
      // Arrange
      render(<InventoryBrowserMain />);
      const snapshotButton = await screen.findByRole('button', {
        name: /^Sorc Character/,
      });
      vi.useFakeTimers();

      const payload = {
        fingerprint: 'fp-hover-cancel',
        itemName: 'Harlequin Crest',
        quality: 'unique',
        ethereal: false,
        socketCount: 0,
        rawItemJson: '{"id":654}',
        sourceFileType: 'd2s' as const,
        sourceFilePath: '/tmp/sorc.d2s',
        locationContext: 'inventory' as const,
      };

      // Act
      fireEvent.dragOver(snapshotButton, {
        dataTransfer: {
          types: ['text/plain'],
          getData: (format: string) =>
            format === 'text/plain' ? serializeInventoryTextPayload(payload) : '',
        },
      });
      try {
        await vi.advanceTimersByTimeAsync(300);
        fireEvent.dragLeave(snapshotButton);
        await vi.advanceTimersByTimeAsync(1000);

        // Assert
        expect(openSnapshotWindowMock).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('If vault search includes an item with a matching fingerprint', () => {
    it('Then matching snapshot names still remain visible in the main list', async () => {
      // Arrange
      searchAllMock.mockResolvedValueOnce({
        inventory: {
          snapshots: [
            {
              snapshotId: 'snap-sorc',
              characterName: 'Sorc',
              characterId: 'char-1',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/sorc.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-sorc',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Sorc',
                    locationContext: 'inventory',
                    quality: 'unique',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 0,
                    gridY: 0,
                    gridWidth: 2,
                    gridHeight: 2,
                    isSocketedItem: false,
                    itemName: 'Shako',
                  },
                  characterName: 'Sorc',
                  characterId: 'char-1',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/sorc.d2s',
                  locationContext: 'inventory',
                  type: 'unique',
                  gridX: 0,
                  gridY: 0,
                  gridWidth: 2,
                  gridHeight: 2,
                  isSocketedItem: false,
                  itemName: 'Shako',
                  quality: 'unique',
                  ethereal: false,
                  socketCount: 0,
                  rawItemJson: '{}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
              ],
            },
            {
              snapshotId: 'snap-barb',
              characterName: 'Barb',
              characterId: 'char-2',
              sourceFileType: 'd2s',
              sourceFilePath: '/tmp/barb.d2s',
              capturedAt: new Date('2024-01-01T00:00:00.000Z'),
              items: [
                {
                  fingerprint: 'fp-barb',
                  fingerprintInputs: {
                    sourceFileType: 'd2s',
                    characterName: 'Barb',
                    locationContext: 'inventory',
                    quality: 'set',
                    ethereal: false,
                    socketCount: 0,
                    gridX: 0,
                    gridY: 0,
                    gridWidth: 2,
                    gridHeight: 2,
                    isSocketedItem: false,
                    itemName: "Arreat's Face",
                  },
                  characterName: 'Barb',
                  characterId: 'char-2',
                  sourceFileType: 'd2s',
                  sourceFilePath: '/tmp/barb.d2s',
                  locationContext: 'inventory',
                  type: 'set',
                  gridX: 0,
                  gridY: 0,
                  gridWidth: 2,
                  gridHeight: 2,
                  isSocketedItem: false,
                  itemName: "Arreat's Face",
                  quality: 'set',
                  ethereal: false,
                  socketCount: 0,
                  rawItemJson: '{}',
                  rawParsedItem: {},
                  seenAt: new Date('2024-01-01T00:00:00.000Z'),
                },
              ],
            },
          ],
          totalSnapshots: 2,
          totalItems: 2,
        },
        vault: {
          items: [
            {
              id: 'vault-1',
              fingerprint: 'fp-sorc',
              itemName: 'Shako',
              quality: 'unique',
              ethereal: false,
              rawItemJson: '{}',
              sourceFileType: 'd2s',
              locationContext: 'inventory',
              isPresentInLatestScan: true,
              created: new Date('2024-01-01T00:00:00.000Z'),
              lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
            },
          ],
          total: 1,
          page: 1,
          pageSize: 200,
        },
      });

      // Act
      render(<InventoryBrowserMain />);

      // Assert
      expect(await screen.findByRole('button', { name: /^Sorc Character/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Barb Character/ })).toBeInTheDocument();
    });
  });

  describe('If item property filters are set', () => {
    const baseSnapshot = {
      snapshotId: 'snap-stash',
      characterName: 'Shared stash',
      sourceFileType: 'd2i',
      sourceFilePath: '/tmp/stash.d2i',
      capturedAt: new Date('2024-01-01T00:00:00.000Z'),
    };

    function createInventoryItem(
      fingerprint: string,
      itemName: string,
      raw: Record<string, unknown>,
      ethereal = false,
    ) {
      return {
        fingerprint,
        characterName: 'Shared stash',
        sourceFileType: 'd2i',
        sourceFilePath: '/tmp/stash.d2i',
        locationContext: 'stash',
        stashTab: 0,
        itemName,
        quality: 'normal',
        ethereal,
        socketCount: 1,
        rawItemJson: JSON.stringify(raw),
        seenAt: new Date('2024-01-01T00:00:00.000Z'),
      };
    }

    function mockStash(items: ReturnType<typeof createInventoryItem>[], vault: VaultItem[] = []) {
      searchAllMock.mockResolvedValue({
        inventory: {
          snapshots: [{ ...baseSnapshot, items }],
          totalSnapshots: 1,
          totalItems: items.length,
        },
        vault: { items: vault, total: vault.length, page: 1, pageSize: 200 },
      });
    }

    async function chooseOption(comboboxName: string, optionName: string): Promise<void> {
      fireEvent.click(screen.getByRole('combobox', { name: comboboxName }));
      const option = await screen.findByRole('option', { name: optionName });
      fireEvent.mouseMove(option);
      fireEvent.click(option);
    }

    function openMoreFilters(): void {
      fireEvent.click(screen.getByRole('button', { name: 'More filters' }));
    }

    it('Then the hidden filters stay visible as chips and in the toggle count once More filters is closed', async () => {
      // Arrange
      mockStash([createInventoryItem('fp-life', 'Small Charm of Life', {})]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: /^Shared stash/ });
      openMoreFilters();
      await chooseOption('Sockets', '4');
      await chooseOption('Ethereal', 'Ethereal only');
      fireEvent.click(screen.getByRole('button', { name: 'Add stat' }));
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Life at least' }), {
        target: { value: '15' },
      });

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'More filters (3 active)' }));

      // Assert
      const toggle = screen.getByRole('button', { name: 'More filters (3 active)' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle).toHaveAccessibleName('More filters (3 active)');
      expect(toggle).toHaveTextContent(/^More filters\s*3$/);
      expect(screen.queryByRole('group', { name: 'Item properties' })).not.toBeInTheDocument();
      const chips = screen.getByRole('list', { name: 'Active filters' });
      expect(within(chips).getByText('Sockets: exactly 4')).toBeInTheDocument();
      expect(within(chips).getByText('Ethereal: Ethereal only')).toBeInTheDocument();
      expect(within(chips).getByText('Life at least 15')).toBeInTheDocument();
    });

    it('Then removing a stat chip removes that stat row', async () => {
      // Arrange
      mockStash([createInventoryItem('fp-life', 'Small Charm of Life', {})]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: /^Shared stash/ });
      openMoreFilters();
      fireEvent.click(screen.getByRole('button', { name: 'Add stat' }));

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Stat: Life' }));

      // Assert
      expect(screen.queryByRole('group', { name: 'Stat filter 1' })).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'More filters' })).toBeInTheDocument();
    });

    it('Then removing a hidden filter chip while More filters is closed removes the chip and moves the focus to the search box', async () => {
      // Arrange
      mockStash([createInventoryItem('fp-life', 'Small Charm of Life', {})]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: /^Shared stash/ });
      openMoreFilters();
      await chooseOption('Sockets', '4');
      fireEvent.click(screen.getByRole('button', { name: 'More filters (1 active)' }));
      const removeButton = screen.getByRole('button', {
        name: 'Remove filter: Sockets: exactly 4',
      });
      removeButton.focus();

      // Act
      fireEvent.click(removeButton);

      // Assert
      expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'More filters' })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus();
    });

    it('Then the sockets filter is off when More filters is opened again after its hidden chip was removed', async () => {
      // Arrange
      mockStash([createInventoryItem('fp-life', 'Small Charm of Life', {})]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: /^Shared stash/ });
      openMoreFilters();
      await chooseOption('Sockets', '4');
      fireEvent.click(screen.getByRole('button', { name: 'More filters (1 active)' }));
      fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Sockets: exactly 4' }));

      // Act
      openMoreFilters();

      // Assert
      expect(screen.getByRole('combobox', { name: 'Sockets' })).toHaveTextContent('Any');
    });

    it('Then the sockets chip says the socket count is exact by default', async () => {
      // Arrange
      mockStash([createInventoryItem('fp-life', 'Small Charm of Life', {})]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: /^Shared stash/ });
      openMoreFilters();

      // Act
      await chooseOption('Sockets', '4');

      // Assert
      const chips = screen.getByRole('list', { name: 'Active filters' });
      expect(within(chips).getByText('Sockets: exactly 4')).toBeInTheDocument();
    });

    it('If the socket count is set to at least, Then the sockets chip says it is a minimum', async () => {
      // Arrange
      mockStash([createInventoryItem('fp-life', 'Small Charm of Life', {})]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: /^Shared stash/ });
      openMoreFilters();
      await chooseOption('Sockets', '4');

      // Act
      await chooseOption('Socket count', 'At least');

      // Assert
      const chips = screen.getByRole('list', { name: 'Active filters' });
      expect(within(chips).getByText('Sockets: at least 4')).toBeInTheDocument();
      expect(within(chips).queryByText('Sockets: exactly 4')).not.toBeInTheDocument();
    });

    it('Then the minimum roll quality shows as a chip', async () => {
      // Arrange
      mockStash([createInventoryItem('fp-life', 'Small Charm of Life', {})]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: /^Shared stash/ });
      openMoreFilters();

      // Act
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Roll quality at least (%)' }), {
        target: { value: '80' },
      });

      // Assert
      const chips = screen.getByRole('list', { name: 'Active filters' });
      expect(within(chips).getByText('Roll quality at least 80%')).toBeInTheDocument();
    });

    it('Then removing the minimum roll quality chip clears the roll quality filter', async () => {
      // Arrange
      mockStash([createInventoryItem('fp-life', 'Small Charm of Life', {})]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: /^Shared stash/ });
      openMoreFilters();
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Roll quality at least (%)' }), {
        target: { value: '80' },
      });

      // Act
      fireEvent.click(
        screen.getByRole('button', { name: 'Remove filter: Roll quality at least 80%' }),
      );

      // Assert
      expect(screen.getByRole('spinbutton', { name: 'Roll quality at least (%)' })).toHaveValue(
        null,
      );
      expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument();
    });

    it('Then Clear all turns every filter off, keeps the sort order and moves the focus to the search box', async () => {
      // Arrange
      mockStash([createInventoryItem('fp-life', 'Small Charm of Life', {})]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: /^Shared stash/ });
      fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), {
        target: { value: 'charm' },
      });
      openMoreFilters();
      fireEvent.change(screen.getByRole('textbox', { name: 'Base item or type' }), {
        target: { value: 'charm' },
      });
      await chooseOption('Ethereal', 'Not ethereal');
      await chooseOption('Sockets', '4');
      await chooseOption('Sort by', 'Best roll first');

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));

      // Assert
      expect(screen.getByRole('textbox', { name: 'Search' })).toHaveValue('');
      expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus();
      expect(screen.getByRole('textbox', { name: 'Base item or type' })).toHaveValue('');
      expect(screen.getByRole('combobox', { name: 'Ethereal' })).toHaveTextContent('Any');
      expect(screen.getByRole('combobox', { name: 'Sockets' })).toHaveTextContent('Any');
      expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveTextContent(
        'Best roll first',
      );
      expect(screen.queryByRole('list', { name: 'Active filters' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'More filters' })).toBeInTheDocument();
    });

    it('Then ethereal and socket filters narrow the list and the matching items are listed', async () => {
      // Arrange
      mockStash([
        createInventoryItem(
          'fp-eth',
          'Thresher',
          { type: '7s8', type_name: 'Thresher', total_nr_of_sockets: 4 },
          true,
        ),
        createInventoryItem('fp-plain', 'Giant Thresher', {
          type: '7wc',
          type_name: 'Giant Thresher',
          total_nr_of_sockets: 4,
        }),
      ]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: /^Shared stash/ });
      openMoreFilters();

      // Act
      fireEvent.change(screen.getByRole('textbox', { name: 'Base item or type' }), {
        target: { value: 'thresher' },
      });
      await chooseOption('Sockets', '4');
      await chooseOption('Ethereal', 'Ethereal only');

      // Assert
      const matches = await screen.findByRole('region', { name: 'Matching items' });
      await waitFor(() => {
        expect(within(matches).queryByText('Giant Thresher')).not.toBeInTheDocument();
      });
      expect(within(matches).getByRole('button', { name: /Thresher/ })).toHaveTextContent(
        'Shared stash, Stash tab 1',
      );
      expect(screen.getByRole('button', { name: /^Shared stash/ })).toHaveTextContent('1 item');
    });

    it('Then a stat filter keeps only items with that stat at the minimum', async () => {
      // Arrange
      mockStash([
        createInventoryItem('fp-life', 'Small Charm of Life', {
          combined_magic_attributes: [
            { name: 'maxhp', values: [20] },
            { name: 'item_fastergethitrate', values: [5] },
          ],
        }),
        createInventoryItem('fp-weak', 'Small Charm of Vita', {
          combined_magic_attributes: [{ name: 'maxhp', values: [10] }],
        }),
      ]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: /^Shared stash/ });
      openMoreFilters();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Add stat' }));
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Life at least' }), {
        target: { value: '15' },
      });

      // Assert
      const matches = await screen.findByRole('region', { name: 'Matching items' });
      await waitFor(() => {
        expect(within(matches).queryByText('Small Charm of Vita')).not.toBeInTheDocument();
      });
      expect(within(matches).getByText('Small Charm of Life')).toBeInTheDocument();
    });

    it('Then each stat row is a labelled group inside the Item properties group', async () => {
      // Arrange
      mockStash([createInventoryItem('fp-life', 'Small Charm of Life', {})]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: /^Shared stash/ });
      openMoreFilters();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Add stat' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add stat' }));

      // Assert
      const properties = screen.getByRole('group', { name: 'Item properties' });
      expect(within(properties).getByRole('group', { name: 'Stat filter 1' })).toBeInTheDocument();
      expect(within(properties).getByRole('group', { name: 'Stat filter 2' })).toBeInTheDocument();
    });

    it('Then a new stat row gets the focus and removing a row moves the focus to Add stat', async () => {
      // Arrange
      mockStash([createInventoryItem('fp-life', 'Small Charm of Life', {})]);
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: /^Shared stash/ });
      openMoreFilters();

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Add stat' }));
      const newRow = screen.getByRole('group', { name: 'Stat filter 1' });

      // Assert
      await waitFor(() => {
        expect(within(newRow).getByRole('combobox', { name: 'Stat' })).toHaveFocus();
      });

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Remove Life filter' }));

      // Assert
      expect(screen.queryByRole('group', { name: 'Stat filter 1' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add stat' })).toHaveFocus();
    });

    it('Then sorting by roll quality puts the best vaulted roll first', async () => {
      // Arrange: two Annihilus (unique 381), one perfect and one with the lowest rolls
      const rawAnnihilus = (statValue: number, experience: number) =>
        JSON.stringify({
          quality: 7,
          unique_id: 381,
          magic_attributes: [
            { name: 'strength', values: [statValue] },
            { name: 'fireresist', values: [statValue] },
            { name: 'item_addexperience', values: [experience] },
          ],
        });
      mockStash(
        [],
        [
          createVaultItem({
            id: 'vault-low',
            itemName: 'Low Anni',
            rawItemJson: rawAnnihilus(10, 5),
          }),
          createVaultItem({
            id: 'vault-perfect',
            fingerprint: 'vfp-2',
            itemName: 'Perfect Anni',
            rawItemJson: rawAnnihilus(20, 10),
          }),
        ],
      );
      render(<InventoryBrowserMain />);
      await screen.findByRole('button', { name: 'Vaulted item Low Anni' });
      openMoreFilters();

      // Act
      await chooseOption('Sort by', 'Best roll first');

      // Assert
      await waitFor(() => {
        const tiles = screen.getAllByRole('button', { name: /^Vaulted item/ });
        expect(tiles.map((tile) => tile.getAttribute('aria-label'))).toEqual([
          'Vaulted item Perfect Anni',
          'Vaulted item Low Anni',
        ]);
      });
    });
  });

  describe('If an inventory payload is dropped onto the vault dropzone', () => {
    it('Then it vaults the dropped item using the serialized text payload', async () => {
      // Arrange
      render(<InventoryBrowserMain />);
      const payload = {
        fingerprint: 'fp-drop',
        itemName: 'Harlequin Crest',
        quality: 'unique',
        ethereal: false,
        socketCount: 0,
        rawItemJson: '{"id":123}',
        sourceFileType: 'd2s' as const,
        sourceFilePath: '/tmp/sorc.d2s',
        locationContext: 'inventory' as const,
      };
      await reportRemoteInventoryDrag();
      const dropzone = screen.getByText(DROP_TEXT);

      // Act
      fireEvent.drop(dropzone, {
        dataTransfer: {
          getData: (format: string) =>
            format === 'text/plain' ? serializeInventoryTextPayload(payload) : '',
        },
      });

      // Assert
      await waitFor(() => {
        expect(addItemMock).toHaveBeenCalledWith(payload);
      });
      expect(screen.queryByTestId('vault-dropzone')).not.toBeInTheDocument();
    });
  });
});
