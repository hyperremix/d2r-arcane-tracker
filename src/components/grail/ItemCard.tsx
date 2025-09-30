import type { Character, GrailProgress, HolyGrailItem } from 'electron/types/grail';
import { Check, CheckCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isEtherealOnly, shouldShowEtherealStatus, shouldShowNormalStatus } from '@/lib/ethereal';
import { cn, isRecentFind } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';
import { CharacterIcon, ItemTypeIcon, RecentDiscoveryIndicator } from './StatusIcons';

/**
 * Extracts discovery metadata from normal and ethereal progress arrays.
 * @param {GrailProgress[]} normalProgress - Progress records for normal version
 * @param {GrailProgress[]} etherealProgress - Progress records for ethereal version
 * @returns {Object} Object containing all progress, count, and most recent discovery
 */
function getDiscoveryMetadata(normalProgress: GrailProgress[], etherealProgress: GrailProgress[]) {
  const allProgress = [...normalProgress, ...etherealProgress];
  const discoveryCount = allProgress.length;
  const mostRecentDiscovery = allProgress.sort(
    (a, b) => new Date(b.foundDate || 0).getTime() - new Date(a.foundDate || 0).getTime(),
  )[0];

  return { allProgress, discoveryCount, mostRecentDiscovery };
}

/**
 * Gets deduplicated list of characters who discovered versions of an item.
 * @param {GrailProgress[]} allProgress - All progress records for the item
 * @param {Character[]} characters - All available characters
 * @returns {Character[]} Array of unique characters who discovered the item
 */
function getDiscoveringCharacters(allProgress: GrailProgress[], characters: Character[]) {
  const uniqueCharacterIds = new Set(allProgress.map((p) => p.characterId));
  return Array.from(uniqueCharacterIds)
    .map((characterId) => characters.find((c) => c.id === characterId))
    .filter(Boolean) as Character[];
}

/**
 * Props interface for the DiscoveryInfo component.
 */
interface DiscoveryInfoProps {
  allProgress: GrailProgress[];
  characters: Character[];
}

/**
 * DiscoveryInfo component that renders discovery details in a tooltip.
 * @param {DiscoveryInfoProps} props - Component props
 * @param {GrailProgress[]} props.allProgress - All progress records for the item
 * @param {Character[]} props.characters - All available characters
 * @returns {JSX.Element | null} Discovery information or null if no progress
 */
function DiscoveryInfo({ allProgress, characters }: DiscoveryInfoProps) {
  if (allProgress.length === 0) return null;

  return (
    <div className="mt-2 border-gray-200 border-t pt-2">
      <p className="font-medium text-xs">Discovery Info:</p>
      {allProgress.slice(0, 3).map((p) => {
        const character = characters.find((c) => c.id === p.characterId);
        const isEthProgress = p.itemId.startsWith('eth_');
        return (
          <div key={`${character?.id}-${p.id}`} className="mt-1 flex items-center gap-1 text-xs">
            {character && (
              <CharacterIcon characterClass={character.characterClass} className="h-3 w-3" />
            )}
            <span>{character?.name || 'Unknown'}</span>
            <span className="text-blue-600 text-xs">({isEthProgress ? 'Eth' : 'Normal'})</span>
            {p.foundDate && (
              <span className="text-gray-500">• {new Date(p.foundDate).toLocaleDateString()}</span>
            )}
          </div>
        );
      })}
      {allProgress.length > 3 && (
        <p className="mt-1 text-gray-500 text-xs">+{allProgress.length - 3} more discoveries</p>
      )}
    </div>
  );
}

/**
 * Props interface for the ListView component.
 */
interface ListViewProps {
  item: HolyGrailItem;
  allProgress: GrailProgress[];
  characters: Character[];
  normalProgress: GrailProgress[];
  etherealProgress: GrailProgress[];
  discoveringCharacters: Character[];
  mostRecentDiscovery: GrailProgress | undefined;
  className: string | undefined;
  handleKeyDown: (event: React.KeyboardEvent) => void;
  settings: { grailEthereal: boolean };
  onClick?: () => void;
}

/**
 * ListView component that renders an item in list view mode.
 * @param {ListViewProps} props - Component props
 * @returns {JSX.Element} A list view representation of the item
 */
