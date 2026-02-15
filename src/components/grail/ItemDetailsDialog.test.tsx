import { fireEvent, render, screen } from '@testing-library/react';
import type { Settings } from 'electron/types/grail';
import { GameMode, GameVersion } from 'electron/types/grail';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterBuilder, GrailProgressBuilder, HolyGrailItemBuilder } from '@/fixtures';
import { ItemDetailsDialog } from './ItemDetailsDialog';

// Mock dependencies
vi.mock('@/stores/grailStore');
vi.mock('@/hooks/useProgressLookup');
vi.mock('@/hooks/useItemIcon', () => ({
  useItemIcon: () => ({ iconUrl: '/mock-icon.png', isLoading: false, error: null }),
}));
vi.mock('/images/placeholder-item.png', () => ({ default: '/mock-placeholder.png' }));
vi.mock('./RuneImages', () => ({
  RuneImages: ({ runeIds }: { runeIds: string[] }) => (
    <div data-testid="rune-images">{runeIds.join(',')}</div>
  ),
}));
vi.mock('../../../electron/items/runes', () => ({
  runes: [
    { id: 'r01', name: 'El' },
    { id: 'r02', name: 'Eld' },
    { id: 'r03', name: 'Tir' },
  ],
}));

// Import after mocks
import { useProgressLookup } from '@/hooks/useProgressLookup';
import { useGrailStore } from '@/stores/grailStore';

const defaultSettings: Settings = {
  saveDir: '',
  lang: 'en',
  gameMode: GameMode.Both,
  grailNormal: true,
  grailEthereal: false,
  grailRunes: false,
  grailRunewords: false,
  gameVersion: GameVersion.Resurrected,
  enableSounds: true,
  notificationVolume: 0.5,
  inAppNotifications: true,
  nativeNotifications: true,
  needsSeeding: true,
  theme: 'system',
  showItemIcons: false,
};

const mockToggleItemFound = vi.fn();

const mockVaultSearch = vi.fn();
const mockVaultAddItem = vi.fn();
const mockVaultRemoveItem = vi.fn();
const mockVaultListCategories = vi.fn();

function setupStoreMock(
  overrides: {
    items?: ReturnType<typeof HolyGrailItemBuilder.prototype.build>[];
    progress?: ReturnType<typeof GrailProgressBuilder.prototype.build>[];
    characters?: ReturnType<typeof CharacterBuilder.prototype.build>[];
    selectedCharacterId?: string | null;
    settings?: Partial<Settings>;
  } = {},
) {
  const storeState = {
    items: overrides.items ?? [],
    progress: overrides.progress ?? [],
    characters: overrides.characters ?? [],
    selectedCharacterId: overrides.selectedCharacterId ?? null,
    toggleItemFound: mockToggleItemFound,
    settings: { ...defaultSettings, ...overrides.settings },
  };

  const mockUseGrailStore = vi.mocked(useGrailStore);
  mockUseGrailStore.mockImplementation((selector?: unknown) => {
    if (typeof selector === 'function') {
      return (selector as (s: typeof storeState) => unknown)(storeState);
    }
    return storeState as ReturnType<typeof useGrailStore>;
  });
}

function setupProgressLookup(
  entries: Map<
    string,
    {
      normalFound: boolean;
      etherealFound: boolean;
      overallFound: boolean;
      normalProgress: unknown[];
      etherealProgress: unknown[];
    }
  > = new Map(),
) {
  vi.mocked(useProgressLookup).mockReturnValue(entries as ReturnType<typeof useProgressLookup>);
}

