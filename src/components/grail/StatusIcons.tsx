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

// Found/Not Found Status Icons
interface FoundStatusIconProps {
  found: boolean;
  className?: string;
}

export function FoundStatusIcon({ found, className }: FoundStatusIconProps) {
  return found ? (
    <CheckCircle className={cn('h-4 w-4 text-green-500', className)} />
  ) : (
    <Circle className={cn('h-4 w-4 text-gray-400', className)} />
  );
}

// Character Class Icons
interface CharacterIconProps {
  characterClass: string;
  className?: string;
}

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

// Ethereal Status Icon
interface EtherealIconProps {
  isEthereal: boolean;
  className?: string;
}

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

// Item Type Icons
interface ItemTypeIconProps {
  type: string;
  className?: string;
}

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

// Discovery Count Badge
interface DiscoveryCountBadgeProps {
  count: number;
  className?: string;
}

export function DiscoveryCountBadge({ count, className }: DiscoveryCountBadgeProps) {
  if (count <= 1) return null;

  return (
    <Badge variant="secondary" className={cn('px-1 py-0 text-xs', className)}>
      {count}×
    </Badge>
  );
}

// Difficulty Badge
interface DifficultyBadgeProps {
  difficulty: string;
  className?: string;
}

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

// Recent Discovery Indicator
interface RecentDiscoveryProps {
  foundDate: Date;
  className?: string;
}

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
