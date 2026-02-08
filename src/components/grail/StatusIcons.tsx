import {
  Axe,
  BowArrow,
  Circle,
  Crown,
  Flame,
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
import { cn, isRecentFind } from '@/lib/utils';

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
    unique: 'text-yellow-500',
    set: 'text-green-500',
    rune: 'text-orange-500',
    runeword: 'text-purple-500',
  };

  return (
    <Icon
      className={cn(
        'h-4 w-4',
        colorMap[type as keyof typeof colorMap] || 'text-gray-500',
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
}

/**
 * RecentDiscoveryIndicator component that displays a flame icon for recently found items.
 * @param {RecentDiscoveryProps} props - Component props
 * @param {Date} props.foundDate - The date when the item was found
 * @param {string} [props.className] - Optional additional CSS classes
 * @returns {JSX.Element | null} A flame icon if the find is recent, null otherwise
 */
export function RecentDiscoveryIndicator({ foundDate, className }: RecentDiscoveryProps) {
  const { t } = useTranslation();
  if (!isRecentFind(foundDate)) return null;

  return (
    <Tooltip>
      <TooltipTrigger>
        <Flame
          className={cn(
            'h-6 w-6 rounded-full bg-white pb-0.5 text-orange-500 dark:bg-gray-950',
            className,
          )}
        />
      </TooltipTrigger>
      <TooltipContent>
        <p>{t(translations.grail.statusIcons.recentlyFound)}</p>
      </TooltipContent>
    </Tooltip>
  );
}
