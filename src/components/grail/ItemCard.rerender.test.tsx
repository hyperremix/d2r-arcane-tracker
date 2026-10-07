import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HolyGrailItemBuilder } from '@/fixtures';
import { useGrailStore } from '@/stores/grailStore';
import { ItemCard } from './ItemCard';

// Counts renders of the card artwork (GridArtwork / ListArtwork call useItemIcon on every render)
const renderCounter = vi.hoisted(() => ({ itemIconCalls: 0 }));

vi.mock('@/hooks/useItemIcon', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useItemIcon')>();
  return {
    ...actual,
    useItemIcon: (...args: Parameters<typeof actual.useItemIcon>) => {
      renderCounter.itemIconCalls++;
      return actual.useItemIcon(...args);
    },
  };
});
vi.mock('/images/placeholder-item.png', () => ({ default: '/mock-placeholder.png' }));

const initialStoreState = useGrailStore.getState();

beforeEach(() => {
  useGrailStore.setState(initialStoreState, true);
  // Icons disabled so the icon hook settles without calling the Electron API
  useGrailStore.setState({ settings: { ...initialStoreState.settings, showItemIcons: false } });
  renderCounter.itemIconCalls = 0;
});

afterEach(() => {
  useGrailStore.setState(initialStoreState, true);
});

describe.each(['grid', 'list'] as const)('When an ItemCard is rendered in %s view', (viewMode) => {
  describe('If unrelated grail store state changes', () => {
    it('Then the card does not re-render', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withName('Windforce').build();
      render(<ItemCard item={item} viewMode={viewMode} />);
      expect(screen.getByText('Windforce')).toBeInTheDocument();
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
