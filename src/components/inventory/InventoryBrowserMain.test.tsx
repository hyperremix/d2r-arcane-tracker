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
      expect(filters).toHaveAccessibleDescription(
        'Narrows the list to characters and stashes with matching items, and the vault to matching items. Counts show the matches. Opened windows always show all items.',
      );
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
