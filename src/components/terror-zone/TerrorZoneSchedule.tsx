import { AlertTriangle, RefreshCw, Settings2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageShell } from '@/components/layout/PageShell';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
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
import { formatClockDuration, formatLocalizedDate } from '@/lib/date';
import { useTerrorZoneSessionStore } from '@/stores/terrorZoneSessionStore';
import { useTerrorZoneSchedule } from './useTerrorZoneSchedule';

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

/**
 * TerrorZoneSchedule component that shows the offline terror zone schedule: the zone running now
 * with a countdown, the next zone and the upcoming zones, in the user's local time.
 * @returns {JSX.Element} The terror zone schedule page
 */
export function TerrorZoneSchedule() {
  const { t } = useTranslation();
  const { schedule, error, now } = useTerrorZoneSchedule();
  const hasChangesToApply = useTerrorZoneSessionStore((state) => state.hasChangesToApply);

  const upcoming = schedule?.slots.filter((slot) => slot.startsAt > now) ?? [];
  const [next, ...later] = upcoming;
  const current = schedule?.slots.find((slot) => slot.startsAt <= now && now < slot.endsAt);

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

      {schedule && schedule.source !== 'gameFile' && (
        <Alert variant="warning">
          <AlertTriangle aria-hidden="true" />
          <AlertDescription>
            {t(
              schedule.source === 'retailDefault'
                ? translations.terrorZone.schedule.retailDefault
                : translations.terrorZone.schedule.unusableGameFile,
            )}
          </AlertDescription>
        </Alert>
      )}

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
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card data-testid="terror-zone-current">
              <CardHeader>
                <CardTitle>{t(translations.terrorZone.schedule.current)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {current ? (
                  <>
                    <p className="font-display font-semibold text-xl">{current.zoneName}</p>
                    <p className="flex flex-wrap gap-x-3 text-muted-foreground text-sm">
                      <span>
                        {t(translations.terrorZone.schedule.endsIn, {
                          time: formatClockDuration(current.endsAt - now),
                        })}
                      </span>
                      <span>
                        {t(translations.terrorZone.schedule.until, {
                          time: formatSlotTime(current.endsAt, now),
                        })}
                      </span>
                    </p>
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
              <CardContent className="space-y-1">
                {next ? (
                  <>
                    <p className="font-display font-semibold text-xl">{next.zoneName}</p>
                    <p className="flex flex-wrap gap-x-3 text-muted-foreground text-sm">
                      <span>
                        {t(translations.terrorZone.schedule.startsIn, {
                          time: formatClockDuration(next.startsAt - now),
                        })}
                      </span>
                      <span>
                        {t(translations.terrorZone.schedule.from, {
                          time: formatSlotTime(next.startsAt, now),
                        })}
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    {t(translations.terrorZone.schedule.none)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {later.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t(translations.terrorZone.schedule.upcoming)}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t(translations.terrorZone.schedule.time)}</TableHead>
                      <TableHead>{t(translations.terrorZone.schedule.zone)}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {later.map((slot) => (
                      <TableRow key={slot.startsAt}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatSlotTime(slot.startsAt, now)}
                        </TableCell>
                        <TableCell>{slot.zoneName}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
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
