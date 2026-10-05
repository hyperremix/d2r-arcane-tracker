import {
  Loader2Icon,
  type LucideIcon,
  PackageOpen,
  RotateCcw,
  SearchX,
  Settings,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';

/**
 * The reasons the item grid can have nothing to display.
 * - `trackingDisabled`: both normal and ethereal grail tracking are turned off
 * - `noMatches`: items exist, but the active search/filters match none of them
 * - `loading`: items are still being loaded
 * - `noItems`: there are no items at all
 */
export type ItemGridEmptyStateVariant = 'trackingDisabled' | 'noMatches' | 'loading' | 'noItems';

/**
 * Props for the ItemGridEmptyState component.
 */
interface ItemGridEmptyStateProps {
  variant: ItemGridEmptyStateVariant;
}

/**
 * Describes the visual content and optional action of an empty state variant.
 */
interface EmptyStateContent {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; icon: LucideIcon; onClick: () => void };
}

/**
 * Determines which empty state (if any) the item grid should display.
 * @returns {ItemGridEmptyStateVariant | undefined} The empty state variant, or undefined when items can be shown
 */
export function getItemGridEmptyStateVariant({
  displayItemCount,
  totalItemCount,
  grailNormal,
  grailEthereal,
  hasActiveFilters,
  loading,
}: {
  displayItemCount: number;
  totalItemCount: number;
  grailNormal: boolean;
  grailEthereal: boolean;
  hasActiveFilters: boolean;
  loading: boolean;
}): ItemGridEmptyStateVariant | undefined {
  if (!grailNormal && !grailEthereal) return 'trackingDisabled';
  if (displayItemCount > 0) return undefined;
  if (totalItemCount === 0) return loading ? 'loading' : 'noItems';
  if (hasActiveFilters) return 'noMatches';
  return 'noItems';
}

/**
 * Empty state shown in place of the item grid/list when there is nothing to display.
 * Explains why the grid is empty and offers a relevant action.
 */
export function ItemGridEmptyState({ variant }: ItemGridEmptyStateProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const resetFilters = useGrailStore((state) => state.resetFilters);
  const reloadData = useGrailStore((state) => state.reloadData);

  const contentByVariant: Record<ItemGridEmptyStateVariant, EmptyStateContent> = {
    trackingDisabled: {
      icon: Settings,
      title: t(translations.grail.itemGrid.emptyTrackingDisabledTitle),
      description: t(translations.grail.itemGrid.emptyTrackingDisabledDescription),
      action: {
        label: t(translations.grail.itemGrid.openSettings),
        icon: Settings,
        onClick: () => navigate('/settings'),
      },
    },
    noMatches: {
      icon: SearchX,
      title: t(translations.grail.itemGrid.emptyNoMatchesTitle),
      description: t(translations.grail.itemGrid.emptyNoMatchesDescription),
      action: {
        label: t(translations.grail.itemGrid.clearFilters),
        icon: RotateCcw,
        onClick: resetFilters,
      },
    },
    loading: {
      icon: Loader2Icon,
      title: t(translations.common.loading),
    },
    noItems: {
      icon: PackageOpen,
      title: t(translations.grail.itemGrid.emptyNoItemsTitle),
      description: t(translations.grail.itemGrid.emptyNoItemsDescription),
      action: {
        label: t(translations.common.retry),
        icon: RotateCcw,
        onClick: () => {
          void reloadData();
        },
      },
    },
  };

  const { icon: Icon, title, description, action } = contentByVariant[variant];

  return (
    <div
      data-testid="item-grid-empty-state"
      data-variant={variant}
      className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
    >
      <Icon
        aria-hidden="true"
        className={cn('size-10 text-muted-foreground', variant === 'loading' && 'animate-spin')}
      />
      <h3 className="font-semibold text-foreground text-lg">{title}</h3>
      {description && <p className="max-w-md text-muted-foreground text-sm">{description}</p>}
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick} className="mt-2">
          <action.icon aria-hidden="true" />
          {action.label}
        </Button>
      )}
    </div>
  );
}