function ListView({
  item,
  allProgress,
  characters,
  normalProgress,
  etherealProgress,
  discoveringCharacters,
  mostRecentDiscovery,
  className,
  handleKeyDown,
  settings,
  onClick,
}: ListViewProps) {
  return (
    <TooltipProvider>
      {/** biome-ignore lint/a11y/noStaticElementInteractions: explanation */}
      <div
        className={cn(
          'relative flex w-full items-center gap-3 p-3 transition-all duration-200',
          'rounded-lg border-2 hover:shadow-md',
          typeColors[item.type],
          allProgress.length > 0 ? '' : 'bg-gray-50 opacity-60 hover:opacity-80 dark:bg-gray-950',
          className,
        )}
        onClick={onClick}
        onKeyDown={handleKeyDown}
      >
        {/* Item Type Icon */}
        <ItemTypeIcon type={item.type} className="h-6 w-6 flex-shrink-0" />

        {/* Status indicators */}
        <StatusIndicators
          mostRecentDiscovery={mostRecentDiscovery}
          item={item}
          normalProgress={normalProgress}
          etherealProgress={etherealProgress}
          settings={settings}
        />

        {/* Item Name */}
        <Tooltip>
          <TooltipTrigger asChild>
            <h3 className="flex-1 truncate font-semibold text-black text-sm dark:text-white">
              {item.name}
            </h3>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm">
            <div className="space-y-1">
              <p className="font-semibold">{item.name}</p>
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
        />
      </div>
    </TooltipProvider>
  );
}

/**
 * Determines if an item is fully complete based on grail settings and found versions.
 * @param {HolyGrailItem} item - The Holy Grail item to check
 * @param {GrailProgress[]} normalProgress - Progress records for normal version
 * @param {GrailProgress[]} etherealProgress - Progress records for ethereal version
 * @param {{ grailEthereal: boolean }} settings - Grail settings
 * @returns {boolean} True if all required versions are found, false otherwise
 */
function determineCompletionStatus(
  item: HolyGrailItem,
  normalProgress: GrailProgress[],
  etherealProgress: GrailProgress[],
  settings: { grailEthereal: boolean },
) {
  const normalFound = normalProgress.length > 0;
  const etherealFound = etherealProgress.length > 0;
  const canBeNormal = shouldShowNormalStatus(item);
  const canBeEthereal = shouldShowEtherealStatus(item);

  if (!settings.grailEthereal) {
    // If ethereal tracking is disabled, only normal version matters
    return canBeNormal ? normalFound : true;
  }

  // If ethereal tracking is enabled, both versions matter
  return (canBeNormal ? normalFound : true) && (canBeEthereal ? etherealFound : true);
}

/**
 * Gets tooltip text based on completion status and ethereal settings.
 * @param {boolean} allVersionsFound - Whether all required versions are found
 * @param {{ grailEthereal: boolean }} settings - Grail settings
 * @returns {string} Appropriate tooltip text for the completion status
 */
function getTooltipText(allVersionsFound: boolean, settings: { grailEthereal: boolean }) {
  if (allVersionsFound) {
    return settings.grailEthereal ? 'All versions found' : 'Item found';
  }
  return settings.grailEthereal ? 'Some versions missing' : 'Item not found';
}

/**
 * Props interface for the StatusIndicators component.
 */
interface StatusIndicatorsProps {
  mostRecentDiscovery: GrailProgress | undefined;
  item: HolyGrailItem;
  normalProgress: GrailProgress[];
  etherealProgress: GrailProgress[];
  settings: { grailEthereal: boolean };
}

/**
 * StatusIndicators component that renders status overlay icons for an item.
 * @param {StatusIndicatorsProps} props - Component props
 * @returns {JSX.Element | null} Status indicator overlay or null if no discoveries
 */
