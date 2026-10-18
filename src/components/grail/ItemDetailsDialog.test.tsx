import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Settings } from 'electron/types/grail';
import { GameMode, GameVersion } from 'electron/types/grail';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterBuilder, GrailProgressBuilder, HolyGrailItemBuilder } from '@/fixtures';
import { toLocalIsoDate } from '@/lib/date';
import { ItemDetailsDialog } from './ItemDetailsDialog';

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));

// Mock dependencies
vi.mock('sonner', () => ({ toast: { error: toastErrorMock } }));
vi.mock('@/stores/grailStore');
// The farming section loads drop data over IPC; it has its own tests
vi.mock('@/components/farming/ItemFarmingSources', () => ({ ItemFarmingSources: () => null }));
vi.mock('@/hooks/useItemIcon', () => ({
  useItemIcon: () => ({ iconUrl: '/mock-icon.png', isLoading: false, error: null }),
}));
vi.mock('/images/placeholder-item.svg', () => ({ default: '/mock-placeholder.png' }));
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

const mockAddManualProgress = vi.fn();
const mockRemoveProgress = vi.fn();

const mockVaultSearch = vi.fn();
const mockVaultAddItem = vi.fn();
const mockVaultRemoveItem = vi.fn();
const mockInventorySearchAll = vi.fn();

