import type { Character, GrailProgress, Item } from 'electron/types/grail';
import type { HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useItemIcon } from '@/hooks/useItemIcon';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';
import placeholderUrl from '/images/placeholder-item.png';
import { RuneImages } from '../RuneImages';
import { ItemTypeIcon } from '../StatusIcons';
import { getTooltipTriggerRender } from '../tooltipTriggerRender';
import { DiscoveryAttribution, DiscoveryInfo, StatusIndicators, VersionCounts } from './indicators';
import { getCardStateClasses, interactiveCardStyles, missingArtworkStyles } from './styles';

/**
 * Accessibility and interaction props applied to a clickable item card root element.
 */
export type InteractiveCardProps = Pick<
  HTMLAttributes<HTMLDivElement>,
  'role' | 'tabIndex' | 'aria-label' | 'onClick' | 'onKeyDown' | 'onKeyUp' | 'onBlur'
>;

/**
 * Props interface for the GridView component.
 */
export interface GridViewProps {
  item: Item;
  allProgress: GrailProgress[];
  characters: Character[];
  discoveringCharacters: Character[];
  normalProgress: GrailProgress[];
  etherealProgress: GrailProgress[];
  mostRecentDiscovery: GrailProgress | undefined;
  className: string | undefined;
  interactiveProps?: InteractiveCardProps;
  withoutStatusIndicators?: boolean;
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
 * GridView component that renders an item in grid view mode.
 * When interactive props are provided the card is a focusable button-like element
 * that can be activated with Enter or Space.
 */
export function GridView({
  item,
  allProgress,
  characters,
  discoveringCharacters,
  normalProgress,
  etherealProgress,
  mostRecentDiscovery,
  className,
  interactiveProps,
  withoutStatusIndicators = false,
}: GridViewProps) {
  const { t } = useTranslation();
  const { settings } = useGrailStore();
  const isFound = allProgress.length > 0;
  // Tooltip triggers are only taken out of the tab order when the card itself is the focusable button.
  // Trade-off: on clickable cards the tooltip content (name, status, character, recent find) is
  // mouse-only by design: nested focusable elements are invalid inside a button, and keyboard and
  // screen reader users reach the same details through the item details dialog the card opens.
  const focusableTriggers = !interactiveProps;

  return (
    <TooltipProvider>
      <div
        {...interactiveProps}
        className={cn(
          'h-fit w-full rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg',
          interactiveProps && interactiveCardStyles,
          className,
        )}
      >
        <Card
          data-found={isFound}
          className={cn('relative border-2', getCardStateClasses(item.type, isFound))}
        >
          {/* Status indicators overlay */}
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

          <CardContent className="p-3">
            {/* Item Type Badge */}
            <ItemTypeIcon type={item.type} className="absolute top-2 left-2" />

            {/* Item Icon or Rune Images */}
            <GridArtwork
              item={item}
              isFound={isFound}
              showItemIcons={settings.showItemIcons}
              focusableTriggers={focusableTriggers}
            />

            {/* Item Name (always full contrast, regardless of found state) */}
            <Tooltip>
              <TooltipTrigger
                render={getTooltipTriggerRender(focusableTriggers)}
                className="block w-full text-center"
              >
                <h3 className="truncate font-semibold text-foreground text-sm leading-tight">
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
                    {item.category} • {item.subCategory.replace('_', ' ')}
                  </p>

                  {allProgress.length > 0 && (
                    <DiscoveryInfo allProgress={allProgress} characters={characters} />
                  )}
                </div>
              </TooltipContent>
            </Tooltip>

            {/* Set specific info */}
            {item.setName && (
              <p className="truncate text-center font-medium text-item-set text-xs">
                {t(translations.grail.itemCard.setName, { name: item.setName })}
              </p>
            )}

            {/* Discovery attribution */}
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
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
