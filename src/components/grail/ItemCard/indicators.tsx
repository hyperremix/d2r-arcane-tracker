import type { Character, GrailProgress, Item } from 'electron/types/grail';
import type { TFunction } from 'i18next';
import { Check, Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { translations } from '@/i18n/translations';
import { formatShortDate } from '@/lib/date';
import { isEtherealOnly } from '@/lib/ethereal';
import { etherealTypeLabelKeys } from '@/lib/labelKeys';
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
  /**
   * Smaller pills on one line for narrow grid tiles; the ethereal pill reads "Eth". The screen
   * reader text keeps the full version name.
   */
  compact?: boolean;
  className?: string;
}

/**
 * Returns the visible label of a version pill.
 */
function getPillLabel(
  item: Item,
  version: VersionStatus['version'],
  compact: boolean,
  t: TFunction,
) {
  if (version === 'ethereal' && isEtherealOnly(item)) return t(etherealTypeLabelKeys.only);
  if (version === 'ethereal' && compact) return t(translations.grail.itemCard.eth);
  return getVersionLabel(version, t);
}

/**
 * VersionPills component that shows one pill per tracked version (Normal / Ethereal): solid, with
 * a check mark and lit in the item's quality color when found; dashed, with an empty circle and
 * muted while still missing. Each pill also carries its status as screen reader text, so the state
 * never depends on color or shape alone.
 */
export function VersionPills({
  item,
  versionStatuses,
  compact = false,
  className,
}: VersionPillsProps) {
  const { t } = useTranslation();
  if (versionStatuses.length === 0) return null;

  // Compact width at the 128px minimum column (110px tile content), with a pessimistic 0.6em per
  // glyph at 10px (wider than Arial and Verdana): Normal 2 border + 8 padding + 8 icon + 1 gap +
  // 36 text = 55px, Eth 2 + 8 + 8 + 1 + 18 = 37px, plus 2px between pills = 94px, 16px to spare.
  return (
    <ul
      className={cn(
        'flex items-center justify-center',
        compact ? 'flex-nowrap gap-0.5' : 'flex-wrap gap-1.5',
        className,
      )}
    >
      {versionStatuses.map((status) => {
        const pillLabel = getPillLabel(item, status.version, compact, t);
        return (
          <li
            key={status.version}
            data-version={status.version}
            data-found={status.isFound}
            className={cn(
              'inline-flex items-center rounded-full border font-medium',
              compact ? 'min-w-0 px-1 text-[0.625rem] leading-4' : 'px-2 py-0.5 text-xs leading-4',
              getVersionPillClasses(item.type, status.isFound),
            )}
          >
            <span
              aria-hidden="true"
              className={cn('inline-flex items-center', compact ? 'min-w-0 gap-px' : 'gap-1')}
            >
              {status.isFound ? (
                <Check className={compact ? 'size-2 shrink-0' : 'size-3'} strokeWidth={3} />
              ) : (
                <Circle className={compact ? 'size-2 shrink-0' : 'size-2.5'} />
              )}
              {/* Compact pills may be squeezed by narrow tiles: the label truncates, not the icon */}
              {compact ? <span className="truncate">{pillLabel}</span> : pillLabel}
            </span>
            <span className="sr-only">{getVersionStatusLabel(status, t)}</span>
          </li>
        );
      })}
    </ul>
  );
}
