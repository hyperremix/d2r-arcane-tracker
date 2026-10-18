import type { Difficulty, FarmingLocation, Item } from 'electron/types/grail';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { formatLevelRange } from './dropRateText';
import { FarmingItemList } from './FarmingItemList';

const DIFFICULTIES: Difficulty[] = ['hell', 'nightmare', 'normal'];

interface FarmingLocationsTableProps {
  locations: FarmingLocation[];
  /** The requested items, in request order */
  items: Item[];
  onSelectItem: (itemId: string) => void;
}

/**
 * The locations of one difficulty that drop at least one missing item, most items first, each
 * with the list of those items.
 */
function DifficultyLocations({
  difficulty,
  locations,
  items,
  onSelectItem,
}: FarmingLocationsTableProps & { difficulty: Difficulty }) {
  const { t } = useTranslation();
  const rows = useMemo(
    () =>
      locations
        .filter((location) => location.difficulty === difficulty && location.itemIndexes.length > 0)
        .sort(
          (a, b) =>
            b.itemIndexes.length - a.itemIndexes.length ||
            b.monsterLevel.max - a.monsterLevel.max ||
            a.name.localeCompare(b.name),
        ),
    [locations, difficulty],
  );

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">{t(translations.farming.locations.none)}</p>
    );
  }

  return (
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
        {rows.map((location) => {
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
  );
}

/**
 * Every area, super unique and boss that drops missing items, one tab per difficulty.
 */
export function FarmingLocationsTable(props: FarmingLocationsTableProps) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t(translations.farming.locations.title)}</h2>
        </CardTitle>
        <CardDescription>{t(translations.farming.locations.description)}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="hell">
          <TabsList aria-label={t(translations.farming.locations.difficulty)}>
            {DIFFICULTIES.map((difficulty) => (
              <TabsTrigger key={difficulty} value={difficulty}>
                {t(translations.farming.difficulties[difficulty])}
              </TabsTrigger>
            ))}
          </TabsList>
          {DIFFICULTIES.map((difficulty) => (
            <TabsContent key={difficulty} value={difficulty} className="pt-2">
              <DifficultyLocations {...props} difficulty={difficulty} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