describe('When ItemDetailsDialog is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'electronAPI', {
      writable: true,
      value: {
        vault: {
          search: mockVaultSearch,
          addItem: mockVaultAddItem,
          removeItem: mockVaultRemoveItem,
          listCategories: mockVaultListCategories,
        },
      },
    });
    mockVaultSearch.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    mockVaultListCategories.mockResolvedValue([]);
    setupStoreMock();
    setupProgressLookup();
  });

  describe('If itemId is null', () => {
    it('Then returns null', () => {
      // Arrange & Act
      const { container } = render(
        <ItemDetailsDialog itemId={null} open={true} onOpenChange={vi.fn()} />,
      );

      // Assert
      expect(container.innerHTML).toBe('');
    });
  });

  describe('If itemId matches no item', () => {
    it('Then returns null', () => {
      // Arrange
      setupStoreMock({ items: [] });

      // Act
      const { container } = render(
        <ItemDetailsDialog itemId="nonexistent" open={true} onOpenChange={vi.fn()} />,
      );

      // Assert
      expect(container.innerHTML).toBe('');
    });
  });

  describe('If valid item found', () => {
    it('Then renders dialog with item name as title', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withName('Windforce').build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('Windforce')).toBeInTheDocument();
    });

    it('Then renders ItemInfoSection with type and category badges', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withType('unique')
        .withCategory('weapons')
        .build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('unique')).toBeInTheDocument();
      expect(screen.getByText('weapons')).toBeInTheDocument();
    });

    it('Then renders ethereal type badge', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('optional')).toBeInTheDocument();
    });
  });

  describe('If item has code', () => {
    it('Then shows code value', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      item.code = 'abc';
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('abc')).toBeInTheDocument();
    });
  });

  describe('If item has setName', () => {
    it('Then shows set name badge', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withType('set')
        .withSetName("Tal Rasha's Wrappings")
        .build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText("Tal Rasha's Wrappings")).toBeInTheDocument();
    });
  });

  describe('If item has link to diablo2.io', () => {
    it('Then shows correct link text', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      item.link = 'https://diablo2.io/item/windforce';
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('View on diablo2.io')).toBeInTheDocument();
    });
  });

  describe('If item has link to d2runewizard', () => {
    it('Then shows correct link text', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      item.link = 'https://d2runewizard.com/runewords/enigma';
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('View on d2runewizard')).toBeInTheDocument();
    });
  });

  describe('If item is runeword with runes', () => {
    it('Then renders RuneImages and rune names joined by +', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withType('runeword')
        .withRunewordSubCategory('runewords')
        .build();
      (item as { runes: string[] }).runes = ['r01', 'r02', 'r03'];
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByTestId('rune-images')).toBeInTheDocument();
      expect(screen.getByText('El + Eld + Tir')).toBeInTheDocument();
    });
  });

  describe('If showItemIcons enabled', () => {
    it('Then renders item icon image', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withType('unique').build();
      setupStoreMock({ items: [item], settings: { showItemIcons: true } });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });

  describe('If progress shows found', () => {
    it('Then shows Found badge', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      setupStoreMock({ items: [item], selectedCharacterId: 'char-1' });
      setupProgressLookup(
        new Map([
          [
            'item-1',
            {
              normalFound: true,
              etherealFound: false,
              overallFound: true,
              normalProgress: [],
              etherealProgress: [],
            },
          ],
        ]),
      );

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('Found')).toBeInTheDocument();
    });

    it('Then shows Mark as Not Found button', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      setupStoreMock({ items: [item], selectedCharacterId: 'char-1' });
      setupProgressLookup(
        new Map([
          [
            'item-1',
            {
              normalFound: true,
              etherealFound: false,
              overallFound: true,
              normalProgress: [],
              etherealProgress: [],
            },
          ],
        ]),
      );

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByRole('button', { name: 'Mark as Not Found' })).toBeInTheDocument();
    });
  });

  describe('If progress shows not found', () => {
    it('Then shows Not Found badge', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      setupStoreMock({ items: [item], selectedCharacterId: 'char-1' });
      setupProgressLookup(
        new Map([
          [
            'item-1',
            {
              normalFound: false,
              etherealFound: false,
              overallFound: false,
              normalProgress: [],
              etherealProgress: [],
            },
          ],
        ]),
      );

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('Not Found')).toBeInTheDocument();
    });

    it('Then shows Mark as Found button', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      setupStoreMock({ items: [item], selectedCharacterId: 'char-1' });
      setupProgressLookup(
        new Map([
          [
            'item-1',
            {
              normalFound: false,
              etherealFound: false,
              overallFound: false,
              normalProgress: [],
              etherealProgress: [],
            },
          ],
        ]),
      );

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByRole('button', { name: 'Mark as Found' })).toBeInTheDocument();
    });
  });

  describe('If selectedCharacterId is null', () => {
    it('Then no toggle button is shown', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      setupStoreMock({ items: [item], selectedCharacterId: null });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.queryByRole('button', { name: /Mark as/ })).not.toBeInTheDocument();
    });
  });

  describe('If "Mark as Found" clicked', () => {
    it('Then calls toggleItemFound', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      setupStoreMock({ items: [item], selectedCharacterId: 'char-1' });
      setupProgressLookup(
        new Map([
          [
            'item-1',
            {
              normalFound: false,
              etherealFound: false,
              overallFound: false,
              normalProgress: [],
              etherealProgress: [],
            },
          ],
        ]),
      );

      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Mark as Found' }));

      // Assert
      expect(mockToggleItemFound).toHaveBeenCalledWith('item-1', 'char-1', true);
    });
  });

  describe('If "Close" clicked', () => {
    it('Then calls onOpenChange(false)', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      setupStoreMock({ items: [item] });
      const onOpenChange = vi.fn();

      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={onOpenChange} />);

      // Act — get all Close buttons and click the one in the footer (not the dialog X)
      const closeButtons = screen.getAllByRole('button', { name: 'Close' });
      // The footer Close button is the one without data-slot="dialog-close"
      const footerClose = closeButtons.find(
        (btn) => btn.getAttribute('data-slot') !== 'dialog-close',
      );
      expect(footerClose).toBeTruthy();
      if (!footerClose) throw new Error('Expected footer close button');
      fireEvent.click(footerClose);

      // Assert
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('If characters exist', () => {
    it('Then renders CharacterProgressTable', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      const character = CharacterBuilder.new().withId('char-1').withName('TestSorc').build();
      setupStoreMock({ items: [item], characters: [character] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('Character Progress')).toBeInTheDocument();
      expect(screen.getByText('TestSorc')).toBeInTheDocument();
    });
  });

  describe('If no characters', () => {
    it('Then no character progress table is shown', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      setupStoreMock({ items: [item], characters: [] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.queryByText('Character Progress')).not.toBeInTheDocument();
    });
  });

  describe('If > 5 characters (pagination)', () => {
    it('Then pagination controls are visible', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      const characters = CharacterBuilder.new().withId('char').withName('Char').buildMany(7);
      const progress = characters.map((char, i) =>
        GrailProgressBuilder.new()
          .withId(`prog-${i}`)
          .withCharacterId(char.id)
          .withItemId('item-1')
          .withFoundDate(new Date(`2024-01-${String(i + 1).padStart(2, '0')}`))
          .asNormal()
          .build(),
      );
      setupStoreMock({ items: [item], characters, progress });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText(/1-5 of 7/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Previous/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Next/ })).toBeEnabled();
    });

    it('Then Next click advances page', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      const characters = CharacterBuilder.new().withId('char').withName('Char').buildMany(7);
      const progress = characters.map((char, i) =>
        GrailProgressBuilder.new()
          .withId(`prog-${i}`)
          .withCharacterId(char.id)
          .withItemId('item-1')
          .withFoundDate(new Date(`2024-01-${String(i + 1).padStart(2, '0')}`))
          .asNormal()
          .build(),
      );
      setupStoreMock({ items: [item], characters, progress });

      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: /Next/ }));

      // Assert
      expect(screen.getByText(/6-7 of 7/)).toBeInTheDocument();
    });
  });

  describe('If character has foundDate', () => {
    it('Then shows formatted date', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      const character = CharacterBuilder.new().withId('char-1').withName('TestSorc').build();
      const progress = GrailProgressBuilder.new()
        .withId('prog-1')
        .withCharacterId('char-1')
        .withItemId('item-1')
        .withFoundDate(new Date('2024-06-15'))
        .asNormal()
        .build();
      setupStoreMock({ items: [item], characters: [character], progress: [progress] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert — the date format comes from formatDate, we just check it's not "Never"
      expect(screen.queryByText('Never')).not.toBeInTheDocument();
    });
  });

  describe('If character has no foundDate', () => {
    it('Then shows Never', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      const character = CharacterBuilder.new().withId('char-1').withName('TestSorc').build();
      setupStoreMock({ items: [item], characters: [character], progress: [] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('Never')).toBeInTheDocument();
    });
  });

  describe('If etherealType "none"', () => {
    it('Then no Normal/Ethereal rows in ProgressStatusSection', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('none').build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert — "Overall Status" exists, but "Normal:" and "Ethereal:" labels do not
      expect(screen.getByText('Overall Status:')).toBeInTheDocument();
      expect(screen.queryByText('Normal:')).not.toBeInTheDocument();
      expect(screen.queryByText('Ethereal:')).not.toBeInTheDocument();
    });
  });

  describe('If etherealType "optional"', () => {
    it('Then both Normal and Ethereal rows are shown', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('Normal:')).toBeInTheDocument();
      expect(screen.getByText('Ethereal:')).toBeInTheDocument();
    });
  });

  describe('If manuallyAdded true', () => {
    it('Then shows Manual detection method', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      const character = CharacterBuilder.new().withId('char-1').withName('Sorc').build();
      const progress = GrailProgressBuilder.new()
        .withId('prog-1')
        .withCharacterId('char-1')
        .withItemId('item-1')
        .withFoundDate(new Date('2024-01-01'))
        .withManuallyAdded(true)
        .asNormal()
        .build();
      setupStoreMock({ items: [item], characters: [character], progress: [progress] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('Manual')).toBeInTheDocument();
    });
  });

  describe('If manuallyAdded false', () => {
    it('Then shows Auto detection method', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      const character = CharacterBuilder.new().withId('char-1').withName('Sorc').build();
      const progress = GrailProgressBuilder.new()
        .withId('prog-1')
        .withCharacterId('char-1')
        .withItemId('item-1')
        .withFoundDate(new Date('2024-01-01'))
        .withManuallyAdded(false)
        .asNormal()
        .build();
      setupStoreMock({ items: [item], characters: [character], progress: [progress] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('Auto')).toBeInTheDocument();
    });
  });

  describe('If vault metadata exists for the item', () => {
    it('Then it shows vaulted status badge and tags', async () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withName('Windforce').build();
      setupStoreMock({ items: [item] });
      mockVaultSearch.mockResolvedValue({
        items: [
          {
            id: 'vault-1',
            fingerprint: 'grail:item-1',
            itemName: 'Windforce',
            quality: 'unique',
            ethereal: false,
            rawItemJson: '{}',
            sourceFileType: 'd2s',
            locationContext: 'unknown',
            grailItemId: 'item-1',
            categoryIds: ['cat-1'],
            isPresentInLatestScan: false,
            created: new Date('2024-01-01T00:00:00.000Z'),
            lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      mockVaultListCategories.mockResolvedValue([
        {
          id: 'cat-1',
          name: 'Trade',
          created: new Date('2024-01-01T00:00:00.000Z'),
          lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
        },
      ]);

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(await screen.findByText('Vaulted')).toBeInTheDocument();
      expect(screen.getByText('Trade')).toBeInTheDocument();
    });
  });

  describe('If the item is not vaulted', () => {
    it('Then clicking Vault calls vault addItem API', async () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withName('Windforce').build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      const vaultButton = await screen.findByRole('button', { name: 'Vault' });
      fireEvent.click(vaultButton);

      // Assert
      expect(mockVaultAddItem).toHaveBeenCalledTimes(1);
      expect(mockVaultAddItem.mock.calls[0]?.[0]?.grailItemId).toBe('item-1');
    });
  });
});
