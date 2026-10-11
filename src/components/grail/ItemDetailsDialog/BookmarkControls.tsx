import type { VaultItem } from 'electron/types/grail';
import { Bookmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { translations } from '@/i18n/translations';
import { cn } from '@/lib/utils';

interface BookmarkActionProps {
  linkedBookmark: VaultItem | undefined;
  isPending: boolean;
  onToggle: () => Promise<void>;
}

/**
 * Adds or removes the item's grail bookmark. The button is the only place the bookmark state is
 * shown: its label names the action it performs ("Bookmark" / "Remove bookmark") and the icon is
 * filled while the item is bookmarked. Because the label already changes with the state, the
 * button is not an aria-pressed toggle (that would announce the state twice).
 */
export function BookmarkAction({ linkedBookmark, isPending, onToggle }: BookmarkActionProps) {
  const { t } = useTranslation();
  const isBookmarked = linkedBookmark !== undefined;

  return (
    <Button variant="outline" disabled={isPending} onClick={() => void onToggle()}>
      <Bookmark className={cn('mr-1 h-4 w-4', isBookmarked && 'fill-current')} aria-hidden="true" />
      {isBookmarked
        ? t(translations.grail.itemDetails.unbookmarkAction)
        : t(translations.grail.itemDetails.bookmarkAction)}
    </Button>
  );
}
