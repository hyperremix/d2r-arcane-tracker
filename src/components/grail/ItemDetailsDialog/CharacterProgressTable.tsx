import type { Character, GrailProgress, Item } from 'electron/types/grail';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

// Component for character progress table row
function CharacterProgressRow({
  character,
  progress,
  item,
}: {
  character: Character;
  progress: GrailProgress[];
  item: Item;
}) {
  const characterProgress = progress.filter(
    (p) => p.characterId === character.id && p.itemId === item.id,
  );
  const normalProgress = characterProgress.find((p) => !p.isEthereal);
  const etherealProgress = characterProgress.find((p) => p.isEthereal);

  return (
    <TableRow>
      <TableCell className="font-medium">{character.name}</TableCell>
      <TableCell className="text-muted-foreground">
        <FoundDates normalProgress={normalProgress} etherealProgress={etherealProgress} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        <DetectionMethods normalProgress={normalProgress} etherealProgress={etherealProgress} />
      </TableCell>
    </TableRow>
  );
}

// Component for character progress table
export function CharacterProgressTable({
  characters,
  progress,
  item,
}: {
  characters: Character[];
  progress: GrailProgress[];
  item: Item;
}) {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedCharacters.map((character) => (
              <CharacterProgressRow
                key={character.id}
                character={character}
                progress={progress}
                item={item}
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
    </Card>
  );
}
