import type { Character, GrailProgress, Item } from 'electron/types/grail';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';
import { GridView, type InteractiveCardProps } from './GridView';
import { ListView } from './ListView';

/**
 * Extracts discovery metadata from normal and ethereal progress arrays.
 */
function getDiscoveryMetadata(normalProgress: GrailProgress[], etherealProgress: GrailProgress[]) {
  const allProgress = [...normalProgress, ...etherealProgress];
  const discoveryCount = allProgress.length;
  const mostRecentDiscovery = [...allProgress].sort(
    (a, b) => new Date(b.foundDate || 0).getTime() - new Date(a.foundDate || 0).getTime(),
  )[0];

  return { allProgress, discoveryCount, mostRecentDiscovery };
}

/**
 * Gets deduplicated list of characters who discovered versions of an item.
 */
function getDiscoveringCharacters(allProgress: GrailProgress[], characters: Character[]) {
  const uniqueCharacterIds = new Set(allProgress.map((p) => p.characterId));
  return Array.from(uniqueCharacterIds)
    .map((characterId) => characters.find((c) => c.id === characterId))
    .filter(Boolean) as Character[];
}

/**
 * Props interface for the ItemCard component.
 */
interface ItemCardProps {
  item: Item;
  normalProgress?: GrailProgress[]; // Progress for normal version
  etherealProgress?: GrailProgress[]; // Progress for ethereal version
  characters?: Character[];
  onClick?: () => void;
  className?: string;
  viewMode?: 'grid' | 'list';
  withoutStatusIndicators?: boolean;
}

export { typeBorderColors } from './styles';

/**
 * ItemCard component that displays a Holy Grail item with its discovery status and information.
 * Supports both grid and list view modes, showing progress, character attribution, and version counts.
 */
export const ItemCard = memo(function ItemCard({
  item,
  normalProgress = [],
  etherealProgress = [],
  characters = [],
  onClick,
  className,
  viewMode = 'grid',
  withoutStatusIndicators = false,
}: ItemCardProps) {
  const { t } = useTranslation();

  // Calculate discovery metadata for both normal and ethereal versions
  const { allProgress, mostRecentDiscovery } = getDiscoveryMetadata(
    normalProgress,
    etherealProgress,
  );

  // Get character info for discoveries from both versions
  const discoveringCharacters = getDiscoveringCharacters(allProgress, characters);

  // Handle keyboard events for accessibility
  const handleKeyDown = (event: React.KeyboardEvent) => {
    // Only react to keys pressed on the card itself, not bubbling from nested elements
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  };

  // Clickable cards are focusable buttons named after the item and its found status
  const interactiveProps: InteractiveCardProps | undefined = onClick
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-label': t(translations.grail.itemCard.cardLabel, {
          name: item.name,
          status: t(
            allProgress.length > 0 ? translations.common.found : translations.common.notFound,
          ),
        }),
        onClick,
        onKeyDown: handleKeyDown,
      }
    : undefined;

  // Render list view if viewMode is 'list'
  if (viewMode === 'list') {
    return (
      <ListView
        item={item}
        allProgress={allProgress}
        characters={characters}
        normalProgress={normalProgress}
        etherealProgress={etherealProgress}
        discoveringCharacters={discoveringCharacters}
        mostRecentDiscovery={mostRecentDiscovery}
        className={className}
        interactiveProps={interactiveProps}
        withoutStatusIndicators={withoutStatusIndicators}
      />
    );
  }

  // Default grid view
  return (
    <GridView
      item={item}
      allProgress={allProgress}
      characters={characters}
      discoveringCharacters={discoveringCharacters}
      normalProgress={normalProgress}
      etherealProgress={etherealProgress}
      mostRecentDiscovery={mostRecentDiscovery}
      className={className}
      interactiveProps={interactiveProps}
      withoutStatusIndicators={withoutStatusIndicators}
    />
  );
});
