import type { Character, GrailProgress, Item } from 'electron/types/grail';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useItemIcon } from '@/hooks/useItemIcon';
import { cn } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';
import placeholderUrl from '/images/placeholder-item.png';
import { RuneImages } from '../RuneImages';
import { ItemTypeIcon } from '../StatusIcons';
import { getTooltipTriggerRender } from '../tooltipTriggerRender';
import type { InteractiveCardProps } from './GridView';
import { DiscoveryAttribution, DiscoveryInfo, StatusIndicators, VersionCounts } from './indicators';
import { getCardStateClasses, interactiveCardStyles, missingArtworkStyles } from './styles';

/**
 * Props interface for the ListView component.
 */
export interface ListViewProps {
  item: Item;
  allProgress: GrailProgress[];
  characters: Character[];
  normalProgress: GrailProgress[];
  etherealProgress: GrailProgress[];
  discoveringCharacters: Character[];
  mostRecentDiscovery: GrailProgress | undefined;
  className: string | undefined;
  interactiveProps?: InteractiveCardProps;
  withoutStatusIndicators?: boolean;
}

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
 * Renders the item icon, rune images or type icon for a list row.
 * Artwork is dimmed and grayscale while the item is missing.
 */
function ListArtwork({ item, isFound, showItemIcons, focusableTriggers }: ListArtworkProps) {
  const { iconUrl, isLoading } = useItemIcon(item);

  if (item.type === 'runeword' && item.runes && item.runes.length > 0) {
    return (
      <div className="relative flex-shrink-0">
        <div data-testid="item-artwork" className={cn(!isFound && missingArtworkStyles)}>
          <RuneImages runeIds={item.runes} viewMode="list" focusableTriggers={focusableTriggers} />
        </div>
        <ItemTypeIcon type={item.type} className="-right-2 -bottom-1 absolute h-4 w-4" />
      </div>
    );
  }

  if (!showItemIcons || item.type === 'runeword') {
    return <ItemTypeIcon type={item.type} className="h-6 w-6 flex-shrink-0" />;
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
      <ItemTypeIcon type={item.type} className="absolute right-0 bottom-0 h-4 w-4" />
    </div>
  );
}

/**
 * ListView component that renders an item in list view mode.
 * When interactive props are provided the row is a focusable button-like element
 * that can be activated with Enter or Space.
 */
export function ListView({
  item,
  allProgress,
  characters,
  normalProgress,
  etherealProgress,
  discoveringCharacters,
  mostRecentDiscovery,
  className,
  interactiveProps,
  withoutStatusIndicators = false,
}: ListViewProps) {
  // Only subscribe to settings so unrelated store updates (filters, progress of other items, ...)
  // don't re-render every row
  const settings = useGrailStore((state) => state.settings);
  const isFound = allProgress.length > 0;
  // Tooltip triggers are only taken out of the tab order when the row itself is the focusable button.
  // Trade-off: on clickable cards the tooltip content (name, status, character, recent find) is
  // mouse-only by design: nested focusable elements are invalid inside a button, and keyboard and
  // screen reader users reach the same details through the item details dialog the card opens.
  const focusableTriggers = !interactiveProps;

  return (
    <div
      {...interactiveProps}
      data-found={isFound}
      className={cn(
        'relative flex w-full items-center gap-3 p-3 transition-all duration-200',
        'rounded-lg border-2',
        getCardStateClasses(item.type, isFound),
        interactiveProps && interactiveCardStyles,
        className,
      )}
    >
      {/* Item Icon, Rune Images, or Type Icon */}
      <ListArtwork
        item={item}
        isFound={isFound}
        showItemIcons={settings.showItemIcons}
        focusableTriggers={focusableTriggers}
      />

      {/* Status indicators */}
      {!withoutStatusIndicators && (
        <StatusIndicators
          mostRecentDiscovery={mostRecentDiscovery}
          item={item}
          normalProgress={normalProgress}
          etherealProgress={etherealProgress}
          settings={settings}
          focusableTriggers={focusableTriggers}
        />
      )}

      {/* Item Name (always full contrast, regardless of found state) */}
      <Tooltip>
        <TooltipTrigger
          render={getTooltipTriggerRender(focusableTriggers)}
          className="block flex-1 truncate text-left"
        >
          <h3 className="truncate font-semibold text-foreground text-sm">{item.name}</h3>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          <div className="space-y-1">
            <p className="font-semibold">
              {item.name}
              {item.itemBase && ` • ${item.itemBase}`}
            </p>
            <p className="text-muted-foreground text-xs">
              {item.category} • {item.subCategory.replace('_', ' ')}
            </p>

            <DiscoveryInfo allProgress={allProgress} characters={characters} />
          </div>
        </TooltipContent>
      </Tooltip>

      {/* Character attribution */}
      {allProgress.length > 0 && (
        <DiscoveryAttribution
          discoveringCharacters={discoveringCharacters}
          item={item}
          focusableTriggers={focusableTriggers}
        />
      )}

      {/* Version counts */}
      <VersionCounts
        item={item}
        normalProgress={normalProgress}
        etherealProgress={etherealProgress}
        settings={settings}
      />
    </div>
  );
}