function StatusIndicators({
  mostRecentDiscovery,
  item,
  normalProgress,
  etherealProgress,
  settings,
}: StatusIndicatorsProps) {
  if (mostRecentDiscovery?.foundDate && isRecentFind(mostRecentDiscovery.foundDate)) {
    return (
      <div className="-top-3 -right-3 absolute z-40">
        <RecentDiscoveryIndicator foundDate={mostRecentDiscovery.foundDate} />
      </div>
    );
  }

  const normalFound = normalProgress.length > 0;
  const etherealFound = etherealProgress.length > 0;
  const hasAnyVersion = normalFound || etherealFound;

  if (!hasAnyVersion) {
    return null; // No status indicator for items with no discoveries
  }

  const allVersionsFound = determineCompletionStatus(
    item,
    normalProgress,
    etherealProgress,
    settings,
  );

  return (
    <div className="-top-3 -right-3 absolute z-40">
      <Tooltip>
        <TooltipTrigger>
          {allVersionsFound ? (
            <CheckCheck className="h-5 w-5 rounded-full bg-white text-green-600" />
          ) : (
            <Check className="h-5 w-5 rounded-full bg-white text-yellow-600" />
          )}
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{getTooltipText(allVersionsFound, settings)}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * Props interface for the DiscoveryAttribution component.
 */
interface DiscoveryAttributionProps {
  discoveringCharacters: Character[];
  item: HolyGrailItem;
}

/**
 * DiscoveryAttribution component that displays character icons showing who found the item.
 * @param {DiscoveryAttributionProps} props - Component props
 * @param {Character[]} props.discoveringCharacters - Characters who discovered the item
 * @param {HolyGrailItem} props.item - The Holy Grail item
 * @returns {JSX.Element} Character attribution display with tooltips
 */
function DiscoveryAttribution({ discoveringCharacters, item }: DiscoveryAttributionProps) {
  return (
    <div className="flex items-center justify-center gap-1 pt-3">
      <span className="text-gray-500 text-xs">Found by:</span>
      <div className="flex items-center gap-1">
        {discoveringCharacters.slice(0, 2).map((character, index) =>
          character ? (
            <Tooltip key={`${character.id}-${item.id}-${index}`}>
              <TooltipTrigger>
                <CharacterIcon
                  characterClass={character.characterClass}
                  className="text-gray-500"
                />
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {character.name} ({character.characterClass})
                </p>
              </TooltipContent>
            </Tooltip>
          ) : null,
        )}
        {discoveringCharacters.length > 2 && (
          <span className="text-gray-500 text-xs">+{discoveringCharacters.length - 2}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Props interface for the VersionCounts component.
 */
interface VersionCountsProps {
  item: HolyGrailItem;
  normalProgress: GrailProgress[];
  etherealProgress: GrailProgress[];
}

/**
 * VersionCounts component that displays badges showing count of normal and ethereal versions found.
 * @param {VersionCountsProps} props - Component props
 * @param {HolyGrailItem} props.item - The Holy Grail item
 * @param {GrailProgress[]} props.normalProgress - Progress records for normal version
 * @param {GrailProgress[]} props.etherealProgress - Progress records for ethereal version
 * @returns {JSX.Element | null} Version count badges or null if no versions found
 */
function VersionCounts({ item, normalProgress, etherealProgress }: VersionCountsProps) {
  const normalCount = normalProgress.length;
  const etherealCount = etherealProgress.length;

  if (normalCount === 0 && etherealCount === 0) return null;

  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      {shouldShowNormalStatus(item) && normalCount > 0 && (
        <span className="rounded bg-green-100 px-2 py-1 font-medium text-green-700 text-xs">
          Normal: {normalCount}x
        </span>
      )}
      {shouldShowEtherealStatus(item) && etherealCount > 0 && (
        <span className="rounded bg-blue-100 px-2 py-1 font-medium text-blue-700 text-xs">
          {isEtherealOnly(item) ? 'Ethereal Only' : 'Ethereal'}: {etherealCount}x
        </span>
      )}
    </div>
  );
}

/**
 * Props interface for the GridView component.
 */
interface GridViewProps {
  item: HolyGrailItem;
  allProgress: GrailProgress[];
  characters: Character[];
  discoveringCharacters: Character[];
  normalProgress: GrailProgress[];
  etherealProgress: GrailProgress[];
  mostRecentDiscovery: GrailProgress | undefined;
  className: string | undefined;
  handleKeyDown: (event: React.KeyboardEvent) => void;
  settings: { grailEthereal: boolean };
  onClick?: () => void;
}

/**
 * GridView component that renders an item in grid view mode.
 * @param {GridViewProps} props - Component props
 * @returns {JSX.Element} A grid view representation of the item
 */
function GridView({
  item,
  allProgress,
  characters,
  discoveringCharacters,
  normalProgress,
  etherealProgress,
  mostRecentDiscovery,
  className,
  handleKeyDown,
  settings,
  onClick,
}: GridViewProps) {
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
          <StatusIndicators
            mostRecentDiscovery={mostRecentDiscovery}
            item={item}
            normalProgress={normalProgress}
            etherealProgress={etherealProgress}
            settings={settings}
          />

          <CardContent className="py-2">
            <div>
              {/* Item Name with Type Icon */}
              <div className="flex items-center gap-2">
                <ItemTypeIcon type={item.type} className="absolute top-2 left-2" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <h3 className="flex-1 truncate pt-2 font-semibold text-black text-sm leading-tight dark:text-white">
                      {item.name}
                    </h3>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-sm">
                    <div className="space-y-1">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-gray-500 text-xs">
                        {item.category} • {item.subCategory.replace('_', ' ')}
                      </p>

                      {allProgress.length > 0 && (
                        <DiscoveryInfo allProgress={allProgress} characters={characters} />
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>

              {/* Set specific info */}
              {item.setName && (
                <p className="font-medium text-green-600 text-xs dark:text-green-400">
                  Set: {item.setName}
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
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

/**
 * Props interface for the ItemCard component.
 */
interface ItemCardProps {
  item: HolyGrailItem;
  normalProgress?: GrailProgress[]; // Progress for normal version
  etherealProgress?: GrailProgress[]; // Progress for ethereal version
  characters?: Character[];
  onClick?: () => void;
  className?: string;
  viewMode?: 'grid' | 'list';
}

/**
 * Color mapping for different item types used for visual styling.
 */
const typeColors = {
  unique:
    'border-yellow-500 border-yellow-300 bg-yellow-50 shadow-yellow-200 dark:bg-yellow-950 dark:shadow-yellow-800',
  set: 'border-green-500 border-green-300 bg-green-50 shadow-green-200 dark:bg-green-950 dark:shadow-green-800',
  rune: 'border-orange-500 border-orange-300 bg-orange-50 shadow-orange-200 dark:bg-orange-950 dark:shadow-orange-800',
  runeword:
    'border-purple-500 border-purple-300 bg-purple-50 shadow-purple-200 dark:bg-purple-950 dark:shadow-purple-800',
};

/**
 * ItemCard component that displays a Holy Grail item with its discovery status and information.
 * Supports both grid and list view modes, showing progress, character attribution, and version counts.
 * @param {ItemCardProps} props - Component props
 * @param {HolyGrailItem} props.item - The Holy Grail item to display
 * @param {GrailProgress[]} [props.normalProgress=[]] - Progress records for normal version
 * @param {GrailProgress[]} [props.etherealProgress=[]] - Progress records for ethereal version
 * @param {Character[]} [props.characters=[]] - Available characters for attribution
 * @param {() => void} [props.onClick] - Optional click handler
 * @param {string} [props.className] - Optional additional CSS classes
 * @param {'grid' | 'list'} [props.viewMode='grid'] - Display mode (grid or list)
 * @returns {JSX.Element} An item card with status indicators and discovery information
 */
export function ItemCard({
  item,
  normalProgress = [],
  etherealProgress = [],
  characters = [],
  onClick,
  className,
  viewMode = 'grid',
}: ItemCardProps) {
  // Get settings from the store
  const { settings } = useGrailStore();

  // Calculate discovery metadata for both normal and ethereal versions
  const { allProgress, mostRecentDiscovery } = getDiscoveryMetadata(
    normalProgress,
    etherealProgress,
  );

  // Get character info for discoveries from both versions
  const discoveringCharacters = getDiscoveringCharacters(allProgress, characters);

  // Handle keyboard events for accessibility
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.();
    }
  };

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
        handleKeyDown={handleKeyDown}
        settings={settings}
        onClick={onClick}
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
      handleKeyDown={handleKeyDown}
      settings={settings}
      onClick={onClick}
    />
  );
}
