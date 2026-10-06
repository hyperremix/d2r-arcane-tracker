import type { Character, GrailProgress, Item } from 'electron/types/grail';
import { ChevronLeft, ChevronRight, Trash2, User } from 'lucide-react';
import { useMemo, useState } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { translations } from '@/i18n/translations';
import { DetectionMethods, FoundDates } from './ProgressStatusSection';

interface PendingRemoval {
  progress: GrailProgress;
  character: Character;
}

// Component for character progress table row
function CharacterProgressRow({
  character,
  progress,
  item,
  onRequestRemove,
}: {
  character: Character;
  progress: GrailProgress[];
  item: Item;
  onRequestRemove: (removal: PendingRemoval) => void;
}) {
  const { t } = useTranslation();
  const characterProgress = progress.filter(
    (p) => p.characterId === character.id && p.itemId === item.id,
  );
  const normalProgress = characterProgress.find((p) => !p.isEthereal);
  const etherealProgress = characterProgress.find((p) => p.isEthereal);
  // Only manually added records can be removed; auto-detected ones mirror the save files
  const removableProgress = characterProgress.filter((p) => p.manuallyAdded && p.foundDate);

  return (
    <TableRow>
      <TableCell className="font-medium">{character.name}</TableCell>
      <TableCell className="text-muted-foreground">
        <FoundDates normalProgress={normalProgress} etherealProgress={etherealProgress} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        <DetectionMethods normalProgress={normalProgress} etherealProgress={etherealProgress} />
      </TableCell>
      <TableCell className="text-right">
        {removableProgress.map((p) => {
          const label = t(translations.grail.itemDetails.removeRecordLabel, {
            version: p.isEthereal
              ? t(translations.grail.itemDetails.ethereal)
              : t(translations.grail.itemCard.normal),
            character: character.name,
          });
          return (
            <Button
              key={p.id}
              variant="ghost"
              size="icon"
              aria-label={label}
              title={label}
              onClick={() => onRequestRemove({ progress: p, character })}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          );
        })}
      </TableCell>
    </TableRow>
  );
}

// Component for character progress table
export function CharacterProgressTable({
  characters,
  progress,
  item,
  onRemoveProgress,
}: {
  characters: Character[];
  progress: GrailProgress[];
  item: Item;
  onRemoveProgress: (progressId: string) => Promise<void>;
}) {
  const { t } = useTranslation();
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
  const charactersPerPage = 5;

  // Sort characters by found date (most recent first)
  const sortedCharacters = useMemo(() => {
    return [...characters].sort((a, b) => {
      const aProgress = progress.filter((p) => p.characterId === a.id && p.itemId === item.id);
      const bProgress = progress.filter((p) => p.characterId === b.id && p.itemId === item.id);

      // Get the most recent found date for each character
      const aFoundDate = aProgress.reduce(
        (latest, p) => {
          if (p.foundDate && (!latest || p.foundDate > latest)) {
            return p.foundDate;
          }
          return latest;
        },
        null as Date | null,
      );

      const bFoundDate = bProgress.reduce(
        (latest, p) => {
          if (p.foundDate && (!latest || p.foundDate > latest)) {
            return p.foundDate;
          }
          return latest;
        },
        null as Date | null,
      );

      // Characters with found dates come first, sorted by most recent
      if (aFoundDate && bFoundDate) {
        return bFoundDate.getTime() - aFoundDate.getTime();
      }
      if (aFoundDate && !bFoundDate) {
        return -1;
      }
      if (!aFoundDate && bFoundDate) {
        return 1;
      }
      // If neither has a found date, sort alphabetically by name
      return a.name.localeCompare(b.name);
    });
  }, [characters, progress, item.id]);

  // Calculate pagination, clamping currentPage so it's always in range
  const totalPages = Math.max(1, Math.ceil(sortedCharacters.length / charactersPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * charactersPerPage;
  const endIndex = startIndex + charactersPerPage;
  const paginatedCharacters = sortedCharacters.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          {t(translations.grail.itemDetails.characterProgress)}
          {totalPages > 1 && (
            <span className="ml-auto font-normal text-muted-foreground text-sm">
              {t(translations.common.paginationRange, {
                start: startIndex + 1,
                end: Math.min(endIndex, sortedCharacters.length),
                total: sortedCharacters.length,
              })}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t(translations.grail.itemDetails.character)}</TableHead>
              <TableHead>{t(translations.grail.itemDetails.foundDate)}</TableHead>
              <TableHead>{t(translations.grail.itemDetails.method)}</TableHead>
              <TableHead className="text-right">
                {t(translations.grail.itemDetails.actions)}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedCharacters.map((character) => (
              <CharacterProgressRow
                key={character.id}
                character={character}
                progress={progress}
                item={item}
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
      </CardContent>

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
    </Card>
  );
}
