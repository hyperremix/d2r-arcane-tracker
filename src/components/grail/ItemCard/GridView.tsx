import type { Character, GrailProgress, Item, ItemIconSize } from 'electron/types/grail';
import type { HTMLAttributes } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useItemIcon } from '@/hooks/useItemIcon';
import { ITEM_ICON_PIXELS } from '@/lib/itemIconSize';
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
  /** Size preset of the item icon */
  iconSize: ItemIconSize;
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
  iconSize: ItemIconSize;
  focusableTriggers: boolean;
}

/**
 * Props interface for the GridRuneArtwork component.
 */
interface GridRuneArtworkProps {
  runeIds: string[];
  isFound: boolean;
  /** Height of the artwork slot in pixels */
  height: number;
  focusableTriggers: boolean;
}

/**
 * Renders the runes of a runeword in the artwork slot of a grid card, dimmed and grayscale while
 * missing.
 */
function GridRuneArtwork({ runeIds, isFound, height, focusableTriggers }: GridRuneArtworkProps) {
  // Up to three runes sit in one centered row. Longer runewords wrap into two rows of three:
  // smaller runes (34px high) sit at the bottom of the slot (at least 40px), so its top 6px
  // stay free. The corner "New" badge (12px high at the card's top edge) ends 13px below the
  // card top, the slot starts 9px and the top rune row 15px below it, so the rune rows clear it.
  // The compact tile of a missing runeword keeps all runes in one row of 16px runes, which fits
  // its smallest slot (16px) and up to six runes in the narrowest column.
  const isOneRow = !isFound || runeIds.length <= 3;
  return (
    <div
      data-testid="item-artwork"
      className={cn(
        'flex justify-center',
        isOneRow ? 'items-center' : 'items-end',
        !isFound && missingArtworkStyles,
      )}
      style={{ height }}
    >
      <RuneImages
        runeIds={runeIds}
        viewMode={isOneRow ? 'list' : 'grid'}
        className={cn('gap-0.5', isFound && isOneRow ? '[&_img]:size-[18px]' : '[&_img]:size-4')}
        focusableTriggers={focusableTriggers}
      />
    </div>
  );
}

/**
 * Renders the item icon or rune images for a grid card, dimmed and grayscale while missing.
 * The artwork slot is as high as the icon size preset (the smaller compact icon while missing),
 * also when it is empty, so every tile of the same state is equally tall.
 */
function GridArtwork({
  item,
  isFound,
  showItemIcons,
  iconSize,
  focusableTriggers,
}: GridArtworkProps) {
  const { iconUrl, isLoading } = useItemIcon(item);
  const iconPixels = ITEM_ICON_PIXELS[iconSize][isFound ? 'grid' : 'missingGrid'];

  if (item.type === 'runeword' && item.runes && item.runes.length > 0) {
    return (
      <GridRuneArtwork
        runeIds={item.runes}
        isFound={isFound}
        height={iconPixels}
        focusableTriggers={focusableTriggers}
      />
    );
  }

  if (!showItemIcons || item.type === 'runeword') {
    return <div aria-hidden="true" style={{ height: iconPixels }} />;
  }

  // In the narrowest columns the extra large icon is wider than the tile, so it shrinks to fit
  return (
    <div
      data-testid="item-artwork"
      className={cn('relative mx-auto max-w-full', !isFound && missingArtworkStyles)}
      style={{ width: iconPixels, height: iconPixels }}
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
 * neutral with a faint quality edge. A found tile shows the artwork, the name (up to two lines),
 * one truncated line with the set name or base item and, while ethereal tracking is on, the
 * version pills. A missing tile is about half as high: a smaller icon, tighter padding and the
 * name on one truncated line, so more of what is left fits on screen. Who found the item and
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
  iconSize,
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
        {/* Corner tab flush right and at the top edge, 12px high. The wrapper is a flex container so
            the inline-flex tooltip trigger does not sit in a line box with a 24px strut. */}
        {recentFindDate && (
          <div data-testid="recent-badge-slot" className="absolute top-0 right-0 z-10 flex">
            <RecentDiscoveryIndicator
              className="rounded-none rounded-bl-md px-1 text-[0.625rem] leading-3 tracking-normal"
              focusableTriggers={focusableTriggers}
            />
          </div>
        )}

        {/* Every row has a fixed height, so all tiles of the same state are equally tall and the rows
            line up */}
        <CardContent
          className={cn('flex flex-col items-center text-center', isFound ? 'p-2' : 'p-1.5')}
        >
          {/* Item Icon or Rune Images */}
          <GridArtwork
            item={item}
            isFound={isFound}
            showItemIcons={showItemIcons}
            iconSize={iconSize}
            focusableTriggers={focusableTriggers}
          />

          {/* Item Name: lit in its quality color when found, muted on one line while missing */}
          <Tooltip>
            <TooltipTrigger
              render={getTooltipTriggerRender(focusableTriggers)}
              className={cn('block w-full text-center', isFound ? 'mt-1.5' : 'mt-1')}
            >
              <h3
                className={cn(
                  'text-xs leading-4',
                  isFound ? 'line-clamp-2 h-8 break-words' : 'h-4 truncate',
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
