import type { Character, GrailProgress, Item } from 'electron/types/grail';
import { Check, Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { translations } from '@/i18n/translations';
import { formatShortDate } from '@/lib/date';
import { isEtherealOnly } from '@/lib/ethereal';
import { cn } from '@/lib/utils';
import { CharacterIcon } from '../StatusIcons';
import { getTooltipTriggerRender } from '../tooltipTriggerRender';
import { getVersionLabel, getVersionStatusLabel, type VersionStatus } from './cardState';
import { getVersionPillClasses } from './styles';

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
    <div className="mt-2 border-border border-t pt-2">
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
            <span
              className={cn('text-xs', isEthProgress ? 'text-ethereal' : 'text-muted-foreground')}
            >
              (
              {isEthProgress
                ? t(translations.grail.itemCard.eth)
                : t(translations.grail.itemCard.normal)}
              )
            </span>
            {p.foundDate && (
              <span className="text-muted-foreground">• {formatShortDate(p.foundDate)}</span>
            )}
          </div>
        );
      })}
      {allProgress.length > 3 && (
        <p className="mt-1 text-muted-foreground text-xs">
          {t(translations.grail.itemCard.moreDiscoveries, { count: allProgress.length - 3 })}
        </p>
      )}
    </div>
  );
}

/**
 * Props interface for the DiscoveryAttribution component.
 */
export interface DiscoveryAttributionProps {
  discoveringCharacters: Character[];
  item: Item;
  focusableTriggers?: boolean;
  className?: string;
}

/**
 * DiscoveryAttribution component that displays small, muted character icons showing who found
 * the item.
 */
export function DiscoveryAttribution({
  discoveringCharacters,
  item,
  focusableTriggers = true,
  className,
}: DiscoveryAttributionProps) {
  const { t } = useTranslation();
  return (
    <div className={cn('flex items-center justify-center gap-1', className)}>
      <span className="text-muted-foreground text-xs">
        {t(translations.grail.itemCard.foundBy)}
      </span>
      <div className="flex items-center gap-1">
        {discoveringCharacters.slice(0, 2).map((character, index) =>
          character ? (
            <Tooltip key={`${character.id}-${item.id}-${index}`}>
              <TooltipTrigger
                render={getTooltipTriggerRender(focusableTriggers)}
                className="inline-flex"
              >
                <CharacterIcon
                  characterClass={character.characterClass}
                  className="size-3.5 text-muted-foreground"
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
          <span className="text-muted-foreground text-xs">+{discoveringCharacters.length - 2}</span>
        )}
      </div>
    </div>
  );
}

/**
 * Props interface for the VersionPills component.
 */
export interface VersionPillsProps {
  item: Item;
  versionStatuses: VersionStatus[];
  className?: string;
}

/**
 * VersionPills component that shows one pill per tracked version (Normal / Ethereal): solid, with
 * a check mark and lit in the item's quality color when found; dashed, with an empty circle and
 * muted while still missing. Each pill also carries its status as screen reader text, so the state
 * never depends on color or shape alone.
 */
export function VersionPills({ item, versionStatuses, className }: VersionPillsProps) {
  const { t } = useTranslation();
  if (versionStatuses.length === 0) return null;

  return (
    <ul className={cn('flex flex-wrap items-center justify-center gap-1.5', className)}>
      {versionStatuses.map((status) => {
        const pillLabel =
          status.version === 'ethereal' && isEtherealOnly(item)
            ? t(translations.grail.itemCard.etherealOnly)
            : getVersionLabel(status.version, t);
        return (
          <li
            key={status.version}
            data-version={status.version}
            data-found={status.isFound}
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-0.5 font-medium text-xs leading-4',
              getVersionPillClasses(item.type, status.isFound),
            )}
          >
            <span aria-hidden="true" className="inline-flex items-center gap-1">
              {status.isFound ? (
                <Check className="size-3" strokeWidth={3} />
              ) : (
                <Circle className="size-2.5" />
              )}
              {pillLabel}
            </span>
            <span className="sr-only">{getVersionStatusLabel(status, t)}</span>
          </li>
        );
      })}
    </ul>
  );
}
