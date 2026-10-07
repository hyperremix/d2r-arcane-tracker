import type { VaultItem } from 'electron/types/grail';
import { Archive, ArchiveRestore } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { translations } from '@/i18n/translations';

/**
 * Shows whether the item currently has a grail bookmark.
 */
export function BookmarkStatusSection({
  linkedBookmark,
}: {
  linkedBookmark: VaultItem | undefined;
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-medium text-sm">
          {t(translations.grail.itemDetails.bookmarkStatusTitle)}
        </div>
        <Badge variant={linkedBookmark ? 'default' : 'secondary'}>
          {linkedBookmark
            ? t(translations.grail.itemDetails.bookmarked)
            : t(translations.grail.itemDetails.notBookmarked)}
        </Badge>
      </div>
    </div>
  );
}

/**
 * Adds or removes the item's grail bookmark.
 */
export function BookmarkAction({
  linkedBookmark,
  isPending,
  onToggle,
}: {
  linkedBookmark: VaultItem | undefined;
  isPending: boolean;
  onToggle: () => Promise<void>;
}) {
  const { t } = useTranslation();

  return (
    <Button variant="outline" disabled={isPending} onClick={() => void onToggle()}>
      {linkedBookmark ? (
        <ArchiveRestore className="mr-1 h-4 w-4" />
      ) : (
        <Archive className="mr-1 h-4 w-4" />
      )}
      {linkedBookmark
        ? t(translations.grail.itemDetails.unbookmarkAction)
        : t(translations.grail.itemDetails.bookmarkAction)}
    </Button>
  );
}
