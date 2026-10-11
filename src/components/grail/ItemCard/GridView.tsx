import type { Character, GrailProgress, Item } from 'electron/types/grail';
import type { HTMLAttributes } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useItemIcon } from '@/hooks/useItemIcon';
import { cn } from '@/lib/utils';
import { RuneImages } from '../RuneImages';
import { RecentDiscoveryIndicator } from '../StatusIcons';
import { getTooltipTriggerRender } from '../tooltipTriggerRender';
import { getGridSubtitle, type VersionStatus } from './cardState';
import { VersionPills } from './indicators';
import { CardStatusText, handleArtworkError, ItemTooltipBody } from './shared';
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
  /** Found state per tracked version; empty when only the normal version is tracked */
  versionStatuses: VersionStatus[];
  /** Date of a recent find, shown as a "New" badge; undefined hides the badge */
  recentFindDate: Date | undefined;
  showItemIcons: boolean;
  className: string | undefined;
  interactiveProps?: InteractiveCardProps;
}

/**
 * Props of the grid tile.
 */
export interface GridViewProps extends ItemCardViewProps {
  /**
   * Reserves the version pill row on every tile while ethereal tracking is on, so tiles with and
   * without pills are equally tall and the rows of the wall line up.
   */
  reserveVersionRow?: boolean;
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
 * The artwork slot has a fixed height, also when it is empty, so every tile is equally tall.
 */
function GridArtwork({ item, isFound, showItemIcons, focusableTriggers }: GridArtworkProps) {
  const { iconUrl, isLoading } = useItemIcon(item);

  if (item.type === 'runeword' && item.runes && item.runes.length > 0) {
    return (
      <div
        data-testid="item-artwork"
        className={cn('flex h-10 items-center justify-center', !isFound && missingArtworkStyles)}
      >
        {/* Up to three runes sit in one row, longer runewords wrap into two rows of three */}
        <RuneImages
          runeIds={item.runes}
          viewMode={item.runes.length <= 3 ? 'list' : 'grid'}
          className="gap-0.5 [&_img]:size-[18px]"
          focusableTriggers={focusableTriggers}
        />
      </div>
    );
  }

  if (!showItemIcons || item.type === 'runeword') {
    return <div aria-hidden="true" className="h-10" />;
  }

  return (
    <div
      data-testid="item-artwork"
      className={cn('relative mx-auto size-10', !isFound && missingArtworkStyles)}
    >
      <img
        src={iconUrl}
        alt={item.name}
        className={cn('h-full w-full object-contain', isLoading && 'opacity-0')}
        onError={handleArtworkError}
      />
      {isLoading && <div className="absolute inset-0 animate-pulse rounded bg-muted" />}
    </div>
  );
}

/**
 * GridView component that renders an item as a compact, fixed-height tile of the grail
 * "collection wall": found items light up in their quality color, missing items stay dim and
 * neutral. A tile shows the artwork, the name (up to two lines), one truncated line with the set
 * name or base item and, while ethereal tracking is on, the version pills. Who found the item and
 * when is shown in the name tooltip and the item details dialog.
 * When interactive props are provided the card is a focusable button-like element
 * that can be activated with Enter or Space.
 */
export function GridView({
  item,
  isFound,
  allProgress,
  characters,
  versionStatuses,
  recentFindDate,
  showItemIcons,
  reserveVersionRow = false,
  className,
  interactiveProps,
}: GridViewProps) {
  // Tooltip triggers are only taken out of the tab order when the card itself is the focusable button.
  // Trade-off: on clickable cards the tooltip content (category, characters, find dates) is
  // mouse-only by design: nested focusable elements are invalid inside a button, and keyboard and
  // screen reader users reach the same details through the item details dialog the card opens.
  // The found state, the per-version state and the recent find are part of the card's label.
  const focusableTriggers = !interactiveProps;
  const subtitle = getGridSubtitle(item);
  // Clickable cards are named by their aria-label and version pills carry their own status text
  const showStatusText = !interactiveProps && versionStatuses.length === 0;

  return (
    <div
      {...interactiveProps}
      className={cn('w-full rounded-lg', interactiveProps && interactiveCardStyles, className)}
    >
      <Card
        data-found={isFound}
        className={cn(
          'relative gap-0 overflow-hidden rounded-lg border py-0',
          getCardStateClasses(item.type, isFound, !!interactiveProps),
        )}
      >
        {recentFindDate && (
          <div className="absolute top-1 right-1 z-10">
            <RecentDiscoveryIndicator focusableTriggers={focusableTriggers} />
          </div>
        )}

        {/* Every row has a fixed height, so all tiles are equally tall and the rows line up */}
        <CardContent className="flex flex-col items-center p-2 text-center">
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
              className="mt-1.5 block w-full text-center"
            >
              <h3
                className={cn(
                  'line-clamp-2 h-8 break-words text-xs leading-4',
                  getItemNameClasses(item.type, isFound),
                )}
              >
                {item.name}
              </h3>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-sm">
              <ItemTooltipBody
                item={item}
                allProgress={allProgress}
                characters={characters}
                showSetName
              />
            </TooltipContent>
          </Tooltip>

          {/* Set name or base item on one truncated line; the full text is in the tooltip */}
          <p className="h-4 w-full truncate text-[0.6875rem] text-muted-foreground leading-4">
            {subtitle}
          </p>

          {/* Found state per tracked version; the row stays reserved on items without pills */}
          {reserveVersionRow && (
            <div data-testid="version-row" className="mt-1.5 h-[18px] w-full">
              <VersionPills item={item} versionStatuses={versionStatuses} compact />
            </div>
          )}
          {showStatusText && <CardStatusText isFound={isFound} />}
        </CardContent>
      </Card>
    </div>
  );
}
