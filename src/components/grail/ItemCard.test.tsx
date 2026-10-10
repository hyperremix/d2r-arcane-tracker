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
vi.mock('/images/placeholder-item.svg', () => ({ default: '/mock-placeholder.png' }));
vi.mock('./RuneImages', () => ({
  RuneImages: ({
    runeIds,
    focusableTriggers = true,
  }: {
    runeIds: string[];
    focusableTriggers?: boolean;
  }) => (
    <div data-testid="rune-images" data-focusable-triggers={String(focusableTriggers)}>
      {runeIds.join(',')}
    </div>
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

    it('Then does not render a redundant item type icon', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withType('unique').build();

      // Act
      render(<ItemCard item={item} />);

      // Assert
      expect(screen.queryByTestId('item-type-icon')).not.toBeInTheDocument();
    });

    it('Then lets long item names wrap to two lines instead of truncating them', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withName("Immortal King's Stone Crusher").build();

      // Act
      render(<ItemCard item={item} />);

      // Assert
      const name = screen.getByRole('heading', { name: "Immortal King's Stone Crusher" });
      expect(name).toHaveClass('line-clamp-2');
      expect(name).not.toHaveClass('truncate');
    });
  });

  describe('If the item has a base item', () => {
    it.each([
      'grid',
      'list',
    ] as const)('Then the %s card shows the base item as a subtitle', (viewMode) => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withType('unique')
        .withName('Harlequin Crest')
        .withItemBase('Shako')
        .build();

      // Act
      render(<ItemCard item={item} viewMode={viewMode} />);

      // Assert
      expect(screen.getByText('Shako')).toHaveClass('text-muted-foreground');
    });

    it('Then a rune card does not repeat its name as a subtitle', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withType('rune')
        .withName('El')
        .withItemBase('El Rune')
        .build();

      // Act
      render(<ItemCard item={item} />);

      // Assert
      expect(screen.queryByText('El Rune')).not.toBeInTheDocument();
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

  describe('If the item name tooltip is opened', () => {
    it.each([
      'grid',
      'list',
    ] as const)('Then the %s card shows the translated category and sub-category', async (viewMode) => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withName('Windforce')
        .withCategory('weapons')
        .withWeaponSubCategory('2h_swords')
        .build();
      render(<ItemCard item={item} viewMode={viewMode} />);

      // Act
      fireEvent.focus(
        screen.getByText('Windforce').closest('[data-slot="tooltip-trigger"]') as Element,
      );

      // Assert
      const label = await screen.findByText('Weapons • Two-Handed Swords');
      expect(label).toBeInTheDocument();
      expect(screen.queryByText(/2h swords/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/weapons • 2h/i)).not.toBeInTheDocument();
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

    it('Then shows no version pills when only normal items are tracked', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      const normalProgress = GrailProgressBuilder.new()
        .withCharacterId('char-1')
        .withItemId('item-1')
        .asNormal()
        .build();

      setupStoreMock({ grailNormal: true, grailEthereal: false });

      // Act
      const { container } = render(<ItemCard item={item} normalProgress={[normalProgress]} />);

      // Assert
      expect(container.querySelector('[data-version]')).not.toBeInTheDocument();
      expect(screen.queryByText(/\dx/)).not.toBeInTheDocument();
    });

    it.each([
      'grid',
      'list',
    ] as const)('Then the %s card shows a found Normal pill and a missing Ethereal pill when ethereal tracking applies', (viewMode) => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('optional').build();
      const normalProgress = GrailProgressBuilder.new()
        .withCharacterId('char-1')
        .withItemId('item-1')
        .asNormal()
        .build();

      setupStoreMock({ grailNormal: true, grailEthereal: true });

      // Act
      const { container } = render(
        <ItemCard item={item} normalProgress={[normalProgress]} viewMode={viewMode} />,
      );

      // Assert
      const normalPill = container.querySelector('[data-version="normal"]');
      const etherealPill = container.querySelector('[data-version="ethereal"]');
      expect(normalPill).toHaveAttribute('data-found', 'true');
      expect(normalPill).toHaveClass('border-solid', 'text-item-unique');
      expect(normalPill).toHaveTextContent('Normal found');
      expect(etherealPill).toHaveAttribute('data-found', 'false');
      expect(etherealPill).toHaveClass('border-dashed', 'text-muted-foreground');
      expect(etherealPill).toHaveTextContent('Ethereal missing');
    });
  });

  describe('If an ethereal-only item is tracked', () => {
    it('Then shows a single missing "Ethereal Only" pill until it is found', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withEtherealType('only').build();
      setupStoreMock({ grailNormal: true, grailEthereal: true });

      // Act
      const { container } = render(<ItemCard item={item} />);

      // Assert
      const pills = container.querySelectorAll('[data-version]');
      expect(pills).toHaveLength(1);
      expect(pills[0]).toHaveAttribute('data-version', 'ethereal');
      expect(pills[0]).toHaveAttribute('data-found', 'false');
      expect(screen.getByText('Ethereal Only')).toBeInTheDocument();
    });
  });

  describe('If item has both normal and ethereal progress', () => {
    it('Then shows both version pills as found without per-character counts', () => {
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
      expect(screen.getByText('Normal found')).toBeInTheDocument();
      expect(screen.getByText('Ethereal found')).toBeInTheDocument();
      expect(screen.queryByText(/\dx/)).not.toBeInTheDocument();
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
    it('Then a recent find shows no "New" badge and is not announced as recent', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withName('Quiet').build();
      const normalProgress = GrailProgressBuilder.new()
        .withCharacterId('char-1')
        .withItemId('default-item')
        .withFoundDate(new Date())
        .withFromInitialScan(false)
        .asNormal()
        .build();

      // Act
      render(
        <ItemCard
          item={item}
          normalProgress={[normalProgress]}
          onClick={vi.fn()}
          withoutStatusIndicators
        />,
      );

      // Assert
      expect(screen.queryByTestId('recent-discovery-indicator')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Quiet, Found' })).toBeInTheDocument();
    });
  });

  describe('If onClick provided', () => {
    it('Then calls onClick on click', () => {
      // Arrange
      const onClick = vi.fn();
      const item = HolyGrailItemBuilder.new().withName('Clickable').build();
      render(<ItemCard item={item} onClick={onClick} />);

      // Act
      fireEvent.click(screen.getByRole('button', { name: 'Clickable, Not Found' }));

      // Assert
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it.each([
      'grid',
      'list',
    ] as const)('Then the %s card is a focusable button labeled with name and found status', (viewMode) => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withName('Focusable').build();
      const normalProgress = GrailProgressBuilder.new()
        .withCharacterId('char-1')
        .withItemId('item-1')
        .asNormal()
        .build();
      render(
        <ItemCard
          item={item}
          normalProgress={[normalProgress]}
          onClick={vi.fn()}
          viewMode={viewMode}
        />,
      );
      const card = screen.getByRole('button', { name: 'Focusable, Found' });

      // Act
      card.focus();

      // Assert
      expect(card).toHaveAttribute('tabindex', '0');
      expect(card).toHaveFocus();
      expect(card.className).toContain('focus-visible:ring-[3px]');
    });

    it.each([
      'grid',
      'list',
    ] as const)('Then the %s card calls onClick once when Enter is pressed', (viewMode) => {
      // Arrange
      const onClick = vi.fn();
      const item = HolyGrailItemBuilder.new().withName('Pressable').build();
      render(<ItemCard item={item} onClick={onClick} viewMode={viewMode} />);
      const card = screen.getByRole('button', { name: 'Pressable, Not Found' });

      // Act
      fireEvent.keyDown(card, { key: 'Enter' });

      // Assert
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it.each([
      'grid',
      'list',
    ] as const)('Then the %s card calls onClick once when Space is released', (viewMode) => {
      // Arrange
      const onClick = vi.fn();
      const item = HolyGrailItemBuilder.new().withName('Pressable').build();
      render(<ItemCard item={item} onClick={onClick} viewMode={viewMode} />);
      const card = screen.getByRole('button', { name: 'Pressable, Not Found' });

      // Act
      fireEvent.keyDown(card, { key: ' ' });
      fireEvent.keyUp(card, { key: ' ' });

      // Assert
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it.each([
      'grid',
      'list',
    ] as const)('Then the %s card does not call onClick on Space keydown alone and prevents page scroll', (viewMode) => {
      // Arrange
      const onClick = vi.fn();
      const item = HolyGrailItemBuilder.new().withName('Pressable').build();
      render(<ItemCard item={item} onClick={onClick} viewMode={viewMode} />);
      const card = screen.getByRole('button', { name: 'Pressable, Not Found' });

      // Act
      const notPrevented = fireEvent.keyDown(card, { key: ' ' });

      // Assert
      expect(onClick).not.toHaveBeenCalled();
      expect(notPrevented).toBe(false);
    });

    it.each([
      'grid',
      'list',
    ] as const)('Then the %s card does not call onClick when Enter or Space bubble from a nested element', (viewMode) => {
      // Arrange
      const onClick = vi.fn();
      const item = HolyGrailItemBuilder.new().withName('Nested Key').build();
      render(<ItemCard item={item} onClick={onClick} viewMode={viewMode} />);
      const card = screen.getByRole('button', { name: 'Nested Key, Not Found' });
      const nested = screen.getByText('Nested Key');
      expect(card).not.toBe(nested);
      expect(card).toContainElement(nested);

      // Act
      fireEvent.keyDown(nested, { key: 'Enter' });
      fireEvent.keyDown(nested, { key: ' ' });
      fireEvent.keyUp(nested, { key: ' ' });

      // Assert
      expect(onClick).not.toHaveBeenCalled();
    });

    it.each([
      'grid',
      'list',
    ] as const)('Then the %s card ignores a stray Space keyup without a prior keydown on the card', (viewMode) => {
      // Arrange
      const onClick = vi.fn();
      const item = HolyGrailItemBuilder.new().withName('Stray Key').build();
      render(<ItemCard item={item} onClick={onClick} viewMode={viewMode} />);
      const card = screen.getByRole('button', { name: 'Stray Key, Not Found' });

      // Act
      fireEvent.keyUp(card, { key: ' ' });

      // Assert
      expect(onClick).not.toHaveBeenCalled();
    });

    it.each([
      'grid',
      'list',
    ] as const)('Then the %s card activates only once per Space press and ignores a second keyup', (viewMode) => {
      // Arrange
      const onClick = vi.fn();
      const item = HolyGrailItemBuilder.new().withName('Once Key').build();
      render(<ItemCard item={item} onClick={onClick} viewMode={viewMode} />);
      const card = screen.getByRole('button', { name: 'Once Key, Not Found' });

      // Act
      fireEvent.keyDown(card, { key: ' ' });
      fireEvent.keyUp(card, { key: ' ' });
      fireEvent.keyUp(card, { key: ' ' });

      // Assert
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it.each([
      'grid',
      'list',
    ] as const)('Then the %s card ignores a Space keyup after focus left the card mid-press', (viewMode) => {
      // Arrange
      const onClick = vi.fn();
      const item = HolyGrailItemBuilder.new().withName('Blur Key').build();
      render(<ItemCard item={item} onClick={onClick} viewMode={viewMode} />);
      const card = screen.getByRole('button', { name: 'Blur Key, Not Found' });
      fireEvent.keyDown(card, { key: ' ' });

      // Act
      fireEvent.blur(card);
      fireEvent.keyUp(card, { key: ' ' });

      // Assert
      expect(onClick).not.toHaveBeenCalled();
    });

    it('Then does not call onClick when Enter is released', () => {
      // Arrange
      const onClick = vi.fn();
      const item = HolyGrailItemBuilder.new().withName('Pressable').build();
      render(<ItemCard item={item} onClick={onClick} />);
      const card = screen.getByRole('button', { name: 'Pressable, Not Found' });

      // Act
      fireEvent.keyUp(card, { key: 'Enter' });

      // Assert
      expect(onClick).not.toHaveBeenCalled();
    });

    it.each(['Tab', 'Escape', 'a'])('Then does not call onClick on the "%s" key', (key) => {
      // Arrange
      const onClick = vi.fn();
      const item = HolyGrailItemBuilder.new().withName('Ignorable').build();
      render(<ItemCard item={item} onClick={onClick} />);
      const card = screen.getByRole('button', { name: 'Ignorable, Not Found' });

      // Act
      fireEvent.keyDown(card, { key });
      fireEvent.keyUp(card, { key });

      // Assert
      expect(onClick).not.toHaveBeenCalled();
    });

    it('Then contains no nested focusable elements', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withName('Nested').build();
      const normalProgress = GrailProgressBuilder.new()
        .withCharacterId('char-1')
        .withItemId('item-1')
        .asNormal()
        .build();
      const characters = [CharacterBuilder.new().withId('char-1').withName('Char').build()];

      // Act
      render(
        <ItemCard
          item={item}
          normalProgress={[normalProgress]}
          characters={characters}
          onClick={vi.fn()}
        />,
      );

      // Assert
      const card = screen.getByRole('button', { name: 'Nested, Found' });
      expect(card.querySelectorAll('button, [tabindex]:not([tabindex="-1"])')).toHaveLength(0);
    });

    it('Then rune tooltip triggers are not focusable on a runeword card', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withType('runeword')
        .withRunewordSubCategory('runewords')
        .build();
      (item as { runes: string[] }).runes = ['r01', 'r02'];

      // Act
      render(<ItemCard item={item} onClick={vi.fn()} />);

      // Assert
      expect(screen.getByTestId('rune-images')).toHaveAttribute('data-focusable-triggers', 'false');
    });
  });

  describe('If onClick is not provided', () => {
    it('Then the card is not exposed as a focusable button', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withName('Static').build();

      // Act
      render(<ItemCard item={item} />);

      // Assert
      expect(screen.queryByRole('button', { name: 'Static, Not Found' })).not.toBeInTheDocument();
    });

    it.each([
      'grid',
      'list',
    ] as const)('Then the %s card keeps item and character tooltip triggers keyboard focusable', (viewMode) => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('item-1').withName('Static').build();
      const normalProgress = GrailProgressBuilder.new()
        .withCharacterId('char-1')
        .withItemId('item-1')
        .withFoundDate(new Date('2020-01-01T00:00:00Z'))
        .asNormal()
        .build();
      const characters = [CharacterBuilder.new().withId('char-1').withName('Char').build()];

      // Act
      const { container } = render(
        <ItemCard
          item={item}
          normalProgress={[normalProgress]}
          characters={characters}
          viewMode={viewMode}
        />,
      );

      // Assert
      const triggerTagNames = Array.from(
        container.querySelectorAll('[data-slot="tooltip-trigger"]'),
        (trigger) => trigger.tagName,
      );
      expect(triggerTagNames).toEqual(['BUTTON', 'BUTTON']);
    });

    it('Then rune tooltip triggers stay focusable on a runeword card', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withType('runeword')
        .withRunewordSubCategory('runewords')
        .build();
      (item as { runes: string[] }).runes = ['r01', 'r02'];

      // Act
      render(<ItemCard item={item} />);

      // Assert
      expect(screen.getByTestId('rune-images')).toHaveAttribute('data-focusable-triggers', 'true');
    });
  });

  describe('If item is missing', () => {
    it.each([
      'grid',
      'list',
    ] as const)('Then the %s card shows a muted, neutral name without dimming it with opacity', (viewMode) => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withType('unique').withName('Missing Item').build();

      // Act
      render(<ItemCard item={item} viewMode={viewMode} onClick={vi.fn()} />);

      // Assert
      const name = screen.getByText('Missing Item');
      const ancestorsWithOpacity = [];
      for (let element: HTMLElement | null = name; element; element = element.parentElement) {
        if (/(^|\s)opacity-\d+/.test(element.className)) ancestorsWithOpacity.push(element);
      }
      expect(ancestorsWithOpacity).toHaveLength(0);
      expect(name).toHaveClass('text-muted-foreground');
      expect(name).not.toHaveClass('text-item-unique');
    });

    it.each([
      'grid',
      'list',
    ] as const)('Then the %s card shows grayscale, dimmed artwork', (viewMode) => {
      // Arrange
      setupStoreMock({ showItemIcons: true });
      const item = HolyGrailItemBuilder.new().withType('unique').build();

      // Act
      render(<ItemCard item={item} viewMode={viewMode} />);

      // Assert
      expect(screen.getByTestId('item-artwork')).toHaveClass('grayscale', 'opacity-40');
    });

    it.each([
      'grid',
      'list',
    ] as const)('Then the %s card uses a neutral border and muted surface without any quality color', (viewMode) => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withType('unique').withName('Neutral').build();

      // Act
      render(<ItemCard item={item} onClick={vi.fn()} viewMode={viewMode} />);

      // Assert
      const card = screen.getByRole('button', { name: 'Neutral, Not Found' });
      const surface = viewMode === 'grid' ? card.querySelector('[data-found]') : card;
      expect(surface).toHaveAttribute('data-found', 'false');
      expect(surface).toHaveClass('border-border', 'bg-muted/40');
      expect(surface?.className).not.toMatch(/item-unique/);
    });

    it('Then the set name is muted rather than set-colored', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withType('set')
        .withSetName("Tal Rasha's Wrappings")
        .build();

      // Act
      render(<ItemCard item={item} />);

      // Assert
      const setName = screen.getByText("Set: Tal Rasha's Wrappings");
      expect(setName).toHaveClass('text-muted-foreground');
      expect(setName).not.toHaveClass('text-item-set');
    });
  });

  describe('If item is found', () => {
    it.each([
      'grid',
      'list',
    ] as const)('Then the %s card is lit with a quality border, a quality-colored name and colored artwork', (viewMode) => {
      // Arrange
      setupStoreMock({ showItemIcons: true });
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withType('unique')
        .withName('Found Item')
        .build();
      const normalProgress = GrailProgressBuilder.new()
        .withCharacterId('char-1')
        .withItemId('item-1')
        .asNormal()
        .build();

      // Act
      render(
        <ItemCard
          item={item}
          normalProgress={[normalProgress]}
          onClick={vi.fn()}
          viewMode={viewMode}
        />,
      );

      // Assert
      const card = screen.getByRole('button', { name: 'Found Item, Found' });
      const surface = viewMode === 'grid' ? card.querySelector('[data-found]') : card;
      expect(surface).toHaveAttribute('data-found', 'true');
      expect(surface).toHaveClass('bg-card', 'border-item-unique/60');
      expect(screen.getByRole('heading', { name: 'Found Item' })).toHaveClass(
        'text-item-unique',
        'font-semibold',
      );
      expect(screen.getByTestId('item-artwork')).not.toHaveClass('grayscale');
    });
  });

  describe('If the item has a quality type and is found', () => {
    it.each([
      ['grid', 'unique', 'text-item-unique'],
      ['grid', 'set', 'text-item-set'],
      ['grid', 'rune', 'text-item-rune'],
      ['grid', 'runeword', 'text-item-runeword'],
      ['list', 'unique', 'text-item-unique'],
      ['list', 'set', 'text-item-set'],
      ['list', 'rune', 'text-item-rune'],
      ['list', 'runeword', 'text-item-runeword'],
    ] as const)('Then the %s card colors a %s item name with %s', (viewMode, type, expected) => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withType(type)
        .withName('Quality Item')
        .build();
      const normalProgress = GrailProgressBuilder.new().withItemId('item-1').asNormal().build();

      // Act
      render(<ItemCard item={item} normalProgress={[normalProgress]} viewMode={viewMode} />);

      // Assert
      const name = screen.getByRole('heading', { name: 'Quality Item' });
      expect(name).toHaveClass(expected);
      expect(name).not.toHaveClass('text-foreground');
    });
  });

  describe('If the card is hovered', () => {
    it('Then the grid card does not scale or show a colored ring, so it never overlaps its gutters', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withType('unique').withName('Steady').build();

      // Act
      render(<ItemCard item={item} onClick={vi.fn()} />);

      // Assert
      const card = screen.getByRole('button', { name: 'Steady, Not Found' });
      const surface = card.querySelector('[data-found]');
      expect(card.className).not.toMatch(/scale-/);
      expect(surface?.className).not.toMatch(/scale-/);
      expect(surface?.className).not.toMatch(/hover:ring/);
    });

    it.each([
      'grid',
      'list',
    ] as const)('Then the non-clickable %s card has no hover styles, so it does not look interactive', (viewMode) => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withType('unique').withName('Static').build();

      // Act
      const { container } = render(<ItemCard item={item} viewMode={viewMode} />);

      // Assert
      const surface = container.querySelector('[data-found]');
      expect(surface).toBeInTheDocument();
      expect(surface?.className).not.toMatch(/hover:/);
      expect(surface?.className).not.toMatch(/transition/);
      expect(screen.queryByRole('button', { name: 'Static, Not Found' })).not.toBeInTheDocument();
    });

    it.each([
      'grid',
      'list',
    ] as const)('Then the clickable found %s card strengthens its quality border and keeps its focus styling', (viewMode) => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withType('unique')
        .withName('Clickable')
        .build();
      const normalProgress = GrailProgressBuilder.new().withItemId('item-1').asNormal().build();

      // Act
      render(
        <ItemCard
          item={item}
          normalProgress={[normalProgress]}
          viewMode={viewMode}
          onClick={vi.fn()}
        />,
      );

      // Assert
      const card = screen.getByRole('button', { name: 'Clickable, Found' });
      const surface = viewMode === 'grid' ? card.querySelector('[data-found]') : card;
      expect(surface).toHaveClass('hover:border-item-unique', 'hover:shadow-md');
      expect(card).toHaveClass('cursor-pointer', 'focus-visible:ring-[3px]');
    });
  });

  describe('If the card is clickable and ethereal tracking applies', () => {
    it.each([
      'grid',
      'list',
    ] as const)('Then the %s card label names the status of every tracked version', (viewMode) => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withName('Labeled')
        .withEtherealType('optional')
        .build();
      const normalProgress = GrailProgressBuilder.new().withItemId('item-1').asNormal().build();
      setupStoreMock({ grailNormal: true, grailEthereal: true });

      // Act
      render(
        <ItemCard
          item={item}
          normalProgress={[normalProgress]}
          onClick={vi.fn()}
          viewMode={viewMode}
        />,
      );

      // Assert
      expect(
        screen.getByRole('button', { name: 'Labeled, Normal found, Ethereal missing' }),
      ).toBeInTheDocument();
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
    it('Then the found pill shows no misleading copy count', () => {
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

      setupStoreMock({ grailNormal: true, grailEthereal: true });

      // Act
      const { container } = render(
        <ItemCard item={item} normalProgress={progressRecords} characters={[character]} />,
      );

      // Assert
      expect(container.querySelector('[data-version="normal"]')).toHaveAttribute(
        'data-found',
        'true',
      );
      expect(screen.queryByText(/4x/)).not.toBeInTheDocument();
      expect(screen.getAllByTestId('character-icon')).toHaveLength(1);
    });
  });

  describe('If recent find (not initial scan)', () => {
    it.each([
      'grid',
      'list',
    ] as const)('Then the %s card renders the "New" indicator', (viewMode) => {
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
      render(<ItemCard item={item} normalProgress={[normalProgress]} viewMode={viewMode} />);

      // Assert
      expect(screen.getByTestId('recent-discovery-indicator')).toBeInTheDocument();
    });

    it('Then the partial version state stays visible and both are part of the card label', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new()
        .withId('item-1')
        .withName('Fresh')
        .withEtherealType('optional')
        .build();
      const normalProgress = GrailProgressBuilder.new()
        .withItemId('item-1')
        .withFoundDate(new Date())
        .withFromInitialScan(false)
        .asNormal()
        .build();
      setupStoreMock({ grailNormal: true, grailEthereal: true });

      // Act
      const { container } = render(
        <ItemCard item={item} normalProgress={[normalProgress]} onClick={vi.fn()} />,
      );

      // Assert
      expect(screen.getByTestId('recent-discovery-indicator')).toBeInTheDocument();
      expect(container.querySelector('[data-version="ethereal"]')).toHaveAttribute(
        'data-found',
        'false',
      );
      expect(
        screen.getByRole('button', {
          name: 'Fresh, Normal found, Ethereal missing, Recently found',
        }),
      ).toBeInTheDocument();
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