function setupStoreMock(
  overrides: {
    items?: ReturnType<typeof HolyGrailItemBuilder.prototype.build>[];
    progress?: ReturnType<typeof GrailProgressBuilder.prototype.build>[];
    characters?: ReturnType<typeof CharacterBuilder.prototype.build>[];
    settings?: Partial<Settings>;
  } = {},
) {
  const storeState = {
    items: overrides.items ?? [],
    progress: overrides.progress ?? [],
    characters: overrides.characters ?? [],
    addManualProgress: mockAddManualProgress,
    removeProgress: mockRemoveProgress,
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

describe('When ItemDetailsDialog is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      writable: true,
      value: {
        vault: {
          search: mockVaultSearch,
          addItem: mockVaultAddItem,
          removeItem: mockVaultRemoveItem,
        },
        inventory: { searchAll: mockInventorySearchAll },
      },
    });
    mockVaultSearch.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    mockInventorySearchAll.mockResolvedValue({
      inventory: { snapshots: [], totalSnapshots: 0, totalItems: 0 },
      vault: { items: [], total: 0, page: 1, pageSize: 200 },
    });
    setupStoreMock();
  });

  describe('If the dialog is open', () => {
    it('Then it lists the copies of the item in the saves and vault', async () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withName('Windforce').build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      const copies = await screen.findByRole('region', { name: 'Your copies' });
      expect(
        await within(copies).findByText(
          'No copy of this item is in your characters, stashes or vault right now.',
        ),
      ).toBeInTheDocument();
    });
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

    it('Then renders the title in the display font, colored by item quality', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withType('set')
        .withName("Tal Rasha's Guardianship")
        .build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText("Tal Rasha's Guardianship")).toHaveClass(
        'font-display',
        'text-item-set',
      );
    });

    it('Then the item name is the accessible name of the dialog', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withName("Aldur's Deception")
        .build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByRole('dialog', { name: "Aldur's Deception" })).toBeInTheDocument();
    });

    it('Then the dialog is wide enough for item names to fit on one line', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withName("Aldur's Deception")
        .build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      const dialog = screen.getByRole('dialog', { name: "Aldur's Deception" });
      expect(dialog).toHaveClass('sm:max-w-2xl');
      expect(dialog).not.toHaveClass('sm:max-w-md');
    });

    it('Then the header, including the item name, is centred', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withName("Aldur's Deception")
        .build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      const header = screen.getByRole('heading', { name: "Aldur's Deception" }).parentElement;
      expect(header).toHaveClass('items-center', 'text-center');
    });

    it('Then the dialog is capped to the viewport and only the body scrolls', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withName('Windforce').build();
      const character = CharacterBuilder.new().withId('char-1').withName('TestSorc').build();
      const progress = GrailProgressBuilder.new()
        .withCharacterId('char-1')
        .withItemId('item-1')
        .withFoundDate(new Date('2024-01-01'))
        .asNormal()
        .build();
      setupStoreMock({ items: [item], characters: [character], progress: [progress] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      const dialog = screen.getByRole('dialog', { name: 'Windforce' });
      const heading = screen.getByRole('heading', { name: 'Windforce' });
      const footerButtons = screen.getAllByRole('button', { name: 'Close' });
      const body = screen
        .getByRole('region', { name: 'Character progress' })
        .closest('.overflow-y-auto');
      expect(dialog).toHaveClass('flex', 'flex-col', 'max-h-[calc(100vh-2rem)]');
      expect(body).toHaveClass('min-h-0', 'flex-1');
      expect(body).toContainElement(screen.getByText('TestSorc'));
      expect(body).not.toContainElement(heading);
      for (const button of footerButtons) {
        expect(body).not.toContainElement(button);
      }
    });

    it('Then the item facts are plain text lines, not badges or nested cards', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withType('set')
        .withSetName("Aldur's Watchtower")
        .withEtherealType('optional')
        .build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      const dialog = screen.getByRole('dialog');
      expect(screen.getByText('Type:').tagName).toBe('DT');
      expect(screen.getByText('Type:').nextElementSibling).toHaveTextContent('Set');
      expect(dialog.querySelector('.rounded-4xl')).toBeNull();
      expect(dialog.querySelector('[data-slot="card"]')).toBeNull();
    });

    it('Then renders translated type, category and treasure class lines', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withType('runeword')
        .withCategory('runewords')
        .build();
      item.treasureClass = 'exceptional';
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('Runeword')).toBeInTheDocument();
      expect(screen.getByText('Runewords')).toBeInTheDocument();
      expect(screen.getByText('Exceptional')).toBeInTheDocument();
      expect(screen.queryByText('runeword')).not.toBeInTheDocument();
      expect(screen.queryByText('exceptional')).not.toBeInTheDocument();
    });

    it.each([
      { etherealType: 'none', label: 'Cannot be ethereal', isEtherealColored: false },
      { etherealType: 'optional', label: 'Can be ethereal', isEtherealColored: true },
      { etherealType: 'only', label: 'Ethereal only', isEtherealColored: true },
    ] as const)('Then renders the $etherealType ethereal type as $label without destructive styling', ({
      etherealType,
      label,
      isEtherealColored,
    }) => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withEtherealType(etherealType)
        .build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      const value = screen.getByText(label);
      expect(screen.getByText('Ethereal type:').nextElementSibling).toBe(value);
      expect(value.classList.contains('text-ethereal')).toBe(isEtherealColored);
      expect(value).not.toHaveClass('text-destructive');
    });
  });

  describe('If the item has a base item', () => {
    it('Then the base item is shown beneath the name and describes the dialog', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withName('Harlequin Crest')
        .withItemBase('Shako')
        .build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByRole('dialog', { name: 'Harlequin Crest' })).toHaveAccessibleDescription(
        'Shako',
      );
    });
  });

  describe('If the item is a rune', () => {
    it('Then its base item is not repeated beneath the name', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withType('rune')
        .withName('El')
        .withItemBase('El Rune')
        .build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.queryByText('El Rune')).not.toBeInTheDocument();
    });
  });

  describe('If item has code', () => {
    it('Then does not show the internal code', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      item.code = 'abc';
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.queryByText('abc')).not.toBeInTheDocument();
      expect(screen.queryByText('Code:')).not.toBeInTheDocument();
    });
  });

  describe('If item has setName', () => {
    it('Then shows the set name as a labelled line in the set colour', () => {
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
      expect(screen.getByText('Set:').tagName).toBe('DT');
      expect(screen.getByText("Tal Rasha's Wrappings")).toHaveClass('text-item-set');
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

    it('Then the required runes line uses the rune colour', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withType('runeword')
        .withRunewordSubCategory('runewords')
        .build();
      (item as { runes: string[] }).runes = ['r01', 'r02'];
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('Required runes:').tagName).toBe('DT');
      expect(screen.getByText('El + Eld')).toHaveClass('text-item-rune');
    });
  });

  describe('If item is a runeword without runes', () => {
    it('Then no artwork is rendered, even when item icons are enabled', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withType('runeword')
        .withRunewordSubCategory('runewords')
        .build();
      (item as { runes: string[] }).runes = [];
      setupStoreMock({ items: [item], settings: { showItemIcons: true } });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.queryByTestId('rune-images')).not.toBeInTheDocument();
      expect(screen.getByRole('dialog').querySelector('img')).toBeNull();
    });
  });

  describe('If showItemIcons enabled', () => {
    it('Then renders the item icon as decorative artwork', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withType('unique').build();
      setupStoreMock({ items: [item], settings: { showItemIcons: true } });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      const icon = screen.getByRole('dialog').querySelector('img');
      expect(icon).toHaveAttribute('src', '/mock-icon.png');
      expect(icon).toHaveAttribute('alt', '');
    });
  });

  describe('If showItemIcons disabled', () => {
    it('Then no item icon is rendered', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withType('unique').build();
      setupStoreMock({ items: [item], settings: { showItemIcons: false } });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByRole('dialog').querySelector('img')).toBeNull();
    });
  });

  describe('If the item was found', () => {
    it('Then shows a Found status line instead of a badge', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('none').build();
      const characters = [CharacterBuilder.new().withId('char-1').build()];
      const progress = GrailProgressBuilder.new()
        .withCharacterId('char-1')
        .withItemId('item-1')
        .withFoundDate(new Date('2024-01-01'))
        .asNormal()
        .build();
      setupStoreMock({ items: [item], characters, progress: [progress] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      const status = screen.getByText('Found');
      expect(status).toHaveClass('text-found');
      expect(status).not.toHaveClass('rounded-4xl');
    });
  });

  describe('If the item was not found', () => {
    it('Then shows a Not Found status line', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('none').build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('Not found')).toHaveClass('text-missing');
    });
  });

  describe('If ethereal tracking is on and an item with optional ethereal type has per-version progress', () => {
    const found = { text: 'Found', present: 'text-found', absent: 'text-missing' };
    const missing = { text: 'Not found', present: 'text-missing', absent: 'text-found' };

    it.each([
      { normalFound: true, etherealFound: false, normal: found, ethereal: missing },
      { normalFound: false, etherealFound: true, normal: missing, ethereal: found },
      { normalFound: true, etherealFound: true, normal: found, ethereal: found },
      { normalFound: false, etherealFound: false, normal: missing, ethereal: missing },
    ])('Then Normal found=$normalFound and Ethereal found=$etherealFound show the matching status', ({
      normalFound,
      etherealFound,
      normal,
      ethereal,
    }) => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      const characters = [CharacterBuilder.new().withId('char-1').build()];
      const progress = [
        ...(normalFound
          ? [
              GrailProgressBuilder.new()
                .withId('normal')
                .withCharacterId('char-1')
                .withItemId('item-1')
                .withFoundDate(new Date('2024-01-01'))
                .asNormal()
                .build(),
            ]
          : []),
        ...(etherealFound
          ? [
              GrailProgressBuilder.new()
                .withId('ethereal')
                .withCharacterId('char-1')
                .withItemId('item-1')
                .withFoundDate(new Date('2024-01-02'))
                .asEthereal()
                .build(),
            ]
          : []),
      ];
      setupStoreMock({
        items: [item],
        characters,
        progress,
        settings: { grailEthereal: true },
      });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      const normalStatus = screen.getByText('Normal:').nextElementSibling;
      const etherealStatus = screen.getByText('Ethereal:').nextElementSibling;
      expect(normalStatus).toHaveTextContent(normal.text);
      expect(normalStatus).toHaveClass(normal.present);
      expect(normalStatus).not.toHaveClass(normal.absent);
      expect(etherealStatus).toHaveTextContent(ethereal.text);
      expect(etherealStatus).toHaveClass(ethereal.present);
      expect(etherealStatus).not.toHaveClass(ethereal.absent);
    });
  });

  describe('If ethereal tracking is off and only the ethereal version was found', () => {
    it('Then the normal version reads Not Found and the ethereal find is labelled as not tracked', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      const characters = [CharacterBuilder.new().withId('char-1').build()];
      const progress = GrailProgressBuilder.new()
        .withCharacterId('char-1')
        .withItemId('item-1')
        .withFoundDate(new Date('2026-01-31'))
        .asEthereal()
        .build();
      setupStoreMock({
        items: [item],
        characters,
        progress: [progress],
        settings: { grailEthereal: false },
      });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      const normalStatus = screen.getByText('Normal:').nextElementSibling;
      const etherealStatus = screen.getByText('Ethereal:').nextElementSibling;
      expect(normalStatus).toHaveTextContent('Not found');
      expect(etherealStatus).toHaveTextContent('Found (not tracked)');
      expect(etherealStatus).not.toHaveClass('text-found');
      expect(etherealStatus).not.toHaveClass('text-missing');
    });
  });

  describe('If ethereal tracking is off and no ethereal version was found', () => {
    it('Then a single status line is shown for the tracked normal version', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      setupStoreMock({ items: [item], settings: { grailEthereal: false } });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('Not found')).toHaveClass('text-missing');
      expect(screen.queryByText('Normal:')).not.toBeInTheDocument();
      expect(screen.queryByText('Ethereal:')).not.toBeInTheDocument();
    });
  });

  describe('If an item with optional ethereal type is shown while ethereal tracking is on', () => {
    it('Then the Normal and Ethereal statuses sit side by side in one row', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      setupStoreMock({ items: [item], settings: { grailEthereal: true } });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      const statuses = screen.getByText('Normal:').closest('dl');
      expect(statuses).toContainElement(screen.getByText('Ethereal:'));
      expect(statuses).toHaveClass('flex', 'flex-wrap', 'justify-center');
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

  describe('If characters exist and one found the item', () => {
    it('Then renders CharacterProgressTable', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      const character = CharacterBuilder.new().withId('char-1').withName('TestSorc').build();
      const progress = GrailProgressBuilder.new()
        .withCharacterId('char-1')
        .withItemId('item-1')
        .withFoundDate(new Date('2024-01-01'))
        .asNormal()
        .build();
      setupStoreMock({ items: [item], characters: [character], progress: [progress] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      const section = screen.getByRole('region', { name: 'Character progress' });
      const heading = within(section).getByRole('heading', { name: 'Character progress' });
      expect(heading).toBeVisible();
      expect(heading).toHaveClass('font-display');
      expect(within(section).getByText('TestSorc')).toBeInTheDocument();
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
      expect(screen.queryByText('Character progress')).not.toBeInTheDocument();
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

  describe('If several characters exist but only some found the item', () => {
    it('Then only the finders are listed, most recent find first', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('none').build();
      const characters = [
        CharacterBuilder.new().withId('char-1').withName('Amazon').build(),
        CharacterBuilder.new().withId('char-2').withName('Barb').build(),
        CharacterBuilder.new().withId('char-3').withName('Necro').build(),
      ];
      const progress = [
        GrailProgressBuilder.new()
          .withId('prog-1')
          .withCharacterId('char-1')
          .withItemId('item-1')
          .withFoundDate(new Date('2024-01-01'))
          .asNormal()
          .build(),
        GrailProgressBuilder.new()
          .withId('prog-3')
          .withCharacterId('char-3')
          .withItemId('item-1')
          .withFoundDate(new Date('2024-03-01'))
          .asNormal()
          .build(),
      ];
      setupStoreMock({ items: [item], characters, progress });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      const section = screen.getByRole('region', { name: 'Character progress' });
      const rows = within(section).getAllByRole('row').slice(1);
      expect(rows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual([
        'Necro',
        'Amazon',
      ]);
      expect(within(section).queryByText('Barb')).not.toBeInTheDocument();
      expect(within(section).queryByRole('columnheader', { name: 'Version' })).toBeNull();
    });
  });

  describe('If the item can be normal or ethereal and was found as both', () => {
    it('Then each find shows its version', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      const character = CharacterBuilder.new().withId('char-1').withName('Sorc').build();
      const progress = [
        GrailProgressBuilder.new()
          .withId('prog-normal')
          .withCharacterId('char-1')
          .withItemId('item-1')
          .withFoundDate(new Date('2024-01-01'))
          .asNormal()
          .build(),
        GrailProgressBuilder.new()
          .withId('prog-ethereal')
          .withCharacterId('char-1')
          .withItemId('item-1')
          .withFoundDate(new Date('2024-02-01'))
          .asEthereal()
          .build(),
      ];
      setupStoreMock({ items: [item], characters: [character], progress });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      const section = screen.getByRole('region', { name: 'Character progress' });
      expect(within(section).getByRole('columnheader', { name: 'Version' })).toBeInTheDocument();
      const rows = within(section).getAllByRole('row').slice(1);
      expect(rows.map((row) => within(row).getAllByRole('cell')[1].textContent)).toEqual([
        'Ethereal',
        'Normal',
      ]);
    });
  });

  describe('If a find belongs to a character that no longer exists', () => {
    it('Then neither the status line nor the table counts it', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('none').build();
      const character = CharacterBuilder.new().withId('char-1').withName('TestSorc').build();
      const strayFind = GrailProgressBuilder.new()
        .withCharacterId('deleted-char')
        .withItemId('item-1')
        .withFoundDate(new Date('2024-01-01'))
        .asNormal()
        .build();
      setupStoreMock({ items: [item], characters: [character], progress: [strayFind] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('Not found')).toBeVisible();
      const section = screen.getByRole('region', { name: 'Character progress' });
      expect(within(section).getByText('No character has found this item yet.')).toBeVisible();
      expect(within(section).queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('If a find is of a version the item cannot have', () => {
    it('Then neither the status line nor the table counts it', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('none').build();
      const character = CharacterBuilder.new().withId('char-1').withName('TestSorc').build();
      const strayFind = GrailProgressBuilder.new()
        .withCharacterId('char-1')
        .withItemId('item-1')
        .withFoundDate(new Date('2024-01-01'))
        .asEthereal()
        .build();
      setupStoreMock({
        items: [item],
        characters: [character],
        progress: [strayFind],
        settings: { grailEthereal: true },
      });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('Not found')).toBeVisible();
      const section = screen.getByRole('region', { name: 'Character progress' });
      expect(within(section).getByText('No character has found this item yet.')).toBeVisible();
      expect(within(section).queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('If no character found the item', () => {
    it('Then one short line is shown instead of an empty table', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      const character = CharacterBuilder.new().withId('char-1').withName('TestSorc').build();
      setupStoreMock({ items: [item], characters: [character], progress: [] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      const section = screen.getByRole('region', { name: 'Character progress' });
      expect(within(section).getByText('No character has found this item yet.')).toBeVisible();
      expect(within(section).queryByRole('table')).not.toBeInTheDocument();
      expect(within(section).queryByText('TestSorc')).not.toBeInTheDocument();
    });
  });

  describe('If etherealType "none"', () => {
    it('Then a single status line is shown without Normal/Ethereal labels', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('none').build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText('Not found')).toHaveClass('text-missing');
      expect(screen.queryByText('Normal:')).not.toBeInTheDocument();
      expect(screen.queryByText('Ethereal:')).not.toBeInTheDocument();
    });
  });

  describe('If etherealType "optional" and ethereal tracking is on', () => {
    it('Then both the Normal and Ethereal statuses are shown', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      setupStoreMock({ items: [item], settings: { grailEthereal: true } });

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

  describe('If a bookmark exists for the item', () => {
    it('Then the bookmark button offers to remove the bookmark', async () => {
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
            isPresentInLatestScan: false,
            created: new Date('2024-01-01T00:00:00.000Z'),
            lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(await screen.findByRole('button', { name: 'Remove bookmark' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: 'Bookmark' })).not.toBeInTheDocument();
    });
  });

  describe('If the dialog shows the bookmark state', () => {
    it('Then no separate bookmark status row repeats it', async () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withName('Windforce').build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      await screen.findByRole('button', { name: 'Bookmark' });

      // Assert
      expect(screen.queryByText(/Bookmark Status/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Not Bookmarked/i)).not.toBeInTheDocument();
    });
  });

  describe('If the item is not bookmarked', () => {
    it('Then clicking Bookmark calls vault addItem API', async () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withName('Windforce').build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      const bookmarkButton = await screen.findByRole('button', { name: 'Bookmark' });
      fireEvent.click(bookmarkButton);

      // Assert
      expect(mockVaultAddItem).toHaveBeenCalledTimes(1);
      expect(mockVaultAddItem.mock.calls[0]?.[0]?.grailItemId).toBe('item-1');
    });
  });

  describe('If the item is bookmarked', () => {
    it('Then clicking Remove bookmark calls vault removeItem API for the bookmark row', async () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withName('Windforce').build();
      setupStoreMock({ items: [item] });
      mockVaultSearch.mockResolvedValue({
        items: [
          {
            id: 'bookmark-1',
            fingerprint: 'grail:item-1',
            itemName: 'Windforce',
            quality: 'unique',
            ethereal: false,
            rawItemJson: '{}',
            sourceFileType: 'd2s',
            locationContext: 'unknown',
            grailItemId: 'item-1',
            isPresentInLatestScan: false,
            created: new Date('2024-01-01T00:00:00.000Z'),
            lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      mockVaultRemoveItem.mockResolvedValue(undefined);
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      const removeButton = await screen.findByRole('button', { name: 'Remove bookmark' });

      // Act
      fireEvent.click(removeButton);

      // Assert
      await waitFor(() => expect(mockVaultRemoveItem).toHaveBeenCalledWith('bookmark-1'));
      expect(mockVaultAddItem).not.toHaveBeenCalled();
    });
  });

  describe('If a real vaulted item shares the grail item id', () => {
    it('Then the dialog never links or deletes that vault row', async () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withName('Windforce').build();
      setupStoreMock({ items: [item] });
      mockVaultSearch.mockResolvedValue({
        items: [
          {
            id: 'real-vault-row',
            fingerprint: 'd2s|Sorc|stash|unique|Windforce|0,0',
            itemName: 'Windforce',
            quality: 'unique',
            ethereal: false,
            rawItemJson: '{"id":42}',
            sourceFileType: 'd2s',
            sourceFilePath: '/saves/Sorc.d2s',
            locationContext: 'stash',
            grailItemId: 'item-1',
            isPresentInLatestScan: true,
            vaultedAt: new Date('2024-01-01T00:00:00.000Z'),
            created: new Date('2024-01-01T00:00:00.000Z'),
            lastUpdated: new Date('2024-01-01T00:00:00.000Z'),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      const bookmarkButton = await screen.findByRole('button', { name: 'Bookmark' });
      fireEvent.click(bookmarkButton);

      // Assert
      expect(screen.queryByRole('button', { name: 'Remove bookmark' })).not.toBeInTheDocument();
      expect(mockVaultRemoveItem).not.toHaveBeenCalled();
      expect(mockVaultAddItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('If loading the bookmark metadata rejects', () => {
    it('Then the rejection is handled, logged and surfaced as an error toast', async () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withName('Windforce').build();
      setupStoreMock({ items: [item] });
      const failure = new Error('ipc failed');
      mockVaultSearch.mockRejectedValue(failure);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const unhandledRejections: unknown[] = [];
      const onUnhandledRejection = (reason: unknown) => {
        unhandledRejections.push(reason);
      };
      process.on('unhandledRejection', onUnhandledRejection);

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      await waitFor(() =>
        expect(toastErrorMock).toHaveBeenCalledWith('Failed to load bookmark status.'),
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      process.off('unhandledRejection', onUnhandledRejection);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load bookmark metadata', failure);
      expect(unhandledRejections).toEqual([]);
      consoleErrorSpy.mockRestore();
    });
  });

  describe('If the bookmark action fails', () => {
    it('Then the error is logged and surfaced as an error toast', async () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withName('Windforce').build();
      setupStoreMock({ items: [item] });
      const failure = new Error('write failed');
      mockVaultAddItem.mockRejectedValue(failure);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      const bookmarkButton = await screen.findByRole('button', { name: 'Bookmark' });

      // Act
      fireEvent.click(bookmarkButton);

      // Assert
      await waitFor(() =>
        expect(toastErrorMock).toHaveBeenCalledWith(
          'Failed to update the bookmark. Nothing was changed.',
        ),
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to update bookmark', failure);
      expect(screen.queryByRole('button', { name: 'Remove bookmark' })).not.toBeInTheDocument();
      consoleErrorSpy.mockRestore();
    });
  });
  describe('If the bookmark write succeeds but refreshing the bookmark metadata fails', () => {
    it('Then the item stays bookmarked and only the load error is shown', async () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withName('Windforce').build();
      setupStoreMock({ items: [item] });
      const bookmark = {
        id: 'vault-1',
        fingerprint: 'grail:item-1',
        itemName: 'Windforce',
      };
      mockVaultAddItem.mockResolvedValue(bookmark);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      const bookmarkButton = await screen.findByRole('button', { name: 'Bookmark' });
      mockVaultSearch.mockRejectedValue(new Error('refresh failed'));

      // Act
      fireEvent.click(bookmarkButton);

      // Assert
      await waitFor(() =>
        expect(toastErrorMock).toHaveBeenCalledWith('Failed to load bookmark status.'),
      );
      expect(toastErrorMock).not.toHaveBeenCalledWith(
        'Failed to update the bookmark. Nothing was changed.',
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to refresh bookmark metadata',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('If a bookmarked item is closed and another item is opened', () => {
    it('Then the second item does not inherit the first bookmark when the lookup fails', async () => {
      // Arrange
      const itemA = HolyGrailItemBuilder.new().withId('item-a').withName('Windforce').build();
      const itemB = HolyGrailItemBuilder.new().withId('item-b').withName('Arachnid Mesh').build();
      setupStoreMock({ items: [itemA, itemB] });
      mockVaultSearch.mockResolvedValueOnce({
        items: [{ id: 'bm-a', fingerprint: 'grail:item-a', itemName: 'Windforce' }],
        total: 1,
        page: 1,
        pageSize: 100,
      });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { rerender } = render(
        <ItemDetailsDialog itemId="item-a" open={true} onOpenChange={vi.fn()} />,
      );
      await screen.findByRole('button', { name: 'Remove bookmark' });

      // Act
      rerender(<ItemDetailsDialog itemId="item-a" open={false} onOpenChange={vi.fn()} />);
      mockVaultSearch.mockRejectedValue(new Error('ipc failed'));
      rerender(<ItemDetailsDialog itemId="item-b" open={true} onOpenChange={vi.fn()} />);
      await waitFor(() =>
        expect(toastErrorMock).toHaveBeenCalledWith('Failed to load bookmark status.'),
      );

      // Assert
      expect(screen.queryByRole('button', { name: 'Remove bookmark' })).not.toBeInTheDocument();
      expect(mockVaultRemoveItem).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('Then the second item is not shown as bookmarked while its lookup is pending', async () => {
      // Arrange
      const itemA = HolyGrailItemBuilder.new().withId('item-a').withName('Windforce').build();
      const itemB = HolyGrailItemBuilder.new().withId('item-b').withName('Arachnid Mesh').build();
      setupStoreMock({ items: [itemA, itemB] });
      mockVaultSearch.mockResolvedValueOnce({
        items: [{ id: 'bm-a', fingerprint: 'grail:item-a', itemName: 'Windforce' }],
        total: 1,
        page: 1,
        pageSize: 100,
      });
      const { rerender } = render(
        <ItemDetailsDialog itemId="item-a" open={true} onOpenChange={vi.fn()} />,
      );
      await screen.findByRole('button', { name: 'Remove bookmark' });
      mockVaultSearch.mockReturnValue(new Promise(() => undefined));

      // Act
      rerender(<ItemDetailsDialog itemId="item-b" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.queryByRole('button', { name: 'Remove bookmark' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Bookmark' })).toBeInTheDocument();
    });
  });

  describe('If a bookmark lookup for one item resolves after another item was opened', () => {
    it('Then the late response is not applied to the other item', async () => {
      // Arrange
      const itemA = HolyGrailItemBuilder.new().withId('item-a').withName('Windforce').build();
      const itemB = HolyGrailItemBuilder.new().withId('item-b').withName('Arachnid Mesh').build();
      setupStoreMock({ items: [itemA, itemB] });
      let resolveLookupForA: (value: unknown) => void = () => undefined;
      mockVaultSearch.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveLookupForA = resolve;
        }),
      );
      const { rerender } = render(
        <ItemDetailsDialog itemId="item-a" open={true} onOpenChange={vi.fn()} />,
      );
      mockVaultSearch.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 100 });
      rerender(<ItemDetailsDialog itemId="item-b" open={true} onOpenChange={vi.fn()} />);
      await screen.findByRole('button', { name: 'Bookmark' });

      // Act
      resolveLookupForA({
        items: [{ id: 'bm-a', fingerprint: 'grail:item-a', itemName: 'Windforce' }],
        total: 1,
        page: 1,
        pageSize: 100,
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Assert
      expect(screen.queryByRole('button', { name: 'Remove bookmark' })).not.toBeInTheDocument();
    });
  });

  describe('If the bookmark is not on the first page of name matches', () => {
    it('Then the lookup keeps paging until it finds the bookmark by fingerprint', async () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withName('El').build();
      setupStoreMock({ items: [item] });
      const otherRows = Array.from({ length: 100 }, (_, index) => ({
        id: `real-${index}`,
        fingerprint: `d2s|real|${index}`,
        itemName: 'El Rune',
      }));
      mockVaultSearch
        .mockResolvedValueOnce({ items: otherRows, total: 101, page: 1, pageSize: 100 })
        .mockResolvedValueOnce({
          items: [{ id: 'bm-1', fingerprint: 'grail:item-1', itemName: 'El' }],
          total: 101,
          page: 2,
          pageSize: 100,
        });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(await screen.findByRole('button', { name: 'Remove bookmark' })).toBeInTheDocument();
      expect(mockVaultSearch.mock.calls.map(([filter]) => filter.page)).toEqual([1, 2]);
    });
  });

  describe('If an item is bookmarked', () => {
    it.each([
      ['unique', 'unique'],
      ['set', 'set'],
      ['rune', 'normal'],
      ['runeword', 'normal'],
    ] as const)('Then a %s item is stored with quality %s', async (type, expectedQuality) => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withType(type).build();
      setupStoreMock({ items: [item] });
      mockVaultAddItem.mockResolvedValue({ id: 'bm-1', fingerprint: 'grail:item-1' });
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Act
      fireEvent.click(await screen.findByRole('button', { name: 'Bookmark' }));

      // Assert
      await waitFor(() => expect(mockVaultAddItem).toHaveBeenCalledTimes(1));
      expect(mockVaultAddItem.mock.calls[0]?.[0]).toMatchObject({
        type,
        quality: expectedQuality,
      });
    });
  });

  describe('If the item is shown without any found records', () => {
    it('Then the Mark as found action is always available', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByRole('button', { name: 'Mark as found' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: /Not found/ })).not.toBeInTheDocument();
    });

    it('Then Mark as found is the primary action', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('none').build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByRole('button', { name: 'Mark as found' })).toHaveClass('bg-primary');
      expect(screen.queryByRole('button', { name: 'Add another find' })).not.toBeInTheDocument();
    });
  });

  describe('If the item was found in every tracked version', () => {
    it('Then the action is a secondary Add another find button', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      const characters = [CharacterBuilder.new().withId('char-1').build()];
      const progress = [
        GrailProgressBuilder.new()
          .withId('normal')
          .withCharacterId('char-1')
          .withItemId('item-1')
          .withFoundDate(new Date('2024-01-01'))
          .asNormal()
          .build(),
        GrailProgressBuilder.new()
          .withId('ethereal')
          .withCharacterId('char-1')
          .withItemId('item-1')
          .withFoundDate(new Date('2024-01-02'))
          .asEthereal()
          .build(),
      ];
      setupStoreMock({ items: [item], characters, progress, settings: { grailEthereal: true } });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      const action = screen.getByRole('button', { name: 'Add another find' });
      expect(action).not.toHaveClass('bg-primary');
      expect(action).toHaveClass('bg-background');
      expect(screen.queryByRole('button', { name: 'Mark as found' })).not.toBeInTheDocument();
    });
  });

  describe('If the item was found in one tracked version but is missing in another', () => {
    it('Then Mark as found stays the primary action', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      const characters = [CharacterBuilder.new().withId('char-1').build()];
      const progress = GrailProgressBuilder.new()
        .withCharacterId('char-1')
        .withItemId('item-1')
        .withFoundDate(new Date('2024-01-01'))
        .asNormal()
        .build();
      setupStoreMock({
        items: [item],
        characters,
        progress: [progress],
        settings: { grailEthereal: true },
      });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByRole('button', { name: 'Mark as found' })).toHaveClass('bg-primary');
      expect(screen.queryByRole('button', { name: 'Add another find' })).not.toBeInTheDocument();
    });
  });

  describe('If only a version that is not tracked was found', () => {
    it('Then Mark as found stays the primary action', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      const characters = [CharacterBuilder.new().withId('char-1').build()];
      const progress = GrailProgressBuilder.new()
        .withCharacterId('char-1')
        .withItemId('item-1')
        .withFoundDate(new Date('2024-01-01'))
        .asEthereal()
        .build();
      setupStoreMock({
        items: [item],
        characters,
        progress: [progress],
        settings: { grailEthereal: false },
      });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByRole('button', { name: 'Mark as found' })).toHaveClass('bg-primary');
    });
  });
});

function openMarkAsFoundPrompt(name = 'Mark as found') {
  fireEvent.click(screen.getByRole('button', { name }));
  return screen.getByRole('dialog', { name });
}

describe('When the user marks an item as found', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddManualProgress.mockResolvedValue(undefined);
  });

  describe('If characters exist', () => {
    it('Then the prompt asks for a character and a found date defaulting to today', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('none').build();
      const character = CharacterBuilder.new().withId('char-1').withName('Sorc').build();
      setupStoreMock({ items: [item], characters: [character] });
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Act
      const prompt = openMarkAsFoundPrompt();

      // Assert
      expect(within(prompt).getByRole('combobox', { name: 'Character' })).toHaveTextContent('Sorc');
      expect(within(prompt).getByLabelText('Found date')).toHaveValue(toLocalIsoDate());
      expect(within(prompt).queryByRole('combobox', { name: 'Version' })).not.toBeInTheDocument();
    });

    it('Then submitting saves a manual record for the chosen character and date', async () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('none').build();
      const character = CharacterBuilder.new().withId('char-1').withName('Sorc').build();
      setupStoreMock({ items: [item], characters: [character] });
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      const prompt = openMarkAsFoundPrompt();
      fireEvent.change(within(prompt).getByLabelText('Found date'), {
        target: { value: '2024-06-15' },
      });

      // Act
      fireEvent.click(within(prompt).getByRole('button', { name: 'Mark as found' }));

      // Assert
      await waitFor(() => expect(mockAddManualProgress).toHaveBeenCalledTimes(1));
      const input = mockAddManualProgress.mock.calls[0][0];
      expect(input).toMatchObject({ itemId: 'item-1', characterId: 'char-1', isEthereal: false });
      expect(toLocalIsoDate(input.foundDate)).toBe('2024-06-15');
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Mark as found' })).not.toBeInTheDocument(),
      );
    });

    it('Then a future found date cannot be submitted', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('none').build();
      const character = CharacterBuilder.new().withId('char-1').withName('Sorc').build();
      setupStoreMock({ items: [item], characters: [character] });
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      const prompt = openMarkAsFoundPrompt();
      const now = new Date();
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

      // Act
      fireEvent.change(within(prompt).getByLabelText('Found date'), {
        target: { value: toLocalIsoDate(tomorrow) },
      });

      // Assert
      expect(within(prompt).getByRole('button', { name: 'Mark as found' })).toBeDisabled();
      expect(
        within(prompt).getByText('Choose a date that is not in the future.'),
      ).toBeInTheDocument();
    });

    it('Then saving errors are shown and the prompt stays open', async () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('none').build();
      const character = CharacterBuilder.new().withId('char-1').withName('Sorc').build();
      setupStoreMock({ items: [item], characters: [character] });
      mockAddManualProgress.mockRejectedValue(new Error('DB error'));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      const prompt = openMarkAsFoundPrompt();

      // Act
      fireEvent.click(within(prompt).getByRole('button', { name: 'Mark as found' }));

      // Assert
      expect(await within(prompt).findByRole('alert')).toHaveTextContent(
        'Could not save this find. Please try again.',
      );
      expect(screen.getByRole('dialog', { name: 'Mark as found' })).toBeInTheDocument();
    });
  });

  describe('If the character already has the version recorded', () => {
    it('Then the prompt explains it and cannot be submitted', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('none').build();
      const character = CharacterBuilder.new().withId('char-1').withName('Sorc').build();
      const progress = GrailProgressBuilder.new()
        .withId('prog-1')
        .withCharacterId('char-1')
        .withItemId('item-1')
        .withFoundDate(new Date('2024-01-01'))
        .asNormal()
        .build();
      setupStoreMock({ items: [item], characters: [character], progress: [progress] });
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Act
      const prompt = openMarkAsFoundPrompt('Add another find');

      // Assert
      expect(
        within(prompt).getByText('Sorc already has this version recorded.'),
      ).toBeInTheDocument();
      expect(within(prompt).getByRole('button', { name: 'Add another find' })).toBeDisabled();
    });

    it('Then the message is associated with the controls it explains', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('none').build();
      const character = CharacterBuilder.new().withId('char-1').withName('Sorc').build();
      const progress = GrailProgressBuilder.new()
        .withId('prog-1')
        .withCharacterId('char-1')
        .withItemId('item-1')
        .withFoundDate(new Date('2024-01-01'))
        .asNormal()
        .build();
      setupStoreMock({ items: [item], characters: [character], progress: [progress] });
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Act
      const prompt = openMarkAsFoundPrompt('Add another find');

      // Assert
      const message = 'Sorc already has this version recorded.';
      expect(
        within(prompt).getByRole('combobox', { name: 'Character' }),
      ).toHaveAccessibleDescription(message);
      expect(
        within(prompt).getByRole('button', { name: 'Add another find' }),
      ).toHaveAccessibleDescription(message);
    });
  });

  describe('If no characters exist', () => {
    it('Then the prompt explains why and cannot be submitted', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      setupStoreMock({ items: [item], characters: [] });
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Act
      const prompt = openMarkAsFoundPrompt();

      // Assert
      expect(within(prompt).getByText(/No characters available yet/)).toBeInTheDocument();
      expect(within(prompt).queryByRole('combobox')).not.toBeInTheDocument();
      expect(within(prompt).getByRole('button', { name: 'Mark as found' })).toBeDisabled();
    });

    it('Then the message is associated with the disabled submit button', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      setupStoreMock({ items: [item], characters: [] });
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Act
      const prompt = openMarkAsFoundPrompt();

      // Assert
      expect(
        within(prompt).getByRole('button', { name: 'Mark as found' }),
      ).toHaveAccessibleDescription(/No characters available yet/);
    });
  });

  describe('If the item was already found', () => {
    it('Then the prompt is named Add another find and saves another character find', async () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withName('Shako')
        .withEtherealType('none')
        .build();
      const characters = [
        CharacterBuilder.new().withId('char-1').withName('Sorc').build(),
        CharacterBuilder.new().withId('char-2').withName('Pally').build(),
      ];
      const progress = GrailProgressBuilder.new()
        .withId('prog-1')
        .withCharacterId('char-1')
        .withItemId('item-1')
        .withFoundDate(new Date('2024-01-01'))
        .asNormal()
        .build();
      setupStoreMock({ items: [item], characters, progress: [progress] });
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Add another find' }));
      const prompt = screen.getByRole('dialog', { name: 'Add another find' });
      expect(prompt).toHaveAccessibleDescription('Record another find of Shako.');
      const characterSelect = within(prompt).getByRole('combobox', { name: 'Character' });
      fireEvent.click(characterSelect);
      const pallyOption = await screen.findByRole('option', { name: 'Pally' });
      fireEvent.mouseMove(pallyOption);
      fireEvent.click(pallyOption);
      await waitFor(() => expect(characterSelect).toHaveTextContent('Pally'));

      // Act
      fireEvent.click(within(prompt).getByRole('button', { name: 'Add another find' }));

      // Assert
      await waitFor(() =>
        expect(mockAddManualProgress).toHaveBeenCalledWith(
          expect.objectContaining({ itemId: 'item-1', characterId: 'char-2', isEthereal: false }),
        ),
      );
    });
  });

  describe('If the details dialog is closed and reopened or switched to another item', () => {
    it('Then the Mark as found prompt does not carry over', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('none').build();
      const other = HolyGrailItemBuilder.new().withId('item-2').withEtherealType('none').build();
      const character = CharacterBuilder.new().withId('char-1').withName('Sorc').build();
      setupStoreMock({ items: [item, other], characters: [character] });
      const { rerender } = render(
        <ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />,
      );
      openMarkAsFoundPrompt();

      // Act
      rerender(<ItemDetailsDialog itemId="item-2" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.queryByRole('dialog', { name: 'Mark as found' })).not.toBeInTheDocument();

      // Act
      openMarkAsFoundPrompt();
      rerender(<ItemDetailsDialog itemId="item-2" open={false} onOpenChange={vi.fn()} />);
      rerender(<ItemDetailsDialog itemId="item-2" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.queryByRole('dialog', { name: 'Mark as found' })).not.toBeInTheDocument();
    });
  });

  describe('If ethereal tracking is enabled and the item can be both versions', () => {
    it('Then the prompt asks for the version and saves the chosen one', async () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      const character = CharacterBuilder.new().withId('char-1').withName('Sorc').build();
      setupStoreMock({ items: [item], characters: [character], settings: { grailEthereal: true } });
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      const prompt = openMarkAsFoundPrompt();
      const versionSelect = within(prompt).getByRole('combobox', { name: 'Version' });
      expect(versionSelect).toHaveTextContent('Normal');

      // Act
      fireEvent.click(versionSelect);
      const etherealOption = await screen.findByRole('option', { name: 'Ethereal' });
      fireEvent.mouseMove(etherealOption);
      fireEvent.click(etherealOption);
      await waitFor(() => expect(versionSelect).toHaveTextContent('Ethereal'));
      fireEvent.click(within(prompt).getByRole('button', { name: 'Mark as found' }));

      // Assert
      await waitFor(() =>
        expect(mockAddManualProgress).toHaveBeenCalledWith(
          expect.objectContaining({ itemId: 'item-1', isEthereal: true }),
        ),
      );
    });
  });

  describe('If ethereal tracking is disabled', () => {
    it('Then the version is not asked and the normal version is saved', async () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      const character = CharacterBuilder.new().withId('char-1').withName('Sorc').build();
      setupStoreMock({
        items: [item],
        characters: [character],
        settings: { grailEthereal: false },
      });
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      const prompt = openMarkAsFoundPrompt();

      // Act
      fireEvent.click(within(prompt).getByRole('button', { name: 'Mark as found' }));

      // Assert
      expect(within(prompt).queryByRole('combobox', { name: 'Version' })).not.toBeInTheDocument();
      await waitFor(() =>
        expect(mockAddManualProgress).toHaveBeenCalledWith(
          expect.objectContaining({ isEthereal: false }),
        ),
      );
    });
  });

  describe('If the item can only be ethereal', () => {
    it('Then the version is not asked and the ethereal version is saved', async () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('only').build();
      const character = CharacterBuilder.new().withId('char-1').withName('Sorc').build();
      setupStoreMock({ items: [item], characters: [character], settings: { grailEthereal: true } });
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      const prompt = openMarkAsFoundPrompt();

      // Act
      fireEvent.click(within(prompt).getByRole('button', { name: 'Mark as found' }));

      // Assert
      expect(within(prompt).queryByRole('combobox', { name: 'Version' })).not.toBeInTheDocument();
      await waitFor(() =>
        expect(mockAddManualProgress).toHaveBeenCalledWith(
          expect.objectContaining({ isEthereal: true }),
        ),
      );
    });
  });
});

