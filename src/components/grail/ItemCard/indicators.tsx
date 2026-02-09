import type { Character, GrailProgress, Item, Settings } from 'electron/types/grail';
import { Check, CheckCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { translations } from '@/i18n/translations';
import { isEtherealOnly, shouldShowEtherealStatus, shouldShowNormalStatus } from '@/lib/ethereal';
import { formatShortDate, isRecentFind } from '@/lib/utils';
import { CharacterIcon, RecentDiscoveryIndicator } from '../StatusIcons';

/**
 * Props interface for the DiscoveryInfo component.
 */
export interface DiscoveryInfoProps {
  allProgress: GrailProgress[];
  characters: Character[];
}

/**
 * DiscoveryInfo component that renders discovery details in a tooltip.
 */
export function DiscoveryInfo({ allProgress, characters }: DiscoveryInfoProps) {
  const { t } = useTranslation();
  if (allProgress.length === 0) return null;

  return (
    <div className="mt-2 border-gray-200 border-t pt-2">
      <p className="font-medium text-xs">{t(translations.grail.itemCard.discoveryInfo)}</p>
      {allProgress.slice(0, 3).map((p) => {
        const character = characters.find((c) => c.id === p.characterId);
        const isEthProgress = p.isEthereal;
        return (
          <div key={`${character?.id}-${p.id}`} className="mt-1 flex items-center gap-1 text-xs">
            {character && (
              <CharacterIcon characterClass={character.characterClass} className="h-3 w-3" />
            )}
            <span>{character?.name || t(translations.common.unknown)}</span>
            <span className="text-blue-600 text-xs">
              (
              {isEthProgress
                ? t(translations.grail.itemCard.eth)
                : t(translations.grail.itemCard.normal)}
              )
            </span>
            {p.foundDate && <span className="text-gray-500">• {formatShortDate(p.foundDate)}</span>}
          </div>
        );
      })}
      {allProgress.length > 3 && (
        <p className="mt-1 text-gray-500 text-xs">
          {t(translations.grail.itemCard.moreDiscoveries, { count: allProgress.length - 3 })}
        </p>
      )}
    </div>
  );
}

/**
 * Determines if an item is fully complete based on grail settings and found versions.
 */
export function determineCompletionStatus(
  item: Item,
  normalProgress: GrailProgress[],
  etherealProgress: GrailProgress[],
  settings: Settings,
) {
  const normalFound = normalProgress.length > 0;
  const etherealFound = etherealProgress.length > 0;
  const canBeNormal = shouldShowNormalStatus(item, settings);
  const canBeEthereal = shouldShowEtherealStatus(item, settings);

  if (!settings.grailEthereal) {
    // If ethereal tracking is disabled, only normal version matters
    return canBeNormal ? normalFound : true;
  }

  // If ethereal tracking is enabled, both versions matter
  return (canBeNormal ? normalFound : true) && (canBeEthereal ? etherealFound : true);
}

/**
 * Gets tooltip text based on completion status and ethereal settings.
 */
export function getTooltipText(
  allVersionsFound: boolean,
  settings: Settings,
  t: (key: string) => string,
) {
  if (allVersionsFound) {
    return settings.grailEthereal
      ? t(translations.grail.itemCard.allVersionsFound)
      : t(translations.grail.itemCard.itemFound);
  }
  return settings.grailEthereal
    ? t(translations.grail.itemCard.someVersionsMissing)
    : t(translations.grail.itemCard.itemNotFound);
}

/**
 * Props interface for the StatusIndicators component.
 */
export interface StatusIndicatorsProps {
  mostRecentDiscovery: GrailProgress | undefined;
  item: Item;
  normalProgress: GrailProgress[];
  etherealProgress: GrailProgress[];
  settings: Settings;
}

/**
 * StatusIndicators component that renders status overlay icons for an item.
 */
export function StatusIndicators({
  mostRecentDiscovery,
  item,
  normalProgress,
  etherealProgress,
  settings,
}: StatusIndicatorsProps) {
  const { t } = useTranslation();
  if (
    mostRecentDiscovery?.foundDate &&
    !mostRecentDiscovery.fromInitialScan &&
    isRecentFind(mostRecentDiscovery.foundDate)
  ) {
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
            <CheckCheck className="h-5 w-5 rounded-full bg-white text-green-600 dark:bg-gray-950" />
          ) : (
            <Check className="h-5 w-5 rounded-full bg-white text-yellow-600 dark:bg-gray-950" />
          )}
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{getTooltipText(allVersionsFound, settings, t)}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * Props interface for the DiscoveryAttribution component.
 */
export interface DiscoveryAttributionProps {
  discoveringCharacters: Character[];
  item: Item;
}

/**
 * DiscoveryAttribution component that displays character icons showing who found the item.
 */
export function DiscoveryAttribution({ discoveringCharacters, item }: DiscoveryAttributionProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-1 pt-3">
      <span className="text-gray-500 text-xs dark:text-gray-400">
        {t(translations.grail.itemCard.foundBy)}
      </span>
      <div className="flex items-center gap-1">
        {discoveringCharacters.slice(0, 2).map((character, index) =>
          character ? (
            <Tooltip key={`${character.id}-${item.id}-${index}`}>
              <TooltipTrigger>
                <CharacterIcon
                  characterClass={character.characterClass}
                  className="text-gray-500 dark:text-gray-400"
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
          <span className="text-gray-500 text-xs dark:text-gray-400">
            +{discoveringCharacters.length - 2}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Props interface for the VersionCounts component.
 */
export interface VersionCountsProps {
  item: Item;
  normalProgress: GrailProgress[];
  etherealProgress: GrailProgress[];
  settings: Settings;
}

/**
 * VersionCounts component that displays badges showing count of normal and ethereal versions found.
 */
export function VersionCounts({
  item,
  normalProgress,
  etherealProgress,
  settings,
}: VersionCountsProps) {
  const { t } = useTranslation();
  const normalCount = normalProgress.length;
  const etherealCount = etherealProgress.length;

  if (normalCount === 0 && etherealCount === 0) return null;

  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      {shouldShowNormalStatus(item, settings) && normalCount > 0 && (
        <span className="rounded bg-green-100 px-2 py-1 font-medium text-green-700 text-xs dark:bg-green-900 dark:text-green-200">
          {t(translations.grail.itemCard.normalCount, { count: normalCount })}
        </span>
      )}
      {shouldShowEtherealStatus(item, settings) && etherealCount > 0 && (
        <span className="rounded bg-blue-100 px-2 py-1 font-medium text-blue-700 text-xs dark:bg-blue-900 dark:text-blue-200">
          {isEtherealOnly(item)
            ? t(translations.grail.itemCard.etherealOnly)
            : t(translations.grail.itemCard.etherealCount, { count: etherealCount })}
        </span>
      )}
    </div>
  );
}
