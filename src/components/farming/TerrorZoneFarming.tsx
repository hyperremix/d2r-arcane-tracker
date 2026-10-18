import type { FarmingTerrorZone, Item, TerrorZoneScheduleSlot } from 'electron/types/grail';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { translations } from '@/i18n/translations';
import { formatClockDuration } from '@/lib/date';
import { useTerrorZoneSchedule } from '../terror-zone/useTerrorZoneSchedule';
import { formatLevelRange } from './dropRateText';
import { FarmingItemList } from './FarmingItemList';

const DIFFICULTY_ORDER = ['hell', 'nightmare', 'normal'] as const;

interface ZoneCardProps {
  title: string;
  slot: TerrorZoneScheduleSlot | undefined;
  timing: string | undefined;
  zones: FarmingTerrorZone[];
  items: Item[];
  onSelectItem: (itemId: string) => void;
  testId: string;
}

function ZoneCard({ title, slot, timing, zones, items, onSelectItem, testId }: ZoneCardProps) {
  const { t } = useTranslation();
  const zoneDrops = slot ? zones.filter((zone) => zone.zoneId === slot.zoneId) : [];
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {slot && <CardDescription>{timing}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-2">
        {slot ? (
          <>
            <p className="font-display font-semibold text-xl">{slot.zoneName}</p>
            <p className="text-muted-foreground text-sm">
              {t(translations.farming.terrorZones.itemsWhenTerrorized)}
            </p>
            {DIFFICULTY_ORDER.map((difficulty) => {
              const zone = zoneDrops.find((drop) => drop.difficulty === difficulty);
              if (!zone) return null;
              const zoneItems = zone.itemIndexes.flatMap((index) =>
                items[index] ? [items[index]] : [],
              );
              return (
                <FarmingItemList
                  key={difficulty}
                  label={t(translations.farming.terrorZones.difficultyItems, {
                    difficulty: t(translations.farming.difficulties[difficulty]),
                    count: zoneItems.length,
                    level: formatLevelRange(t, zone.monsterLevel),
                  })}
                  items={zoneItems}
                  onSelectItem={onSelectItem}
                />
              );
            })}
          </>
        ) : (
          <p className="text-muted-foreground">{t(translations.farming.terrorZones.none)}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface TerrorZoneFarmingProps {
  /** Terror zone drops from the overview; empty when the game file can't be read */
  zones: FarmingTerrorZone[];
  /** The requested items, in request order */
  items: Item[];
  onSelectItem: (itemId: string) => void;
}

/**
 * The current and the next terror zone of the offline schedule, with the missing items their
 * terrorized monsters can drop per difficulty.
 */
export function TerrorZoneFarming({ zones, items, onSelectItem }: TerrorZoneFarmingProps) {
  const { t } = useTranslation();
  const { schedule, now } = useTerrorZoneSchedule({ slotCount: 2 });
  const current = schedule?.slots.find((slot) => slot.startsAt <= now && now < slot.endsAt);
  const next = schedule?.slots.find((slot) => slot.startsAt > now);

  return (
    <section aria-labelledby="farming-terror-zones" className="space-y-3">
      <h2 id="farming-terror-zones" className="font-semibold text-lg">
        {t(translations.farming.terrorZones.title)}
      </h2>
      {zones.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t(translations.farming.terrorZones.unavailable)}
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <ZoneCard
            testId="farming-terror-zone-current"
            title={t(translations.farming.terrorZones.current)}
            slot={current}
            timing={
              current &&
              t(translations.terrorZone.schedule.endsIn, {
                time: formatClockDuration(current.endsAt - now),
              })
            }
            zones={zones}
            items={items}
            onSelectItem={onSelectItem}
          />
          <ZoneCard
            testId="farming-terror-zone-next"
            title={t(translations.farming.terrorZones.next)}
            slot={next}
            timing={
              next &&
              t(translations.terrorZone.schedule.startsIn, {
                time: formatClockDuration(next.startsAt - now),
              })
            }
            zones={zones}
            items={items}
            onSelectItem={onSelectItem}
          />
        </div>
      )}
    </section>
  );
}
