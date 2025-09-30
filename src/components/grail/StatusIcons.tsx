import {
  Axe,
  BowArrow,
  CheckCircle,
  Circle,
  Crown,
  Diamond,
  Flame,
  HandFist,
  PawPrint,
  Scroll,
  Skull,
  Sparkles,
  Star,
  Sword,
  User,
  WandSparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, isRecentFind } from '@/lib/utils';

/**
 * Props interface for the FoundStatusIcon component.
 */
interface FoundStatusIconProps {
  found: boolean;
  className?: string;
}

/**
 * FoundStatusIcon component that displays a check or circle icon based on found status.
 * @param {FoundStatusIconProps} props - Component props
 * @param {boolean} props.found - Whether the item has been found
 * @param {string} [props.className] - Optional additional CSS classes
 * @returns {JSX.Element} A CheckCircle icon if found, Circle icon otherwise
 */
export function FoundStatusIcon({ found, className }: FoundStatusIconProps) {
  return found ? (
    <CheckCircle className={cn('h-4 w-4 text-green-500', className)} />
  ) : (
    <Circle className={cn('h-4 w-4 text-gray-400', className)} />
  );
}

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
  };

  const Icon = iconMap[characterClass as keyof typeof iconMap] || User;

  return <Icon className={cn('h-4 w-4', className)} />;
}

/**
 * Props interface for the EtherealIcon component.
 */
interface EtherealIconProps {
  isEthereal: boolean;
  className?: string;
}

/**
 * EtherealIcon component that displays a pulsing diamond icon for ethereal items.
 * @param {EtherealIconProps} props - Component props
 * @param {boolean} props.isEthereal - Whether the item is ethereal
 * @param {string} [props.className] - Optional additional CSS classes
 * @returns {JSX.Element | null} A pulsing diamond icon if ethereal, null otherwise
 */
export function EtherealIcon({ isEthereal, className }: EtherealIconProps) {
  if (!isEthereal) return null;

  return (
    <Tooltip>
      <TooltipTrigger>
        <Diamond className={cn('h-4 w-4 animate-pulse text-blue-400', className)} />
      </TooltipTrigger>
      <TooltipContent>
        <p>Ethereal Version</p>
      </TooltipContent>
    </Tooltip>
  );
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
 * Props interface for the DiscoveryCountBadge component.
 */
interface DiscoveryCountBadgeProps {
  count: number;
  className?: string;
}

/**
 * DiscoveryCountBadge component that displays a badge showing discovery count.
 * @param {DiscoveryCountBadgeProps} props - Component props
 * @param {number} props.count - The number of discoveries
 * @param {string} [props.className] - Optional additional CSS classes
 * @returns {JSX.Element | null} A badge showing count if > 1, null otherwise
 */
export function DiscoveryCountBadge({ count, className }: DiscoveryCountBadgeProps) {
  if (count <= 1) return null;

  return (
    <Badge variant="secondary" className={cn('px-1 py-0 text-xs', className)}>
      {count}×
    </Badge>
  );
}

/**
 * Props interface for the DifficultyBadge component.
 */
interface DifficultyBadgeProps {
  difficulty: string;
  className?: string;
}

/**
 * DifficultyBadge component that displays a colored badge for game difficulty.
 * @param {DifficultyBadgeProps} props - Component props
 * @param {string} props.difficulty - The difficulty level (normal, nightmare, hell)
 * @param {string} [props.className] - Optional additional CSS classes
 * @returns {JSX.Element} A colored badge indicating the difficulty level
 */
export function DifficultyBadge({ difficulty, className }: DifficultyBadgeProps) {
  const colorMap = {
    normal: 'bg-green-500',
    nightmare: 'bg-yellow-500',
    hell: 'bg-red-500',
  };

  return (
    <Badge
      className={cn(
        'px-2 py-0 text-white text-xs',
        colorMap[difficulty as keyof typeof colorMap] || 'bg-gray-500',
        className,
      )}
    >
      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
    </Badge>
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
  if (!isRecentFind(foundDate)) return null;

  return (
    <Tooltip>
      <TooltipTrigger>
        <Flame className={cn('h-6 w-6 rounded-full bg-white text-orange-500', className)} />
      </TooltipTrigger>
      <TooltipContent>
        <p>Recently Found!</p>
      </TooltipContent>
    </Tooltip>
  );
}
