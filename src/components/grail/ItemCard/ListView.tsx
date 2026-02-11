import type { Character, GrailProgress, Item } from 'electron/types/grail';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useItemIcon } from '@/hooks/useItemIcon';
import { cn } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';
import placeholderUrl from '/images/placeholder-item.png';
import { RuneImages } from '../RuneImages';
import { ItemTypeIcon } from '../StatusIcons';
import { DiscoveryAttribution, DiscoveryInfo, StatusIndicators, VersionCounts } from './indicators';
import { typeColors } from './styles';

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
  handleKeyDown: (event: React.KeyboardEvent) => void;
  onClick?: () => void;
  withoutStatusIndicators?: boolean;
}

/**
 * ListView component that renders an item in list view mode.
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
  handleKeyDown,
  onClick,
  withoutStatusIndicators = false,
}: ListViewProps) {
  const { iconUrl, isLoading } = useItemIcon(item);
  const { settings } = useGrailStore();

  return (
    <TooltipProvider>
      {/** biome-ignore lint/a11y/noStaticElementInteractions: explanation */}
      <div
        className={cn(
          'relative flex w-full items-center gap-3 p-3 transition-all duration-200',
          'rounded-lg border-2',
          typeColors[item.type],
          allProgress.length > 0 ? '' : 'bg-gray-50 opacity-60 hover:opacity-80 dark:bg-gray-950',
          className,
        )}
        onClick={onClick}
        onKeyDown={handleKeyDown}
      >
        {/* Item Icon, Rune Images, or Type Icon */}
        {item.type === 'runeword' && item.runes && item.runes.length > 0 ? (
          <div className="relative flex-shrink-0">
            <RuneImages runeIds={item.runes} viewMode="list" />
            <ItemTypeIcon type={item.type} className="absolute -right-2 -bottom-1 h-4 w-4" />
          </div>
        ) : settings.showItemIcons && item.type !== 'runeword' ? (
          <div className="relative h-12 w-12 flex-shrink-0">
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
            {isLoading && (
              <div className="absolute inset-0 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            )}
            <ItemTypeIcon type={item.type} className="absolute right-0 bottom-0 h-4 w-4" />
          </div>
        ) : (
          <ItemTypeIcon type={item.type} className="h-6 w-6 flex-shrink-0" />
        )}

        {/* Status indicators */}
        {!withoutStatusIndicators && (
          <StatusIndicators
            mostRecentDiscovery={mostRecentDiscovery}
            item={item}
            normalProgress={normalProgress}
            etherealProgress={etherealProgress}
            settings={settings}
          />
        )}

        {/* Item Name */}
        <Tooltip>
          <TooltipTrigger className="flex-1 truncate text-left">
            <h3 className="truncate font-semibold text-black text-sm dark:text-white">
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

              <DiscoveryInfo allProgress={allProgress} characters={characters} />
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Character attribution */}
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
      </div>
    </TooltipProvider>
  );
}
