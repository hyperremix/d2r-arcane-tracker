import type { Character, GrailProgress, Item } from 'electron/types/grail';
import { Calendar, ChevronLeft, ChevronRight, Package, Shield, User } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useItemIcon } from '@/hooks/useItemIcon';
import { useProgressLookup } from '@/hooks/useProgressLookup';
import { cn } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';

interface ItemDetailsDialogProps {
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper function to format date for display
function formatDate(date: Date | undefined): string {
  if (!date) return 'Never';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// Component for item information section
function ItemInfoSection({ item }: { item: Item }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Item Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
          {/* Type */}
          <span className="font-medium">Type:</span>
          <Badge variant="secondary" className="w-fit capitalize">
            {item.type}
          </Badge>

          {/* Category */}
          <span className="font-medium">Category:</span>
          <Badge variant="secondary" className="w-fit capitalize">
            {item.category}
          </Badge>

          {/* Treasure Class */}
          <span className="font-medium">Treasure Class:</span>
          <Badge variant="secondary" className="w-fit capitalize">
            {item.treasureClass}
          </Badge>

          {/* Item Base */}
          {item.itemBase && (
            <>
              <span className="font-medium">Base:</span>
              <Badge variant="secondary" className="w-fit capitalize">
                {item.itemBase}
              </Badge>
            </>
          )}

          {/* Set Name */}
          {item.setName && (
            <>
              <span className="font-medium">Set:</span>
              <Badge variant="secondary" className="w-fit capitalize">
                {item.setName}
              </Badge>
            </>
          )}

          {/* Ethereal Type */}
          <span className="font-medium">Ethereal Type:</span>
          <Badge
            variant={
              item.etherealType === 'only'
                ? 'destructive'
                : item.etherealType === 'optional'
                  ? 'default'
                  : 'secondary'
            }
            className="w-fit capitalize"
          >
            {item.etherealType}
          </Badge>

          {/* Code */}
          {item.code && (
            <>
              <span className="font-medium">Code:</span>
              <code className="w-fit rounded bg-muted px-2 py-1 font-mono text-sm">
                {item.code}
              </code>
            </>
          )}

          {/* Link */}
          {item.link && (
            <>
              <span className="font-medium">Link:</span>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {item.link.includes('diablo2.io') ? 'View on diablo2.io' : 'View on d2runewizard'}
              </a>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Component for progress status section
function ProgressStatusSection({
  item,
  itemProgress,
}: {
  item: Item;
  itemProgress:
    | { normalFound: boolean; etherealFound: boolean; overallFound: boolean }
    | null
    | undefined;
}) {
  const isFound = itemProgress?.overallFound || false;
  const normalFound = itemProgress?.normalFound || false;
  const etherealFound = itemProgress?.etherealFound || false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Progress Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-3">
          {/* Overall Status */}
          <span className="font-medium">Overall Status:</span>
          <Badge variant={isFound ? 'default' : 'secondary'} className="w-fit capitalize">
            {isFound ? 'Found' : 'Not Found'}
          </Badge>

          {/* Normal Status */}
          {item.etherealType !== 'none' && (
            <>
              <span className="font-medium">Normal:</span>
              <Badge variant={normalFound ? 'default' : 'secondary'} className="w-fit capitalize">
                {normalFound ? 'Found' : 'Not Found'}
              </Badge>
            </>
          )}

          {/* Ethereal Status */}
          {item.etherealType !== 'none' && (
            <>
              <span className="font-medium">Ethereal:</span>
              <Badge variant={etherealFound ? 'default' : 'secondary'} className="w-fit capitalize">
                {etherealFound ? 'Found' : 'Not Found'}
              </Badge>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Component for found dates
function FoundDates({
  normalProgress,
  etherealProgress,
}: {
  normalProgress: GrailProgress | undefined;
  etherealProgress: GrailProgress | undefined;
}) {
  const hasAnyDate = normalProgress?.foundDate || etherealProgress?.foundDate;

  if (!hasAnyDate) {
    return <span className="text-xs">Never</span>;
  }

  return (
    <div className="space-y-1">
      {normalProgress?.foundDate && (
        <div className="flex items-center gap-1 text-xs">
          <Calendar className="h-3 w-3" />
          {formatDate(normalProgress.foundDate)}
        </div>
      )}
      {etherealProgress?.foundDate && (
        <div className="flex items-center gap-1 text-xs">
          <Calendar className="h-3 w-3" />
          {formatDate(etherealProgress.foundDate)}
        </div>
      )}
    </div>
  );
}

// Component for detection methods
function DetectionMethods({
  normalProgress,
  etherealProgress,
}: {
  normalProgress: GrailProgress | undefined;
  etherealProgress: GrailProgress | undefined;
}) {
  return (
    <div className="space-y-1">
      {normalProgress && (
        <span className="text-xs">{normalProgress.manuallyAdded ? 'Manual' : 'Auto'}</span>
      )}
      {etherealProgress && (
        <span className="text-xs">{etherealProgress.manuallyAdded ? 'Manual' : 'Auto'}</span>
      )}
    </div>
  );
}

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
function CharacterProgressTable({
  characters,
  progress,
  item,
}: {
  characters: Character[];
  progress: GrailProgress[];
  item: Item;
}) {
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

  // Calculate pagination
  const totalPages = Math.ceil(sortedCharacters.length / charactersPerPage);
  const startIndex = (currentPage - 1) * charactersPerPage;
  const endIndex = startIndex + charactersPerPage;
  const paginatedCharacters = sortedCharacters.slice(startIndex, endIndex);

  // Reset to page 1 when characters change
  useEffect(() => {
    setCurrentPage(1);
  }, []);

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
          Character Progress
          {totalPages > 1 && (
            <span className="ml-auto font-normal text-muted-foreground text-sm">
              {startIndex + 1}-{Math.min(endIndex, sortedCharacters.length)} of{' '}
              {sortedCharacters.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Character</TableHead>
              <TableHead>Found Date</TableHead>
              <TableHead>Method</TableHead>
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
              disabled={currentPage === 1}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <span className="text-muted-foreground text-sm">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * ItemDetailsDialog component that displays comprehensive information about a Holy Grail item.
 * Shows item metadata, icon, and per-character progress with toggle actions.
 */
export function ItemDetailsDialog({ itemId, open, onOpenChange }: ItemDetailsDialogProps) {
  const { items, progress, characters, selectedCharacterId, toggleItemFound, settings } =
    useGrailStore();

  // Find the item by ID
  const item = useMemo(() => {
    if (!itemId) return null;
    return items.find((i) => i.id === itemId) || null;
  }, [items, itemId]);

  // Get progress lookup for this item
  const progressLookup = useProgressLookup(
    item ? [item] : [],
    progress,
    settings,
    selectedCharacterId,
  );
  const itemProgress = useMemo(
    () => (item ? progressLookup.get(item.id) : null),
    [item, progressLookup],
  );

  // Get icon for the item
  const { iconUrl, isLoading } = useItemIcon(item?.name || '');

  // Handle toggle found action
  const handleToggleFound = useCallback(() => {
    if (!item || !selectedCharacterId) return;
    toggleItemFound(item.id, selectedCharacterId, true);
  }, [item, selectedCharacterId, toggleItemFound]);

  if (!item) {
    return null;
  }

  const isFound = itemProgress?.overallFound || false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex justify-between gap-4">
            {/* Item Icon */}
            {settings.showItemIcons && item.type !== 'runeword' && (
              <div className="relative h-20 w-20">
                <img
                  src={iconUrl}
                  alt={item.name}
                  className={cn('h-full w-full object-contain', isLoading && 'opacity-0')}
                  onError={(e) => {
                    if (
                      e.currentTarget.src !==
                      `${window.location.origin}/images/placeholder-item.png`
                    ) {
                      e.currentTarget.src = '/images/placeholder-item.png';
                    }
                  }}
                />
                {isLoading && (
                  <div className="absolute inset-0 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                )}
              </div>
            )}

            <div>
              <DialogTitle className="font-bold text-2xl">{item.name}</DialogTitle>
            </div>
            {settings.showItemIcons && item.type !== 'runeword' && (
              <div className="relative w-20" />
            )}
          </div>
        </DialogHeader>

        {/* Item Information and Progress Status */}
        <div className="-mx-6 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 gap-4 px-6">
            <ItemInfoSection item={item} />
            <ProgressStatusSection item={item} itemProgress={itemProgress} />
            {characters.length > 0 && (
              <CharacterProgressTable characters={characters} progress={progress} item={item} />
            )}
          </div>
        </div>

        <DialogFooter>
          {selectedCharacterId && (
            <Button onClick={handleToggleFound} variant={isFound ? 'outline' : 'default'}>
              {isFound ? 'Mark as Not Found' : 'Mark as Found'}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
