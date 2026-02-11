import { fireEvent, render, screen } from '@testing-library/react';
import type { Settings } from 'electron/types/grail';
import { GameMode, GameVersion } from 'electron/types/grail';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterBuilder, GrailProgressBuilder, HolyGrailItemBuilder } from '@/fixtures';
import { ItemCard } from './ItemCard';

// Mock dependencies
vi.mock('@/stores/grailStore');
vi.mock('@/hooks/useItemIcon', () => ({
  useItemIcon: () => ({ iconUrl: '/mock-icon.png', isLoading: false, error: null }),
}));
vi.mock('/images/placeholder-item.png', () => ({ default: '/mock-placeholder.png' }));
vi.mock('./RuneImages', () => ({
  RuneImages: ({ runeIds }: { runeIds: string[] }) => (
    <div data-testid="rune-images">{runeIds.join(',')}</div>
  ),
}));
vi.mock('./StatusIcons', () => ({
  CharacterIcon: ({ characterClass }: { characterClass: string }) => (
    <span data-testid="character-icon">{characterClass}</span>
  ),
  ItemTypeIcon: ({ type }: { type: string }) => <span data-testid="item-type-icon">{type}</span>,
  RecentDiscoveryIndicator: ({ foundDate }: { foundDate: Date }) => (
    <span data-testid="recent-discovery-indicator">{foundDate.toISOString()}</span>
  ),
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

function setupStoreMock(settingsOverrides: Partial<Settings> = {}) {
  const storeState = {
    settings: { ...defaultSettings, ...settingsOverrides },
  };

  const mockUseGrailStore = vi.mocked(useGrailStore);
  mockUseGrailStore.mockImplementation((selector?: unknown) => {
    if (typeof selector === 'function') {
      return (selector as (s: typeof storeState) => unknown)(storeState);
    }
    return storeState as ReturnType<typeof useGrailStore>;
  });
}

describe('When ItemCard is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStoreMock();
  });

  describe('If viewMode is "grid" (default)', () => {
    it('Then renders item name', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withName('Windforce').build();

      // Act
      render(<ItemCard item={item} />);

      // Assert
      expect(screen.getByText('Windforce')).toBeInTheDocument();
    });

    it('Then renders item type icon', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withType('unique').build();

      // Act
      render(<ItemCard item={item} />);

      // Assert
      expect(screen.getByTestId('item-type-icon')).toBeInTheDocument();
    });
  });

  describe('If viewMode is "list"', () => {
    it('Then renders item name in list layout', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withName('Windforce').build();

      // Act
      render(<ItemCard item={item} viewMode="list" />);

      // Assert
      expect(screen.getByText('Windforce')).toBeInTheDocument();
    });
  });

  describe('If item has no progress', () => {
    it('Then does not render attribution', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().build();

      // Act
      render(<ItemCard item={item} />);

      // Assert
      expect(screen.queryByText('Found by:')).not.toBeInTheDocument();
    });
  });

  describe('If item has normal progress', () => {
    it('Then shows attribution', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      const character = CharacterBuilder.new().withId('char-1').withName('TestSorc').build();
      const normalProgress = GrailProgressBuilder.new()
        .withId('prog-1')
        .withCharacterId('char-1')
        .withItemId('item-1')
        .asNormal()
        .build();

      setupStoreMock({ grailNormal: true });

      // Act
      render(<ItemCard item={item} normalProgress={[normalProgress]} characters={[character]} />);

      // Assert
      expect(screen.getByText('Found by:')).toBeInTheDocument();
    });

    it('Then shows Normal version count badge', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      const normalProgress = GrailProgressBuilder.new()
        .withCharacterId('char-1')
        .withItemId('item-1')
        .asNormal()
        .build();

      setupStoreMock({ grailNormal: true });

      // Act
      render(<ItemCard item={item} normalProgress={[normalProgress]} />);

      // Assert
      expect(screen.getByText(/Normal: 1x/)).toBeInTheDocument();
    });
  });

  describe('If item has both normal and ethereal progress', () => {
    it('Then shows both version count badges', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      const normalProgress = GrailProgressBuilder.new()
        .withId('prog-1')
        .withCharacterId('char-1')
        .withItemId('item-1')
        .asNormal()
        .build();
      const etherealProgress = GrailProgressBuilder.new()
        .withId('prog-2')
        .withCharacterId('char-1')
        .withItemId('item-1')
        .asEthereal()
        .build();

      setupStoreMock({ grailNormal: true, grailEthereal: true });

      // Act
      render(
        <ItemCard
          item={item}
          normalProgress={[normalProgress]}
          etherealProgress={[etherealProgress]}
        />,
      );

      // Assert
      expect(screen.getByText(/Normal: 1x/)).toBeInTheDocument();
      expect(screen.getByText(/Ethereal: 1x/)).toBeInTheDocument();
    });
  });

  describe('If item is runeword with runes', () => {
    it('Then renders RuneImages mock', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withType('runeword')
        .withRunewordSubCategory('runewords')
        .build();
      // Add runes directly since builder doesn't have a runes method
      (item as { runes: string[] }).runes = ['r01', 'r02', 'r03'];

      // Act
      render(<ItemCard item={item} />);

      // Assert
      expect(screen.getByTestId('rune-images')).toBeInTheDocument();
    });
  });

  describe('If showItemIcons enabled and not runeword', () => {
    it('Then renders img element', () => {
      // Arrange
      setupStoreMock({ showItemIcons: true });
      const item = HolyGrailItemBuilder.new().withType('unique').build();

      // Act
      render(<ItemCard item={item} />);

      // Assert
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });

  describe('If showItemIcons disabled', () => {
    it('Then does not render img element for non-runeword item', () => {
      // Arrange
      setupStoreMock({ showItemIcons: false });
      const item = HolyGrailItemBuilder.new().withType('unique').build();

      // Act
      render(<ItemCard item={item} />);

      // Assert
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('If set item with setName', () => {
    it('Then renders set name text in grid view', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withType('set')
        .withSetName("Tal Rasha's Wrappings")
        .build();

      // Act
      render(<ItemCard item={item} />);

      // Assert
      expect(screen.getByText("Set: Tal Rasha's Wrappings")).toBeInTheDocument();
    });
  });

  describe('If withoutStatusIndicators is true', () => {
    it('Then no StatusIndicators rendered', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().build();
      const normalProgress = GrailProgressBuilder.new()
        .withCharacterId('char-1')
        .withItemId('default-item')
        .asNormal()
        .build();

      // Act
      render(<ItemCard item={item} normalProgress={[normalProgress]} withoutStatusIndicators />);

      // Assert — no recent discovery indicator or status icons expected
      expect(screen.queryByTestId('recent-discovery-indicator')).not.toBeInTheDocument();
    });
  });

  describe('If onClick provided', () => {
    it('Then calls onClick on click', () => {
      // Arrange
      const onClick = vi.fn();
      const item = HolyGrailItemBuilder.new().withName('Clickable').build();

      // Act
      render(<ItemCard item={item} onClick={onClick} />);
      const card = screen.getByText('Clickable').closest('[class*="rounded-lg"]');
      expect(card).toBeTruthy();
      if (!card) throw new Error('Expected card element');
      fireEvent.click(card);

      // Assert
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('Then calls onClick on Enter key', () => {
      // Arrange
      const onClick = vi.fn();
      const item = HolyGrailItemBuilder.new().withName('Pressable').build();

      // Act
      render(<ItemCard item={item} onClick={onClick} />);
      const card = screen.getByText('Pressable').closest('[class*="rounded-lg"]');
      expect(card).toBeTruthy();
      if (!card) throw new Error('Expected card element');
      fireEvent.keyDown(card, { key: 'Enter' });

      // Assert
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('Then calls onClick on Space key', () => {
      // Arrange
      const onClick = vi.fn();
      const item = HolyGrailItemBuilder.new().withName('Spaceable').build();

      // Act
      render(<ItemCard item={item} onClick={onClick} />);
      const card = screen.getByText('Spaceable').closest('[class*="rounded-lg"]');
      expect(card).toBeTruthy();
      if (!card) throw new Error('Expected card element');
      fireEvent.keyDown(card, { key: ' ' });

      // Assert
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('Then does not call onClick on other keys', () => {
      // Arrange
      const onClick = vi.fn();
      const item = HolyGrailItemBuilder.new().withName('Ignorable').build();

      // Act
      render(<ItemCard item={item} onClick={onClick} />);
      const card = screen.getByText('Ignorable').closest('[class*="rounded-lg"]');
      expect(card).toBeTruthy();
      if (!card) throw new Error('Expected card element');
      fireEvent.keyDown(card, { key: 'Tab' });

      // Assert
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('If > 2 discovering characters', () => {
    it('Then shows 2 icons and overflow count', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      const characters = CharacterBuilder.new().withId('char').withName('Char').buildMany(3);
      const progressRecords = characters.map((char, i) =>
        GrailProgressBuilder.new()
          .withId(`prog-${i}`)
          .withCharacterId(char.id)
          .withItemId('item-1')
          .asNormal()
          .build(),
      );

      // Act
      render(<ItemCard item={item} normalProgress={progressRecords} characters={characters} />);

      // Assert
      const characterIcons = screen.getAllByTestId('character-icon');
      expect(characterIcons).toHaveLength(2);
      expect(screen.getByText('+1')).toBeInTheDocument();
    });
  });

  describe('If > 3 progress records', () => {
    it('Then version count badge shows correct count', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      const character = CharacterBuilder.new().withId('char-1').withName('Sorc').build();
      const progressRecords = Array.from({ length: 4 }, (_, i) =>
        GrailProgressBuilder.new()
          .withId(`prog-${i}`)
          .withCharacterId('char-1')
          .withItemId('item-1')
          .asNormal()
          .build(),
      );

      setupStoreMock({ grailNormal: true });

      // Act
      render(<ItemCard item={item} normalProgress={progressRecords} characters={[character]} />);

      // Assert — shows the correct number of normal versions found
      expect(screen.getByText(/Normal: 4x/)).toBeInTheDocument();
    });
  });

  describe('If recent find (not initial scan)', () => {
    it('Then renders RecentDiscoveryIndicator', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      const recentDate = new Date(); // Now is always "recent"
      const normalProgress = GrailProgressBuilder.new()
        .withId('prog-1')
        .withCharacterId('char-1')
        .withItemId('item-1')
        .withFoundDate(recentDate)
        .withFromInitialScan(false)
        .asNormal()
        .build();

      // Act
      render(<ItemCard item={item} normalProgress={[normalProgress]} />);

      // Assert
      expect(screen.getByTestId('recent-discovery-indicator')).toBeInTheDocument();
    });
  });

  describe('If discovery from initial scan', () => {
    it('Then does NOT render RecentDiscoveryIndicator', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').build();
      const recentDate = new Date();
      const normalProgress = GrailProgressBuilder.new()
        .withId('prog-1')
        .withCharacterId('char-1')
        .withItemId('item-1')
        .withFoundDate(recentDate)
        .asFromInitialScan()
        .asNormal()
        .build();

      // Act
      render(<ItemCard item={item} normalProgress={[normalProgress]} />);

      // Assert
      expect(screen.queryByTestId('recent-discovery-indicator')).not.toBeInTheDocument();
    });
  });
});
