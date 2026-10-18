import type { Difficulty, FarmingLocation, Item } from 'electron/types/grail';
import { Search } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageNavigation } from '@/components/runtracker/PageNavigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { translations } from '@/i18n/translations';
import { FARMING_DIFFICULTY_ORDER } from '@/lib/farming';
import { formatLevelRange } from './dropRateText';
import { FarmingItemList } from './FarmingItemList';

const LOCATIONS_PER_PAGE = 10;

interface FarmingLocationsTableProps {
  locations: FarmingLocation[];
  /** The requested items, in request order */
  items: Item[];
  onSelectItem: (itemId: string) => void;
}

interface DifficultyLocationsProps extends FarmingLocationsTableProps {
  difficulty: Difficulty;
  /** The search term, matched against location, area and item names */
  search: string;
  /** The current page (1-based) */
  page: number;
  onPageChange: (page: number) => void;
}

/**
 * Whether a location, its area or one of its items has a name containing the (lowercase) term.
 */
function matchesSearch(location: FarmingLocation, items: Item[], term: string): boolean {
  if (!term) return true;
  return (
    location.name.toLowerCase().includes(term) ||
    !!location.areaName?.toLowerCase().includes(term) ||
    location.itemIndexes.some((index) => items[index]?.name.toLowerCase().includes(term))
  );
}

/**
 * The locations of one difficulty that drop at least one missing item, most items first, each
 * with the list of those items, one page at a time.
 */
function DifficultyLocations({
  difficulty,
  locations,
  items,
  onSelectItem,
  search,
  page,
  onPageChange,
}: DifficultyLocationsProps) {
  const { t } = useTranslation();
  const term = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      locations
        .filter(
          (location) =>
            location.difficulty === difficulty &&
            location.itemIndexes.length > 0 &&
            matchesSearch(location, items, term),
        )
        .sort(
          (a, b) =>
            b.itemIndexes.length - a.itemIndexes.length ||
            b.monsterLevel.max - a.monsterLevel.max ||
            a.name.localeCompare(b.name),
        ),
    [locations, items, difficulty, term],
  );

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        {t(term ? translations.farming.locations.noMatches : translations.farming.locations.none)}
      </p>
    );
  }

  const totalPages = Math.ceil(rows.length / LOCATIONS_PER_PAGE);
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * LOCATIONS_PER_PAGE;
  const endIndex = Math.min(startIndex + LOCATIONS_PER_PAGE, rows.length);

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t(translations.farming.locations.location)}</TableHead>
            <TableHead>{t(translations.farming.locations.type)}</TableHead>
            <TableHead>{t(translations.farming.monsterLevel)}</TableHead>
            <TableHead>{t(translations.farming.locations.missingItems)}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(startIndex, endIndex).map((location) => {
            const locationItems = location.itemIndexes.flatMap((index) =>
              items[index] ? [items[index]] : [],
            );
            return (
              <TableRow key={location.id}>
                <TableCell className="align-top">
                  <div className="font-medium">{location.name}</div>
                  {location.areaName && (
                    <div className="text-muted-foreground text-xs">{location.areaName}</div>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap align-top">
                  {t(translations.farming.locationKinds[location.kind])}
                </TableCell>
                <TableCell className="whitespace-nowrap align-top">
                  {formatLevelRange(t, location.monsterLevel)}
                </TableCell>
                <TableCell className="whitespace-normal align-top">
                  <FarmingItemList
                    label={t(translations.farming.itemCount, { count: locationItems.length })}
                    items={locationItems}
                    onSelectItem={onSelectItem}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-sm">
            {t(translations.common.paginationRange, {
              start: startIndex + 1,
              end: endIndex,
              total: rows.length,
            })}
          </div>
          <PageNavigation
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Every area, super unique and boss that drops missing items, one tab per difficulty.
 */
export function FarmingLocationsTable(props: FarmingLocationsTableProps) {
  const { t } = useTranslation();
  const searchInputId = useId();
  const [difficulty, setDifficulty] = useState<Difficulty>('hell');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t(translations.farming.locations.title)}</h2>
        </CardTitle>
        <CardDescription>{t(translations.farming.locations.description)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Label htmlFor={searchInputId} className="sr-only">
            {t(translations.farming.locations.searchLabel)}
          </Label>
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id={searchInputId}
            type="search"
            placeholder={t(translations.farming.locations.searchPlaceholder)}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="flex-1"
          />
        </div>
        <Tabs
          value={difficulty}
          onValueChange={(value) => {
            setDifficulty(value as Difficulty);
            setPage(1);
          }}
        >
          <TabsList aria-label={t(translations.farming.locations.difficulty)}>
            {FARMING_DIFFICULTY_ORDER.map((tabDifficulty) => (
              <TabsTrigger key={tabDifficulty} value={tabDifficulty}>
                {t(translations.farming.difficulties[tabDifficulty])}
              </TabsTrigger>
            ))}
          </TabsList>
          {FARMING_DIFFICULTY_ORDER.map((tabDifficulty) => (
            <TabsContent key={tabDifficulty} value={tabDifficulty} className="pt-2">
              <DifficultyLocations
                {...props}
                difficulty={tabDifficulty}
                search={search}
                page={page}
                onPageChange={setPage}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
