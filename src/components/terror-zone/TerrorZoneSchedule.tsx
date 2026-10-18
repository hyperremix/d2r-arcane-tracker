import type {
  TerrorZoneScheduleSlot,
  TerrorZoneScheduleSource,
  TerrorZoneValidationResult,
} from 'electron/types/grail';
import { AlertTriangle, Crosshair, RefreshCw, Settings, Settings2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { useTerrorZoneMissingItemCounts } from '@/components/farming/useTerrorZoneMissingItemCounts';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { translations } from '@/i18n/translations';
import { formatLocalizedDate } from '@/lib/date';
import { cn } from '@/lib/utils';
import { useTerrorZoneSessionStore } from '@/stores/terrorZoneSessionStore';
import { D2RFolderPrompt } from './D2RFolderPrompt';
import { formatCountdown } from './formatCountdown';
import { useTerrorZoneSchedule } from './useTerrorZoneSchedule';

/**
 * Why the schedule is the retail one although the game file was asked for: no D2R folder is set,
 * the folder doesn't exist, it has no terror zone file, or that file can't be read.
 */
type RetailScheduleReason =
  | 'pathNotConfigured'
  | 'directoryNotFound'
  | 'gameFileNotFound'
  | 'gameFileUnreadable';

/**
 * The reason a failed validation of the D2R folder gives for the retail schedule. `unknown` and a
 * folder that now validates have no reason to show, because no advice for them would be right.
 */
function getRetailScheduleReason(
  validation: TerrorZoneValidationResult,
): RetailScheduleReason | undefined {
  if (validation.valid) return undefined;
  switch (validation.errorCode) {
    case 'pathNotConfigured':
    case 'directoryNotFound':
    case 'gameFileNotFound':
      return validation.errorCode;
    case 'invalidStructure':
    case 'corruptedFile':
      return 'gameFileUnreadable';
    default:
      return undefined;
  }
}

/**
 * Finds out why the schedule fell back to the retail defaults, by validating the D2R folder. Only
 * checked when the schedule is the retail default, and again each time it becomes the default.
 * @param source - Where the schedule was calculated from
 * @returns The reason once known, otherwise undefined
 */
function useRetailScheduleReason(
  source: TerrorZoneScheduleSource | undefined,
): RetailScheduleReason | undefined {
  const [reason, setReason] = useState<RetailScheduleReason | undefined>(undefined);
  const isRetailDefault = source === 'retailDefault';

  useEffect(() => {
    setReason(undefined);
    if (!isRetailDefault) return;
    let cancelled = false;
    window.electronAPI.terrorZone
      .validatePath()
      .then((validation) => {
        if (!cancelled) setReason(getRetailScheduleReason(validation));
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('Failed to check the D2R installation folder:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [isRetailDefault]);

  return isRetailDefault ? reason : undefined;
}

/** Warnings for a D2R folder that is set but whose terror zone file can't be used. */
const unusableFolderMessages: Record<Exclude<RetailScheduleReason, 'pathNotConfigured'>, string> = {
  directoryNotFound: translations.terrorZone.schedule.folderNotFound,
  gameFileNotFound: translations.terrorZone.schedule.gameFileNotFound,
  gameFileUnreadable: translations.terrorZone.schedule.gameFileUnreadable,
};

/**
 * Says that the D2R folder is set but its terror zone file can't be used, so the retail schedule
 * is shown, and how to fix it.
 */
function UnusableFolderWarning({
  message,
  showSettings,
}: {
  message: string;
  showSettings: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <Alert variant="warning">
      <AlertTriangle aria-hidden="true" />
      <AlertDescription className="gap-2">
        <p>{message}</p>
        {showSettings && (
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/settings')}>
            <Settings aria-hidden="true" />
            {t(translations.terrorZone.openInstallationSettings)}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Formats a time of day, with the weekday when it is not today.
 */
function formatSlotTime(timestamp: number, now: number): string {
  const isToday = new Date(timestamp).toDateString() === new Date(now).toDateString();
  return formatLocalizedDate(
    timestamp,
    undefined,
    isToday ? { timeStyle: 'short' } : { weekday: 'short', hour: 'numeric', minute: '2-digit' },
  );
}

/** Upcoming windows that start on the same day. */
interface SlotDay {
  key: string;
  label: string;
  slots: TerrorZoneScheduleSlot[];
}

/**
 * Groups windows by the local day they start on, labelled "Today", "Tomorrow" or the weekday.
 */
function groupSlotsByDay(
  slots: TerrorZoneScheduleSlot[],
  now: number,
  labels: { today: string; tomorrow: string },
): SlotDay[] {
  const today = new Date(now);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const days: SlotDay[] = [];
  for (const slot of slots) {
    const key = new Date(slot.startsAt).toDateString();
    let day = days.find((candidate) => candidate.key === key);
    if (!day) {
      const label =
        key === today.toDateString()
          ? labels.today
          : key === tomorrow.toDateString()
            ? labels.tomorrow
            : formatLocalizedDate(slot.startsAt, undefined, { weekday: 'long' });
      day = { key, label, slots: [] };
      days.push(day);
    }
    day.slots.push(slot);
  }
  return days;
}

/**
 * How many of the grail's missing items a zone's terrorized monsters can drop, as a sentence.
 * Nothing is shown without farming data or when none can drop.
 */
function MissingItemsLine({ count }: { count: number | undefined }) {
  const { t } = useTranslation();
  if (!count) return null;
  return (
    <p className="flex items-center gap-1.5 text-sm">
      <Crosshair aria-hidden="true" className="size-4 shrink-0 text-missing" />
      {t(translations.terrorZone.schedule.missingItems, { count })}
    </p>
  );
}

/**
 * The compact form of {@link MissingItemsLine} for the upcoming list: a badge whose accessible
 * name is the full sentence.
 */
function MissingItemsBadge({ count }: { count: number | undefined }) {
  const { t } = useTranslation();
  if (!count) return null;
  return (
    <Badge variant="outline">
      <Crosshair aria-hidden="true" className="text-missing" />
      <span aria-hidden="true">
        {t(translations.terrorZone.schedule.missingItemsShort, { count })}
      </span>
      <span className="sr-only">{t(translations.terrorZone.schedule.missingItems, { count })}</span>
    </Badge>
  );
}

/**
 * Explains a schedule that isn't calculated from the player's game file: a calm prompt with a note
 * when no D2R folder is set, or a warning that says what is wrong with the folder that is set.
 */
function ScheduleSourceNotice({ source }: { source: TerrorZoneScheduleSource | undefined }) {
  const { t } = useTranslation();
  const retailReason = useRetailScheduleReason(source);

  if (source === 'unusableGameFile') {
    return (
      <UnusableFolderWarning
        message={t(translations.terrorZone.schedule.unusableGameFile)}
        showSettings={false}
      />
    );
  }
  if (retailReason === undefined) return null;
  if (retailReason === 'pathNotConfigured') {
    return (
      <D2RFolderPrompt layout="inline">
        <p className="text-muted-foreground text-xs">
          {t(translations.terrorZone.schedule.retailNote)}
        </p>
      </D2RFolderPrompt>
    );
  }
  return (
    <UnusableFolderWarning
      message={t(unusableFolderMessages[retailReason])}
      showSettings={retailReason === 'directoryNotFound'}
    />
  );
}

interface UpcomingZonesProps {
  slots: TerrorZoneScheduleSlot[];
  now: number;
  missingItemCounts: Map<string, number> | undefined;
}

/**
 * The windows after the next one, grouped by day: a compact list of start time and zone.
 */
function UpcomingZones({ slots, now, missingItemCounts }: UpcomingZonesProps) {
  const { t } = useTranslation();
  const days = groupSlotsByDay(slots, now, {
    today: t(translations.common.today),
    tomorrow: t(translations.terrorZone.schedule.tomorrow),
  });

  return (
    <Card data-testid="terror-zone-upcoming">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          {t(translations.terrorZone.schedule.upcoming)}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {days.map((day) => (
          <div key={day.key} className="space-y-1">
            <h3 className="font-medium text-muted-foreground text-sm">{day.label}</h3>
            <ol className="divide-y">
              {day.slots.map((slot) => (
                <li key={slot.startsAt} className="flex items-baseline gap-4 py-2 text-sm">
                  <time
                    dateTime={new Date(slot.startsAt).toISOString()}
                    className="min-w-20 shrink-0 text-muted-foreground tabular-nums"
                  >
                    {formatLocalizedDate(slot.startsAt, undefined, { timeStyle: 'short' })}
                  </time>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{slot.zoneName}</span>
                    <MissingItemsBadge count={missingItemCounts?.get(slot.zoneId)} />
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * TerrorZoneSchedule component that shows the offline terror zone schedule: the zone running now
 * with a countdown, the next zone and the upcoming zones grouped by day, in the user's local time.
 * With the farming advisor's data it also shows how many missing grail items each zone can drop.
 * @returns {JSX.Element} The terror zone schedule page
 */
export function TerrorZoneSchedule() {
  const { t } = useTranslation();
  const { schedule, error, now } = useTerrorZoneSchedule();
  const hasChangesToApply = useTerrorZoneSessionStore((state) => state.hasChangesToApply);
  const missingItemCounts = useTerrorZoneMissingItemCounts();

  const upcoming = schedule?.slots.filter((slot) => slot.startsAt > now) ?? [];
  const [next, ...later] = upcoming;
  const current = schedule?.slots.find((slot) => slot.startsAt <= now && now < slot.endsAt);
  const hasLater = later.length > 0;

  return (
    <PageShell>
      <PageHeader
        title={t(translations.terrorZone.schedule.title)}
        description={t(translations.terrorZone.schedule.description)}
        actions={
          <Link
            to="/terror-zones/configuration"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Settings2 aria-hidden="true" />
            {t(translations.terrorZone.schedule.openConfiguration)}
          </Link>
        }
      />

      {error && (
        <Alert className="border-destructive/30 bg-destructive/10">
          <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
          <AlertDescription className="text-destructive">{error}</AlertDescription>
        </Alert>
      )}

      <ScheduleSourceNotice source={schedule?.source} />

      {schedule === undefined && !error && (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-muted-foreground">
              {t(translations.terrorZone.schedule.loading)}
            </p>
          </CardContent>
        </Card>
      )}

      {schedule && schedule.slots.length === 0 && (
        <Card>
          <CardContent>
            <p className="py-8 text-center text-muted-foreground">
              {t(translations.terrorZone.schedule.empty)}
            </p>
          </CardContent>
        </Card>
      )}

      {schedule && schedule.slots.length > 0 && (
        <div className={cn('grid items-start gap-4', hasLater && 'lg:grid-cols-2')}>
          <div className={cn('grid gap-4 md:grid-cols-2', hasLater && 'lg:grid-cols-1')}>
            <Card data-testid="terror-zone-current">
              <CardHeader>
                <CardTitle>{t(translations.terrorZone.schedule.current)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {current ? (
                  <>
                    <p className="font-display font-semibold text-xl">{current.zoneName}</p>
                    <p className="flex flex-wrap gap-x-3 text-muted-foreground text-sm">
                      <span>
                        {t(translations.terrorZone.schedule.endsIn, {
                          time: formatCountdown(current.endsAt - now),
                        })}
                      </span>
                      <span>
                        {t(translations.terrorZone.schedule.until, {
                          time: formatSlotTime(current.endsAt, now),
                        })}
                      </span>
                    </p>
                    <MissingItemsLine count={missingItemCounts?.get(current.zoneId)} />
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    {t(translations.terrorZone.schedule.none)}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card data-testid="terror-zone-next">
              <CardHeader>
                <CardTitle>{t(translations.terrorZone.schedule.next)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {next ? (
                  <>
                    <p className="font-display font-semibold text-xl">{next.zoneName}</p>
                    <p className="flex flex-wrap gap-x-3 text-muted-foreground text-sm">
                      <span>
                        {t(translations.terrorZone.schedule.startsIn, {
                          time: formatCountdown(next.startsAt - now),
                        })}
                      </span>
                      <span>
                        {t(translations.terrorZone.schedule.from, {
                          time: formatSlotTime(next.startsAt, now),
                        })}
                      </span>
                    </p>
                    <MissingItemsLine count={missingItemCounts?.get(next.zoneId)} />
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    {t(translations.terrorZone.schedule.none)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {hasLater && (
            <UpcomingZones slots={later} now={now} missingItemCounts={missingItemCounts} />
          )}
        </div>
      )}

      {schedule?.source === 'gameFile' && (
        <p className="text-muted-foreground text-xs">
          {t(translations.terrorZone.schedule.gameFileNote, {
            flags: t(translations.terrorZone.flagsValue),
          })}
        </p>
      )}

      {/* The game keeps the zones it read at startup, so a saved change needs a restart */}
      {hasChangesToApply && (
        <output aria-live="polite" className="inline-flex items-center gap-1.5 text-sm">
          <RefreshCw className="h-4 w-4 text-warning" aria-hidden="true" />
          <span className="font-medium text-warning">
            {t(translations.terrorZone.restartPending)}
          </span>
        </output>
      )}
    </PageShell>
  );
}
