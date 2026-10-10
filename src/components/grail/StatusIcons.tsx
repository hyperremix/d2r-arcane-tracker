import {
  Axe,
  BowArrow,
  Circle,
  Crown,
  HandFist,
  Package,
  PawPrint,
  Scroll,
  Skull,
  Sparkles,
  Star,
  Sword,
  User,
  WandSparkles,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { translations } from '@/i18n/translations';
import { isRecentFind } from '@/lib/date';
import { cn } from '@/lib/utils';
import { getTooltipTriggerRender } from './tooltipTriggerRender';

/**
 * Props interface for the CharacterIcon component.
 */
interface CharacterIconProps {
  characterClass: string;
  className?: string;
}

/**
 * CharacterIcon component that displays an icon representing a Diablo 2 character class.
 * @param {CharacterIconProps} props - Component props
 * @param {string} props.characterClass - The character class name (amazon, assassin, etc.)
 * @param {string} [props.className] - Optional additional CSS classes
 * @returns {JSX.Element} An icon component representing the character class
 */
export function CharacterIcon({ characterClass, className }: CharacterIconProps) {
  const iconMap = {
    amazon: BowArrow,
    assassin: HandFist,
    barbarian: Axe,
    druid: PawPrint,
    necromancer: Skull,
    paladin: Sword,
    sorceress: WandSparkles,
    shared_stash: Package,
  };

  const Icon = iconMap[characterClass as keyof typeof iconMap] || User;

  return <Icon className={cn('h-4 w-4', className)} />;
}

/**
 * Props interface for the ItemTypeIcon component.
 */
interface ItemTypeIconProps {
  type: string;
  className?: string;
}

/**
 * ItemTypeIcon component that displays an icon representing an item type with appropriate color.
 * @param {ItemTypeIconProps} props - Component props
 * @param {string} props.type - The item type (unique, set, rune, runeword)
 * @param {string} [props.className] - Optional additional CSS classes
 * @returns {JSX.Element} A colored icon component representing the item type
 */
export function ItemTypeIcon({ type, className }: ItemTypeIconProps) {
  const iconMap = {
    unique: Star,
    set: Crown,
    rune: Scroll,
    runeword: Sparkles,
  };

  const Icon = iconMap[type as keyof typeof iconMap] || Circle;

  const colorMap = {
    unique: 'text-item-unique',
    set: 'text-item-set',
    rune: 'text-item-rune',
    runeword: 'text-item-runeword',
  };

  return (
    <Icon
      className={cn(
        'h-4 w-4',
        colorMap[type as keyof typeof colorMap] || 'text-muted-foreground',
        className,
      )}
    />
  );
}

/**
 * Props interface for the RecentDiscoveryIndicator component.
 */
interface RecentDiscoveryProps {
  foundDate: Date;
  className?: string;
  focusableTriggers?: boolean;
}

/**
 * RecentDiscoveryIndicator component that displays a small "New" badge for recently found items.
 * The badge uses the neutral foreground color, never an item-quality color, so it cannot be
 * confused with an item's quality; its meaning is carried by its text.
 * @param {RecentDiscoveryProps} props - Component props
 * @param {Date} props.foundDate - The date when the item was found
 * @param {string} [props.className] - Optional additional CSS classes
 * @param {boolean} [props.focusableTriggers] - Whether the tooltip trigger is a focusable button
 * @returns {JSX.Element | null} A "New" badge if the find is recent, null otherwise
 */
export function RecentDiscoveryIndicator({
  foundDate,
  className,
  focusableTriggers = true,
}: RecentDiscoveryProps) {
  const { t } = useTranslation();
  if (!isRecentFind(foundDate)) return null;

  return (
    <Tooltip>
      <TooltipTrigger render={getTooltipTriggerRender(focusableTriggers)} className="inline-flex">
        <span
          className={cn(
            'rounded-sm bg-foreground px-1.5 font-semibold text-[0.625rem] text-background uppercase leading-4 tracking-wider',
            className,
          )}
        >
          {t(translations.runTracker.runDetails.new)}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{t(translations.grail.statusIcons.recentlyFound)}</p>
      </TooltipContent>
    </Tooltip>
  );
}
