import type { FarmingOverviewData, Item } from 'electron/types/grail';
import { XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemDetailsDialog } from '@/components/grail/ItemDetailsDialog';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { translations } from '@/i18n/translations';
import { getDefaultFarmingCharacterLevel, getMissingFarmingItems } from '@/lib/farming';
import { useFarmingSessionStore } from '@/stores/farmingSessionStore';
import { useGrailStore } from '@/stores/grailStore';
import { FarmingDataNotice } from './FarmingDataNotice';
import { FarmingInputs } from './FarmingInputs';
import { FarmingItemList } from './FarmingItemList';
import { FarmingLocationsTable } from './FarmingLocationsTable';
import { TerrorZoneFarming } from './TerrorZoneFarming';
import { useFarmingOverview } from './useFarmingOverview';

function FarmingOverviewContent({
  overview,
  items,
  onSelectItem,
}: {
  overview: FarmingOverviewData;
  items: Item[];
  onSelectItem: (itemId: string) => void;
}) {
  const { t } = useTranslation();
  const droppable = new Set(overview.locations.flatMap((location) => location.itemIndexes));
  const withoutSource = items.filter((_, index) => !droppable.has(index));

  return (
    <>
      <div className="space-y-1 text-sm">
        <p>{t(translations.farming.summary, { count: items.length })}</p>
        {withoutSource.length > 0 && (
          <p className="text-muted-foreground">
            {t(translations.farming.noDropSource, {
              count: withoutSource.length,
              items: withoutSource.map((item) => item.name).join(', '),
            })}
          </p>
        )}
      </div>
      <TerrorZoneFarming zones={overview.terrorZones} items={items} onSelectItem={onSelectItem} />
      <FarmingLocationsTable
        locations={overview.locations}
        items={items}
        onSelectItem={onSelectItem}
      />
    </>
  );
}

/**
 * The missing items, shown when there are no drop tables to say where they drop. Each item opens
 * its details.
 */
function MissingItems({
  items,
  onSelectItem,
}: {
  items: Item[];
  onSelectItem: (itemId: string) => void;
}) {
  const { t } = useTranslation();

  if (items.length === 0) {
    return <p className="text-muted-foreground">{t(translations.farming.noMissingItems)}</p>;
  }
  return (
    <section aria-labelledby="farming-missing-items" className="space-y-3">
      <h2 id="farming-missing-items" className="font-semibold text-lg">
        {t(translations.farming.missingItems)}
      </h2>
      <FarmingItemList
        label={t(translations.farming.summary, { count: items.length })}
        items={items}
        onSelectItem={onSelectItem}
        defaultOpen
      />
    </section>
  );
}

/**
 * The farming advisor page: where the missing grail items can drop, in the current and next
 * terror zone and in every area, super unique and boss, from the user's extracted game files.
 * Without the game files it lists the missing items and says how to get the drop data.
 * @returns {JSX.Element} The farming advisor page
 */
export function FarmingAdvisor() {
  const { t } = useTranslation();
  const items = useGrailStore((state) => state.items);
  const progress = useGrailStore((state) => state.progress);
  const characters = useGrailStore((state) => state.characters);
  const settings = useGrailStore((state) => state.settings);
  const storedCharacterLevel = useFarmingSessionStore((state) => state.characterLevel);
  const setCharacterLevel = useFarmingSessionStore((state) => state.setCharacterLevel);
  const characterLevel = storedCharacterLevel ?? getDefaultFarmingCharacterLevel(characters);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const missingItems = useMemo(
    () => getMissingFarmingItems(items, progress, settings),
    [items, progress, settings],
  );
  const { overview, error, reload } = useFarmingOverview(missingItems, characterLevel);

  return (
    <PageShell>
      <PageHeader
        title={t(translations.farming.title)}
        description={t(translations.farming.description)}
      />

      {error && (
        <Alert className="border-destructive/30 bg-destructive/10">
          <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      {overview === undefined && !error && (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-muted-foreground">
              {t(translations.farming.loading)}
            </p>
          </CardContent>
        </Card>
      )}

      {overview?.status === 'unavailable' && (
        <>
          <FarmingDataNotice unavailable={overview} onFolderSet={reload} />
          <MissingItems items={missingItems} onSelectItem={setSelectedItemId} />
        </>
      )}

      {overview?.status === 'ready' && (
        <>
          <FarmingInputs characterLevel={{ value: characterLevel, onChange: setCharacterLevel }} />
          {missingItems.length === 0 ? (
            <p className="text-muted-foreground">{t(translations.farming.noMissingItems)}</p>
          ) : (
            <FarmingOverviewContent
              overview={overview}
              items={missingItems}
              onSelectItem={setSelectedItemId}
            />
          )}
        </>
      )}

      <ItemDetailsDialog
        itemId={selectedItemId}
        open={!!selectedItemId}
        onOpenChange={(open) => !open && setSelectedItemId(null)}
      />
    </PageShell>
  );
}
