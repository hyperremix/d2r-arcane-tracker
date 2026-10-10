import type { Item } from 'electron/types/grail';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useItemIcon } from '@/hooks/useItemIcon';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import placeholderUrl from '/images/placeholder-item.svg';
import { RuneImages } from '../RuneImages';
import { ItemTypeIcon, RecentDiscoveryIndicator } from '../StatusIcons';
import { getTooltipTriggerRender } from '../tooltipTriggerRender';
import { getItemSubtitle } from './cardState';
import type { ItemCardViewProps } from './GridView';
import { ItemCategoryLabel } from './ItemCategoryLabel';
import { DiscoveryAttribution, DiscoveryInfo, VersionPills } from './indicators';
import {
  getCardStateClasses,
  getItemNameClasses,
  interactiveCardStyles,
  missingArtworkStyles,
} from './styles';

/**
 * Props interface for the ListArtwork component.
 */
interface ListArtworkProps {
  item: Item;
  isFound: boolean;
  showItemIcons: boolean;
  focusableTriggers: boolean;
}

/**
 * Renders the item icon, rune images or, when item icons are off, the type icon for a list row.
 * Artwork is dimmed and grayscale while the item is missing.
 */
function ListArtwork({ item, isFound, showItemIcons, focusableTriggers }: ListArtworkProps) {
  const { iconUrl, isLoading } = useItemIcon(item);

  if (item.type === 'runeword' && item.runes && item.runes.length > 0) {
    return (
      <div
        data-testid="item-artwork"
        className={cn('flex-shrink-0', !isFound && missingArtworkStyles)}
      >
        <RuneImages runeIds={item.runes} viewMode="list" focusableTriggers={focusableTriggers} />
      </div>
    );
  }

  if (!showItemIcons || item.type === 'runeword') {
    return (
      <div className={cn('flex-shrink-0', !isFound && missingArtworkStyles)}>
        <ItemTypeIcon type={item.type} className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="relative h-12 w-12 flex-shrink-0">
      <div
        data-testid="item-artwork"
        className={cn('h-full w-full', !isFound && missingArtworkStyles)}
      >
        <img
          src={iconUrl}
          alt={item.name}
          className={cn(isLoading && 'opacity-0', 'h-full w-full object-contain')}
          onError={(e) => {
            // Prevent infinite loops
            if (e.currentTarget.src !== `${window.location.origin}${placeholderUrl}`) {
              e.currentTarget.src = placeholderUrl;
            }
          }}
        />
      </div>
      {isLoading && <div className="absolute inset-0 animate-pulse rounded bg-muted" />}
    </div>
  );
}

/**
 * ListView component that renders an item in list view mode, using the same found / missing
 * language as the grid: lit in its quality color when found, dim and neutral while missing.
 * When interactive props are provided the row is a focusable button-like element
 * that can be activated with Enter or Space.
 */
export function ListView({
  item,
  isFound,
  allProgress,
  characters,
  discoveringCharacters,
  versionStatuses,
  recentFindDate,
  showItemIcons,
  className,
  interactiveProps,
}: ItemCardViewProps) {
  const { t } = useTranslation();
  // Tooltip triggers are only taken out of the tab order when the row itself is the focusable button.
  // Trade-off: on clickable rows the tooltip content (category, characters, find dates) is
  // mouse-only by design: nested focusable elements are invalid inside a button, and keyboard and
  // screen reader users reach the same details through the item details dialog the row opens.
  // The found state, the per-version state and the recent find are part of the row's label.
  const focusableTriggers = !interactiveProps;
  const subtitle = [
    getItemSubtitle(item),
    item.setName && t(translations.grail.itemCard.setName, { name: item.setName }),
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div
      {...interactiveProps}
      data-found={isFound}
      className={cn(
        'relative flex w-full items-center gap-3 p-3',
        'rounded-lg border',
        getCardStateClasses(item.type, isFound, !!interactiveProps),
        interactiveProps && interactiveCardStyles,
        className,
      )}
    >
      {/* Item Icon, Rune Images, or Type Icon */}
      <ListArtwork
        item={item}
        isFound={isFound}
        showItemIcons={showItemIcons}
        focusableTriggers={focusableTriggers}
      />

      {/* Item Name (lit when found, muted while missing) and base item / set */}
      <div className="min-w-0 flex-1">
        <Tooltip>
          <TooltipTrigger
            render={getTooltipTriggerRender(focusableTriggers)}
            className="block max-w-full truncate text-left"
          >
            <h3 className={cn('truncate text-sm', getItemNameClasses(item.type, isFound))}>
              {item.name}
            </h3>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm">
            <div className="space-y-1">
              <p className="font-semibold">
                {item.name}
                {item.itemBase && ` • ${item.itemBase}`}
              </p>
              <p className="text-muted-foreground text-xs">
                <ItemCategoryLabel item={item} />
              </p>

              <DiscoveryInfo allProgress={allProgress} characters={characters} />
            </div>
          </TooltipContent>
        </Tooltip>
        {subtitle && <p className="truncate text-muted-foreground text-xs">{subtitle}</p>}
      </div>

      {/* Recent find */}
      {recentFindDate && (
        <RecentDiscoveryIndicator
          foundDate={recentFindDate}
          focusableTriggers={focusableTriggers}
        />
      )}

      {/* Found state per tracked version */}
      <VersionPills item={item} versionStatuses={versionStatuses} className="flex-nowrap" />

      {/* Character attribution */}
      {allProgress.length > 0 && (
        <DiscoveryAttribution
          discoveringCharacters={discoveringCharacters}
          item={item}
          focusableTriggers={focusableTriggers}
        />
      )}
    </div>
  );
}
