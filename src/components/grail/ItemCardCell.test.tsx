import { render } from '@testing-library/react';
import type { Character, GrailProgress } from 'electron/types/grail';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HolyGrailItemBuilder } from '@/fixtures';
import type { ProgressLookupData } from '@/hooks/useProgressLookup';
import { ItemCardCell } from './MasonryItemGrid';

interface RenderedItemCardProps {
  normalProgress: GrailProgress[];
  etherealProgress: GrailProgress[];
  onClick: () => void;
}

// Records the props of every ItemCard render
const itemCardRenders = vi.hoisted(() => ({ props: [] as RenderedItemCardProps[] }));

// Not memoized, so every render of ItemCardCell that reaches ItemCard is recorded
vi.mock('./ItemCard', () => ({
  ItemCard: (props: RenderedItemCardProps) => {
    itemCardRenders.props.push(props);
    return <div data-testid="item-card" />;
  },
}));

function createProgress(itemId: string): GrailProgress {
  return {
    id: `progress-${itemId}`,
    characterId: 'char-1',
    itemId,
    manuallyAdded: false,
    isEthereal: false,
  };
}

function createLookup(entries: Record<string, GrailProgress[]> = {}) {
  const lookup = new Map<string, ProgressLookupData>();
  for (const [itemId, normalProgress] of Object.entries(entries)) {
    lookup.set(itemId, {
      normalFound: normalProgress.length > 0,
      etherealFound: false,
      normalProgress,
      etherealProgress: [],
      overallFound: normalProgress.length > 0,
    });
  }
  return lookup;
}

const item = HolyGrailItemBuilder.new().withId('item-1').withName('Windforce').build();
const characters: Character[] = [];

beforeEach(() => {
  itemCardRenders.props.length = 0;
});

describe('When an ItemCardCell is re-rendered by its parent', () => {
  describe('If it receives identical props', () => {
    it('Then ItemCard is not rendered again', () => {
      // Arrange
      const props = {
        item,
        progressLookup: createLookup({ 'item-1': [createProgress('item-1')] }),
        characters,
        onItemClick: vi.fn(),
        viewMode: 'grid' as const,
      };
      const { rerender } = render(<ItemCardCell {...props} />);
      expect(itemCardRenders.props).toHaveLength(1);

      // Act
      rerender(<ItemCardCell {...props} />);
      rerender(<ItemCardCell {...props} />);

      // Assert
      expect(itemCardRenders.props).toHaveLength(1);
    });
  });

  describe('If the progress lookup changes only for other items', () => {
    it('Then ItemCard keeps receiving the same progress arrays and click handler', () => {
      // Arrange
      const props = { item, characters, onItemClick: vi.fn(), viewMode: 'list' as const };
      const { rerender } = render(<ItemCardCell {...props} progressLookup={createLookup()} />);

      // Act
      rerender(
        <ItemCardCell
          {...props}
          progressLookup={createLookup({ 'other-item': [createProgress('other-item')] })}
        />,
      );

      // Assert — the memoized ItemCard skips because its props are referentially stable
      const [first, second] = itemCardRenders.props;
      expect(itemCardRenders.props).toHaveLength(2);
      expect(second.normalProgress).toBe(first.normalProgress);
      expect(second.etherealProgress).toBe(first.etherealProgress);
      expect(second.onClick).toBe(first.onClick);
    });
  });

  describe('If the progress of its own item changes', () => {
    it('Then ItemCard is rendered again with the new progress', () => {
      // Arrange
      const props = { item, characters, onItemClick: vi.fn(), viewMode: 'grid' as const };
      const { rerender } = render(<ItemCardCell {...props} progressLookup={createLookup()} />);
      const progress = createProgress('item-1');

      // Act
      rerender(<ItemCardCell {...props} progressLookup={createLookup({ 'item-1': [progress] })} />);

      // Assert
      expect(itemCardRenders.props).toHaveLength(2);
      expect(itemCardRenders.props[1].normalProgress).toEqual([progress]);
    });
  });

  describe('If the view mode, the item or the characters change', () => {
    it.each([
      ['view mode', { viewMode: 'list' as const }],
      ['item', { item: HolyGrailItemBuilder.new().withId('item-2').withName('Shako').build() }],
      ['characters', { characters: [] as Character[] }],
    ])('Then ItemCard is rendered again when the %s changes', (_name, changedProps) => {
      // Arrange
      const props = {
        item,
        progressLookup: createLookup(),
        characters,
        onItemClick: vi.fn(),
        viewMode: 'grid' as const,
      };
      const { rerender } = render(<ItemCardCell {...props} />);

      // Act
      rerender(<ItemCardCell {...props} {...changedProps} />);

      // Assert
      expect(itemCardRenders.props).toHaveLength(2);
    });
  });

  describe('If the card is clicked', () => {
    it('Then the click handler is called with the item id', () => {
      // Arrange
      const onItemClick = vi.fn();
      render(
        <ItemCardCell
          item={item}
          progressLookup={createLookup()}
          characters={characters}
          onItemClick={onItemClick}
          viewMode="grid"
        />,
      );

      // Act
      itemCardRenders.props[0].onClick();

      // Assert
      expect(onItemClick).toHaveBeenCalledExactlyOnceWith('item-1');
    });
  });
});
