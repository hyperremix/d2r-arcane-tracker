import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HolyGrailItemBuilder } from '@/fixtures';

// Counts renders of the card artwork (GridArtwork / ListArtwork call useItemIcon on every render)
const renderCounter = { itemIconCalls: 0 };

// The suite shares one module cache across files (isolate: false) and other ItemCard tests mock
// the grail store, so the real store and ItemCard are loaded fresh for every test and unloaded
// afterwards
let useGrailStore: typeof import('@/stores/grailStore').useGrailStore;
let ItemCard: typeof import('./ItemCard').ItemCard;
let initialStoreState: ReturnType<typeof useGrailStore.getState>;

beforeEach(async () => {
  vi.resetModules();
  vi.doUnmock('@/stores/grailStore');
  vi.doUnmock('./ItemCard');
  vi.doMock('@/hooks/useItemIcon', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/hooks/useItemIcon')>();
    return {
      ...actual,
      useItemIcon: (...args: Parameters<typeof actual.useItemIcon>) => {
        renderCounter.itemIconCalls++;
        return actual.useItemIcon(...args);
      },
    };
  });
  vi.doMock('/images/placeholder-item.svg', () => ({ default: '/mock-placeholder.png' }));
  ({ useGrailStore } = await import('@/stores/grailStore'));
  ({ ItemCard } = await import('./ItemCard'));

  initialStoreState = useGrailStore.getState();
  // Icons disabled so the icon hook settles without calling the Electron API
  useGrailStore.setState({ settings: { ...initialStoreState.settings, showItemIcons: false } });
  renderCounter.itemIconCalls = 0;
});

afterEach(() => {
  useGrailStore.setState(initialStoreState, true);
  vi.doUnmock('@/hooks/useItemIcon');
  vi.doUnmock('/images/placeholder-item.svg');
  vi.resetModules();
});

describe.each(['grid', 'list'] as const)('When an ItemCard is rendered in %s view', (viewMode) => {
  describe('If unrelated grail store state changes', () => {
    it('Then the card does not re-render', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withName('Windforce').build();
      render(<ItemCard item={item} viewMode={viewMode} />);
      const rendersAfterMount = renderCounter.itemIconCalls;

      // Act
      act(() => {
        useGrailStore.setState({
          filter: { foundStatus: 'missing', searchTerm: 'shako' },
          viewMode: viewMode === 'grid' ? 'list' : 'grid',
          groupMode: 'category',
          loading: true,
        });
      });

      // Assert
      expect(screen.getByText('Windforce')).toBeInTheDocument();
      expect(rendersAfterMount).toBeGreaterThan(0);
      expect(renderCounter.itemIconCalls).toBe(rendersAfterMount);
    });
  });

  describe('If the grail settings change', () => {
    it('Then the card re-renders to reflect them', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withName('Windforce').build();
      render(<ItemCard item={item} viewMode={viewMode} />);
      const rendersAfterMount = renderCounter.itemIconCalls;

      // Act
      act(() => {
        const { settings } = useGrailStore.getState();
        useGrailStore.setState({
          settings: { ...settings, grailEthereal: !settings.grailEthereal },
        });
      });

      // Assert
      expect(renderCounter.itemIconCalls).toBeGreaterThan(rendersAfterMount);
    });
  });
});
