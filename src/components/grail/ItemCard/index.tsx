import type { Character, GrailProgress, Item } from 'electron/types/grail';
import { memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';
import { useGrailStore } from '@/stores/grailStore';
import { getCardStatusLabel, getRecentFindDate, getTrackedVersionStatuses } from './cardState';
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

/**
 * ItemCard component that displays a Holy Grail item with its discovery status and information.
 * Supports both grid and list view modes. Found items light up in their quality color, missing
 * items stay dim and neutral; when ethereal tracking applies, one pill per tracked version shows
 * which versions are still missing.
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
  // Only subscribe to settings so unrelated store updates (filters, progress of other items, ...)
  // don't re-render every card
  const settings = useGrailStore((state) => state.settings);

  // Calculate discovery metadata for both normal and ethereal versions
  const { allProgress, mostRecentDiscovery } = getDiscoveryMetadata(
    normalProgress,
    etherealProgress,
  );
  const isFound = allProgress.length > 0;
  const versionStatuses = getTrackedVersionStatuses(
    item,
    settings,
    normalProgress,
    etherealProgress,
  );
  const recentFindDate = getRecentFindDate(mostRecentDiscovery);

  // Get character info for discoveries from both versions
  const discoveringCharacters = getDiscoveringCharacters(allProgress, characters);

  // Tracks a Space keydown that started on the card so a stray keyup does not activate it
  const spacePressedRef = useRef(false);

  // Mirror native button activation: Enter activates on keydown, Space on keyup.
  // Only react to keys pressed on the card itself, not bubbling from nested elements.
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      onClick?.();
    } else if (event.key === ' ') {
      // Prevent page scroll; activation happens on keyup
      event.preventDefault();
      spacePressedRef.current = true;
    }
  };

  const handleKeyUp = (event: React.KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === ' ') {
      event.preventDefault();
      if (!spacePressedRef.current) return;
      spacePressedRef.current = false;
      onClick?.();
    }
  };

  const handleBlur = () => {
    spacePressedRef.current = false;
  };

  // Clickable cards are focusable buttons named after the item, the found state of each tracked
  // version and whether it was found recently
  const interactiveProps: InteractiveCardProps | undefined = onClick
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-label': t(translations.grail.itemCard.cardLabel, {
          name: item.name,
          status: getCardStatusLabel(
            isFound,
            versionStatuses,
            !withoutStatusIndicators && recentFindDate !== undefined,
            t,
          ),
        }),
        onClick,
        onKeyDown: handleKeyDown,
        onKeyUp: handleKeyUp,
        onBlur: handleBlur,
      }
    : undefined;

  const View = viewMode === 'list' ? ListView : GridView;

  return (
    <View
      item={item}
      isFound={isFound}
      allProgress={allProgress}
      characters={characters}
      discoveringCharacters={discoveringCharacters}
      versionStatuses={versionStatuses}
      recentFindDate={withoutStatusIndicators ? undefined : recentFindDate}
      showItemIcons={settings.showItemIcons}
      className={className}
      interactiveProps={interactiveProps}
    />
  );
});
