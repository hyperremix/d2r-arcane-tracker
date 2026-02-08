import type { Character, GrailProgress, Item } from 'electron/types/grail';
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
import { DiscoveryAttribution, DiscoveryInfo, StatusIndicators, VersionCounts } from './indicators';
import { typeColors } from './styles';

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
  handleKeyDown: (event: React.KeyboardEvent) => void;
  onClick?: () => void;
  withoutStatusIndicators?: boolean;
}

/**
 * GridView component that renders an item in grid view mode.
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
  handleKeyDown,
  onClick,
  withoutStatusIndicators = false,
}: GridViewProps) {
  const { t } = useTranslation();
  const { iconUrl, isLoading } = useItemIcon(item);
  const { settings } = useGrailStore();

  return (
    <TooltipProvider>
      {/** biome-ignore lint/a11y/noStaticElementInteractions: explanation */}
      <div
        className={cn(
          'h-fit w-full rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg',
          className,
        )}
        onClick={onClick}
        onKeyDown={handleKeyDown}
      >
        <Card
          className={cn(
            'relative border-2',
            typeColors[item.type],
            allProgress.length > 0 ? '' : 'bg-gray-50 opacity-60 hover:opacity-80 dark:bg-gray-950',
          )}
        >
          {/* Status indicators overlay */}
          {!withoutStatusIndicators && (
            <StatusIndicators
              mostRecentDiscovery={mostRecentDiscovery}
              item={item}
              normalProgress={normalProgress}
              etherealProgress={etherealProgress}
              settings={settings}
            />
          )}

          <CardContent className="p-3">
            {/* Item Type Badge */}
            <ItemTypeIcon type={item.type} className="absolute top-2 left-2" />

            {/* Item Icon or Rune Images */}
            {item.type === 'runeword' && item.runes && item.runes.length > 0 ? (
              <div className="mx-auto mb-2 flex justify-center">
                <RuneImages runeIds={item.runes} />
              </div>
            ) : settings.showItemIcons && item.type !== 'runeword' ? (
              <div className="relative mx-auto mb-2 h-16 w-16">
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
                {isLoading && (
                  <div className="absolute inset-0 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                )}
              </div>
            ) : null}

            {/* Item Name */}
            <Tooltip>
              <TooltipTrigger className="w-full text-center">
                <h3 className="truncate font-semibold text-black text-sm leading-tight dark:text-white">
                  {item.name}
                </h3>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm">
                <div className="space-y-1">
                  <p className="font-semibold">
                    {item.name}
                    {item.itemBase && ` • ${item.itemBase}`}
                  </p>
                  <p className="text-gray-500 text-xs">
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
              <p className="truncate text-center font-medium text-green-600 text-xs dark:text-green-400">
                {t(translations.grail.itemCard.setName, { name: item.setName })}
              </p>
            )}

            {/* Discovery attribution */}
            {allProgress.length > 0 && (
              <DiscoveryAttribution discoveringCharacters={discoveringCharacters} item={item} />
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
