import type { Character, GrailProgress, Item } from 'electron/types/grail';
import type { HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useItemIcon } from '@/hooks/useItemIcon';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import placeholderUrl from '/images/placeholder-item.svg';
import { RuneImages } from '../RuneImages';
import { RecentDiscoveryIndicator } from '../StatusIcons';
import { getTooltipTriggerRender } from '../tooltipTriggerRender';
import { getItemSubtitle, type VersionStatus } from './cardState';
import { ItemCategoryLabel } from './ItemCategoryLabel';
import { DiscoveryAttribution, DiscoveryInfo, VersionPills } from './indicators';
import {
  getCardStateClasses,
  getItemNameClasses,
  interactiveCardStyles,
  missingArtworkStyles,
} from './styles';

/**
 * Accessibility and interaction props applied to a clickable item card root element.
 */
export type InteractiveCardProps = Pick<
  HTMLAttributes<HTMLDivElement>,
  'role' | 'tabIndex' | 'aria-label' | 'onClick' | 'onKeyDown' | 'onKeyUp' | 'onBlur'
>;

/**
 * Props shared by the grid and list renderings of an item card.
 */
export interface ItemCardViewProps {
  item: Item;
  isFound: boolean;
  allProgress: GrailProgress[];
  characters: Character[];
  discoveringCharacters: Character[];
  /** Found state per tracked version; empty when only the normal version is tracked */
  versionStatuses: VersionStatus[];
  /** Date of a recent find, shown as a "New" badge; undefined hides the badge */
  recentFindDate: Date | undefined;
  showItemIcons: boolean;
  className: string | undefined;
  interactiveProps?: InteractiveCardProps;
}

/**
 * Props interface for the GridArtwork component.
 */
interface GridArtworkProps {
  item: Item;
  isFound: boolean;
  showItemIcons: boolean;
  focusableTriggers: boolean;
}

/**
 * Renders the item icon or rune images for a grid card, dimmed and grayscale while missing.
 */
function GridArtwork({ item, isFound, showItemIcons, focusableTriggers }: GridArtworkProps) {
  const { iconUrl, isLoading } = useItemIcon(item);

  if (item.type === 'runeword' && item.runes && item.runes.length > 0) {
    return (
      <div
        data-testid="item-artwork"
        className={cn('mx-auto mb-2 flex justify-center', !isFound && missingArtworkStyles)}
      >
        <RuneImages runeIds={item.runes} focusableTriggers={focusableTriggers} />
      </div>
    );
  }

  if (!showItemIcons || item.type === 'runeword') return null;

  return (
    <div
      data-testid="item-artwork"
      className={cn('relative mx-auto mb-2 h-16 w-16', !isFound && missingArtworkStyles)}
    >
      <img
        src={iconUrl}
        alt={item.name}
        className={cn('h-full w-full object-contain', isLoading && 'opacity-0')}
        onError={(e) => {
          // Prevent infinite loops
          if (e.currentTarget.src !== `${window.location.origin}${placeholderUrl}`) {
            e.currentTarget.src = placeholderUrl;
          }
        }}
      />
      {isLoading && <div className="absolute inset-0 animate-pulse rounded bg-muted" />}
    </div>
  );
}

/**
 * GridView component that renders an item as a tile of the grail "collection wall": found items
 * light up in their quality color, missing items stay dim and neutral.
 * When interactive props are provided the card is a focusable button-like element
 * that can be activated with Enter or Space.
 */
export function GridView({
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
  // Tooltip triggers are only taken out of the tab order when the card itself is the focusable button.
  // Trade-off: on clickable cards the tooltip content (category, characters, find dates) is
  // mouse-only by design: nested focusable elements are invalid inside a button, and keyboard and
  // screen reader users reach the same details through the item details dialog the card opens.
  // The found state, the per-version state and the recent find are part of the card's label.
  const focusableTriggers = !interactiveProps;
  const subtitle = getItemSubtitle(item);

  return (
    <div
      {...interactiveProps}
      className={cn(
        'h-fit w-full rounded-lg',
        interactiveProps && interactiveCardStyles,
        className,
      )}
    >
      <Card
        data-found={isFound}
        className={cn(
          'relative gap-0 rounded-lg border py-0',
          getCardStateClasses(item.type, isFound, !!interactiveProps),
        )}
      >
        {recentFindDate && (
          <div className="absolute top-2 right-2 z-10">
            <RecentDiscoveryIndicator
              foundDate={recentFindDate}
              focusableTriggers={focusableTriggers}
            />
          </div>
        )}

        <CardContent className="flex flex-col items-center gap-0.5 p-3 text-center">
          {/* Item Icon or Rune Images */}
          <GridArtwork
            item={item}
            isFound={isFound}
            showItemIcons={showItemIcons}
            focusableTriggers={focusableTriggers}
          />

          {/* Item Name: lit in its quality color when found, muted while missing */}
          <Tooltip>
            <TooltipTrigger
              render={getTooltipTriggerRender(focusableTriggers)}
              // Keeps the name clear of the "New" badge in the top-right corner
              className={cn('block w-full text-center', recentFindDate && 'px-9')}
            >
              <h3
                className={cn(
                  'line-clamp-2 break-words text-sm leading-tight',
                  getItemNameClasses(item.type, isFound),
                )}
              >
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

                {allProgress.length > 0 && (
                  <DiscoveryInfo allProgress={allProgress} characters={characters} />
                )}
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Base item */}
          {subtitle && <p className="w-full truncate text-muted-foreground text-xs">{subtitle}</p>}

          {/* Set specific info */}
          {item.setName && (
            <p className="w-full truncate text-muted-foreground text-xs">
              {t(translations.grail.itemCard.setName, { name: item.setName })}
            </p>
          )}

          {/* Found state per tracked version */}
          <VersionPills item={item} versionStatuses={versionStatuses} className="pt-2" />

          {/* Discovery attribution */}
          {allProgress.length > 0 && (
            <DiscoveryAttribution
              discoveringCharacters={discoveringCharacters}
              item={item}
              focusableTriggers={focusableTriggers}
              className="pt-2"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
