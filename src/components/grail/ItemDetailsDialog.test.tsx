import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import dayjs from 'dayjs';
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

const mockAddManualProgress = vi.fn();
const mockRemoveProgress = vi.fn();

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
      setupStoreMock({ items: [item] });
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
  });

  describe('If progress shows not found', () => {
    it('Then shows Not Found badge', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      setupStoreMock({ items: [item] });
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
      fireEvent.click(footerClose as Element);

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

    it('Then the pagination range opts out of the display title font with font-ui', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      const characters = CharacterBuilder.new().withId('char').withName('Char').buildMany(7);
      setupStoreMock({ items: [item], characters });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByText(/1-5 of 7/)).toHaveClass('font-ui', 'font-normal');
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

  describe('If the item is shown without any found records', () => {
    it('Then the Mark as Found action is always available', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      setupStoreMock({ items: [item] });

      // Act
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.getByRole('button', { name: 'Mark as Found' })).toBeEnabled();
      expect(screen.queryByRole('button', { name: /Not Found/ })).not.toBeInTheDocument();
    });
  });
});

function openMarkAsFoundPrompt() {
  fireEvent.click(screen.getByRole('button', { name: 'Mark as Found' }));
  return screen.getByRole('dialog', { name: 'Mark as Found' });
}

describe('When the user marks an item as found', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupProgressLookup();
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
      expect(within(prompt).getByLabelText('Found Date')).toHaveValue(dayjs().format('YYYY-MM-DD'));
      expect(within(prompt).queryByRole('combobox', { name: 'Version' })).not.toBeInTheDocument();
    });

    it('Then submitting saves a manual record for the chosen character and date', async () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('none').build();
      const character = CharacterBuilder.new().withId('char-1').withName('Sorc').build();
      setupStoreMock({ items: [item], characters: [character] });
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      const prompt = openMarkAsFoundPrompt();
      fireEvent.change(within(prompt).getByLabelText('Found Date'), {
        target: { value: '2024-06-15' },
      });

      // Act
      fireEvent.click(within(prompt).getByRole('button', { name: 'Mark as Found' }));

      // Assert
      await waitFor(() => expect(mockAddManualProgress).toHaveBeenCalledTimes(1));
      const input = mockAddManualProgress.mock.calls[0][0];
      expect(input).toMatchObject({ itemId: 'item-1', characterId: 'char-1', isEthereal: false });
      expect(dayjs(input.foundDate).format('YYYY-MM-DD')).toBe('2024-06-15');
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Mark as Found' })).not.toBeInTheDocument(),
      );
    });

    it('Then a future found date cannot be submitted', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('none').build();
      const character = CharacterBuilder.new().withId('char-1').withName('Sorc').build();
      setupStoreMock({ items: [item], characters: [character] });
      render(<ItemDetailsDialog itemId="item-1" open={true} onOpenChange={vi.fn()} />);
      const prompt = openMarkAsFoundPrompt();

      // Act
      fireEvent.change(within(prompt).getByLabelText('Found Date'), {
        target: { value: dayjs().add(1, 'day').format('YYYY-MM-DD') },
      });

      // Assert
      expect(within(prompt).getByRole('button', { name: 'Mark as Found' })).toBeDisabled();
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
      fireEvent.click(within(prompt).getByRole('button', { name: 'Mark as Found' }));

      // Assert
      expect(await within(prompt).findByRole('alert')).toHaveTextContent(
        'Could not save this find. Please try again.',
      );
      expect(screen.getByRole('dialog', { name: 'Mark as Found' })).toBeInTheDocument();
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
      const prompt = openMarkAsFoundPrompt();

      // Assert
      expect(
        within(prompt).getByText('Sorc already has this version recorded.'),
      ).toBeInTheDocument();
      expect(within(prompt).getByRole('button', { name: 'Mark as Found' })).toBeDisabled();
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
      const prompt = openMarkAsFoundPrompt();

      // Assert
      const message = 'Sorc already has this version recorded.';
      expect(
        within(prompt).getByRole('combobox', { name: 'Character' }),
      ).toHaveAccessibleDescription(message);
      expect(
        within(prompt).getByRole('button', { name: 'Mark as Found' }),
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
      expect(within(prompt).getByRole('button', { name: 'Mark as Found' })).toBeDisabled();
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
        within(prompt).getByRole('button', { name: 'Mark as Found' }),
      ).toHaveAccessibleDescription(/No characters available yet/);
    });
  });

  describe('If the details dialog is closed and reopened or switched to another item', () => {
    it('Then the Mark as Found prompt does not carry over', () => {
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
      expect(screen.queryByRole('dialog', { name: 'Mark as Found' })).not.toBeInTheDocument();

      // Act
      openMarkAsFoundPrompt();
      rerender(<ItemDetailsDialog itemId="item-2" open={false} onOpenChange={vi.fn()} />);
      rerender(<ItemDetailsDialog itemId="item-2" open={true} onOpenChange={vi.fn()} />);

      // Assert
      expect(screen.queryByRole('dialog', { name: 'Mark as Found' })).not.toBeInTheDocument();
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
      fireEvent.click(within(prompt).getByRole('button', { name: 'Mark as Found' }));

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
      fireEvent.click(within(prompt).getByRole('button', { name: 'Mark as Found' }));

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
      fireEvent.click(within(prompt).getByRole('button', { name: 'Mark as Found' }));

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
    setupProgressLookup();
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
