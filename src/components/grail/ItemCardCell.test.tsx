import { render } from '@testing-library/react';
import type { Character, GrailProgress } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HolyGrailItemBuilder } from '@/fixtures';
import type { ProgressLookupData } from '@/hooks/useProgressLookup';

interface RenderedItemCardProps {
  normalProgress: GrailProgress[];
  etherealProgress: GrailProgress[];
  onClick: () => void;
}

// Records the props of every ItemCard render
const itemCardRenders = { props: [] as RenderedItemCardProps[] };

// Loaded per test: the suite shares one module cache across files (isolate: false), so a cached
// MasonryItemGrid from another file would keep that file's ItemCard mock instead of this one
let ItemCardCell: typeof import('./MasonryItemGrid').ItemCardCell;

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

beforeEach(async () => {
  itemCardRenders.props.length = 0;
  vi.resetModules();
  // Not memoized, so every render of ItemCardCell that reaches ItemCard is recorded
  vi.doMock('./ItemCard', () => ({
    ItemCard: (props: RenderedItemCardProps) => {
      itemCardRenders.props.push(props);
      return <div data-testid="item-card" />;
    },
  }));
  ({ ItemCardCell } = await import('./MasonryItemGrid'));
});

afterEach(() => {
  // Do not leak this file's ItemCard mock or MasonryItemGrid instance into other test files
  vi.doUnmock('./ItemCard');
  vi.resetModules();
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

      // Act
      rerender(<ItemCardCell {...props} />);
      rerender(<ItemCardCell {...props} />);

      // Assert — only the initial mount reached ItemCard
      expect(itemCardRenders.props).toHaveLength(1);
    });
  });

  describe('If the progress lookup changes only for other items', () => {
    it('Then the next ItemCard render receives referentially equal progress arrays and click handler', () => {
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

      // Assert — equal references are what lets the real, memoized ItemCard skip this render
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
