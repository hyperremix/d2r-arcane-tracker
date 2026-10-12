import type { Character, GrailProgress, Item } from 'electron/types/grail';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { translations } from '@/i18n/translations';
import { formatDate } from '@/lib/date';

interface PendingRemoval {
  progress: GrailProgress;
  character: Character;
}

/**
 * A find of the item by one character: a progress record with a found date.
 */
interface CharacterFind {
  progress: GrailProgress;
  foundDate: Date;
  character: Character;
}

/** Runes and other common items can be found by many characters, so long lists are paged. */
const FINDS_PER_PAGE = 5;

/**
 * Returns the finds of an item by known characters, most recent first (ties by character name).
 * Records without a found date and records of characters that no longer exist are left out.
 */
function getCharacterFinds(
  itemProgress: GrailProgress[],
  characters: Character[],
): CharacterFind[] {
  const charactersById = new Map(characters.map((character) => [character.id, character]));
  const finds: CharacterFind[] = [];
  for (const progress of itemProgress) {
    const character = charactersById.get(progress.characterId);
    if (!progress.foundDate || !character) continue;
    finds.push({ progress, foundDate: progress.foundDate, character });
  }
  return finds.sort(
    (a, b) =>
      b.foundDate.getTime() - a.foundDate.getTime() ||
      a.character.name.localeCompare(b.character.name),
  );
}

// One find in the character progress table
function CharacterFindRow({
  find: { progress, foundDate, character },
  showVersion,
  onRequestRemove,
}: {
  find: CharacterFind;
  showVersion: boolean;
  onRequestRemove: (removal: PendingRemoval) => void;
}) {
  const { t } = useTranslation();
  const version = progress.isEthereal
    ? t(translations.grail.itemDetails.ethereal)
    : t(translations.grail.itemCard.normal);
  const removeLabel = t(translations.grail.itemDetails.removeRecordLabel, {
    version,
    character: character.name,
  });

  return (
    <TableRow>
      <TableCell className="font-medium">{character.name}</TableCell>
      {showVersion && <TableCell className="text-muted-foreground">{version}</TableCell>}
      <TableCell className="text-muted-foreground">{formatDate(foundDate)}</TableCell>
      <TableCell className="text-muted-foreground">
        {progress.manuallyAdded ? t(translations.common.manual) : t(translations.common.auto)}
      </TableCell>
      <TableCell className="text-right">
        {/* Only manually added records can be removed; auto-detected ones mirror the save files */}
        {progress.manuallyAdded && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={removeLabel}
            title={removeLabel}
            onClick={() => onRequestRemove({ progress, character })}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

/**
 * Lists who found the item: one row per find, most recent first, with the version of each find
 * when the item can be both normal and ethereal. Shows a single line when nobody found it yet.
 * Manually added finds can be removed after a confirmation.
 */
export function CharacterProgressTable({
  characters,
  itemProgress,
  item,
  onRemoveProgress,
}: {
  characters: Character[];
  /** Progress records of this item. */
  itemProgress: GrailProgress[];
  item: Item;
  onRemoveProgress: (progressId: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const headingId = useId();
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | undefined>(undefined);
  const [removing, setRemoving] = useState(false);
  const [removeFailed, setRemoveFailed] = useState(false);

  const handleRequestRemove = (removal: PendingRemoval) => {
    setRemoveFailed(false);
    setPendingRemoval(removal);
  };

  const handleConfirmRemove = async () => {
    if (!pendingRemoval || removing) return;
    setRemoving(true);
    setRemoveFailed(false);
    try {
      await onRemoveProgress(pendingRemoval.progress.id);
      setPendingRemoval(undefined);
    } catch (error) {
      console.error('Failed to remove progress record:', error);
      setRemoveFailed(true);
    } finally {
      setRemoving(false);
    }
  };

  const finds = useMemo(
    () => getCharacterFinds(itemProgress, characters),
    [itemProgress, characters],
  );
  // The version only tells something when the item can be both normal and ethereal
  const showVersion = item.etherealType === 'optional';

  // Calculate pagination, clamping currentPage so it's always in range
  const totalPages = Math.max(1, Math.ceil(finds.length / FINDS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * FINDS_PER_PAGE;
  const endIndex = startIndex + FINDS_PER_PAGE;
  const paginatedFinds = finds.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <section aria-labelledby={headingId} className="grid gap-2">
      <div className="flex items-baseline gap-2">
        <h3 id={headingId} className="font-display font-semibold leading-none tracking-wide">
          {t(translations.grail.itemDetails.characterProgress)}
        </h3>
        {totalPages > 1 && (
          <span className="ml-auto text-muted-foreground text-sm">
            {t(translations.common.paginationRange, {
              start: startIndex + 1,
              end: Math.min(endIndex, finds.length),
              total: finds.length,
            })}
          </span>
        )}
      </div>
      {finds.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t(translations.grail.itemDetails.noFinds)}</p>
      ) : (
        <div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t(translations.grail.itemDetails.character)}</TableHead>
                {showVersion && <TableHead>{t(translations.grail.itemDetails.version)}</TableHead>}
                <TableHead>{t(translations.grail.itemDetails.foundDate)}</TableHead>
                <TableHead>{t(translations.grail.itemDetails.method)}</TableHead>
                <TableHead className="text-right">
                  {t(translations.grail.itemDetails.actions)}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedFinds.map((find) => (
                <CharacterFindRow
                  key={find.progress.id}
                  find={find}
                  showVersion={showVersion}
                  onRequestRemove={handleRequestRemove}
                />
              ))}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={safePage === 1}
                className="gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                {t(translations.common.previous)}
              </Button>

              <span className="text-muted-foreground text-sm">
                {t(translations.common.pagination, { current: safePage, total: totalPages })}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={safePage === totalPages}
                className="gap-2"
              >
                {t(translations.common.next)}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      <AlertDialog
        open={pendingRemoval !== undefined}
        onOpenChange={(open) => {
          if (!open && !removing) setPendingRemoval(undefined);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(translations.grail.itemDetails.removeRecordTitle)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoval &&
                t(translations.grail.itemDetails.removeRecordDescription, {
                  version: pendingRemoval.progress.isEthereal
                    ? t(translations.grail.itemDetails.ethereal)
                    : t(translations.grail.itemCard.normal),
                  item: item.name,
                  character: pendingRemoval.character.name,
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {removeFailed && (
            <p className="text-destructive text-sm" role="alert">
              {t(translations.grail.itemDetails.removeRecordError)}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>
              {t(translations.common.cancel)}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removing}
              onClick={handleConfirmRemove}
            >
              {t(translations.grail.itemDetails.remove)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