describe('When the user removes a found record', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRemoveProgress.mockResolvedValue(undefined);
  });

  function setupWithRecord(manuallyAdded: boolean) {
    const item = HolyGrailItemBuilder.new().withId('item-1').withName('Shako').build();
    const character = CharacterBuilder.new().withId('char-1').withName('Sorc').build();
    const progress = GrailProgressBuilder.new()
      .withId('prog-1')
      .withCharacterId('char-1')
      .withItemId('item-1')
      .withFoundDate(new Date('2024-01-01'))
      .withManuallyAdded(manuallyAdded)
      .asNormal()
      .build();
    setupStoreMock({ items: [item], characters: [character], progress: [progress] });
  }

  describe('If the record was auto-detected', () => {
    it('Then no remove action is offered', () => {
      // Arrange
      setupWithRecord(false);

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
    });
  });

  describe('If the record was manually added and removal is confirmed', () => {
    it('Then the record is removed', async () => {
      // Arrange
      setupWithRecord(true);
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Remove Normal record for Sorc' }));
      const confirmation = screen.getByRole('alertdialog', { name: 'Remove found record?' });
      expect(confirmation).toHaveTextContent(
        'This removes the manually added Normal record of Shako for Sorc.',
      );

      // Act
      fireEvent.click(within(confirmation).getByRole('button', { name: 'Remove' }));

      // Assert
      await waitFor(() => expect(mockRemoveProgress).toHaveBeenCalledWith('prog-1'));
      await waitFor(() =>
        expect(
          screen.queryByRole('alertdialog', { name: 'Remove found record?' }),
        ).not.toBeInTheDocument(),
      );
    });
  });

  describe('If the removal is cancelled', () => {
    it('Then the record is kept', async () => {
      // Arrange
      setupWithRecord(true);
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Remove Normal record for Sorc' }));
      const confirmation = screen.getByRole('alertdialog', { name: 'Remove found record?' });

      // Act
      fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' }));

      // Assert
      await waitFor(() =>
        expect(
          screen.queryByRole('alertdialog', { name: 'Remove found record?' }),
        ).not.toBeInTheDocument(),
      );
      expect(mockRemoveProgress).not.toHaveBeenCalled();
    });
  });

  describe('If the removal fails', () => {
    it('Then an error is shown in the confirmation', async () => {
      // Arrange
      setupWithRecord(true);
      mockRemoveProgress.mockRejectedValue(new Error('DB error'));
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Remove Normal record for Sorc' }));
      const confirmation = screen.getByRole('alertdialog', { name: 'Remove found record?' });

      // Act
      fireEvent.click(within(confirmation).getByRole('button', { name: 'Remove' }));

      // Assert
      expect(await within(confirmation).findByRole('alert')).toHaveTextContent(
        'Could not remove this record. Please try again.',
      );
    });
  });
});
