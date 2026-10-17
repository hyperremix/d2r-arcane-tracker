import { useTranslation } from 'react-i18next';
import { useTerrorZoneSchedule } from '@/components/terror-zone/useTerrorZoneSchedule';
import { translations } from '@/i18n/translations';
import { formatClockDuration, formatTime } from '@/lib/date';

/**
 * The current window and the three after it are shown.
 */
const WIDGET_SLOT_COUNT = 4;

/**
 * The widget stays open while the terror zone configuration is saved in the main window, so it
 * reads the schedule again at this interval.
 */
const REFRESH_INTERVAL_MS = 60_000;

/**
 * TerrorZoneDisplay component that shows the offline terror zone schedule in the widget: the zone
 * running now with a countdown, and the next zones with their start time in local time.
 */
export function TerrorZoneDisplay() {
  const { t } = useTranslation();
  const { schedule, error, now } = useTerrorZoneSchedule({
    slotCount: WIDGET_SLOT_COUNT,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
  });

  if (!schedule) {
    return <p className="text-sm text-white">{error ?? t(translations.common.loading)}</p>;
  }

  const current = schedule.slots.find((slot) => slot.startsAt <= now && now < slot.endsAt);
  const upcoming = schedule.slots
    .filter((slot) => slot.startsAt > now)
    .slice(0, WIDGET_SLOT_COUNT - 1);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3 overflow-hidden px-4">
      {/* Top: the running zone above the dominant countdown */}
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-white/85 text-xs">{t(translations.terrorZone.schedule.current)}</p>
        {current ? (
          <>
            <p
              data-testid="widget-terror-zone-current"
              title={current.zoneName}
              className="line-clamp-2 font-semibold text-base text-white"
            >
              {current.zoneName}
            </p>
            <p className="font-mono font-semibold text-3xl text-white tabular-nums leading-none">
              <span className="sr-only">{t(translations.widget.endsIn)} </span>
              {formatClockDuration(current.endsAt - now)}
            </p>
          </>
        ) : (
          <p className="text-sm text-white/70">{t(translations.terrorZone.schedule.none)}</p>
        )}
      </div>

      {/* Bottom: the zones that follow */}
      {upcoming.length > 0 && (
        <div className="flex min-h-0 flex-col gap-1 overflow-hidden">
          <p className="font-bold text-white/85 text-xs">
            {t(translations.terrorZone.schedule.upcoming)}
          </p>
          <ul className="flex min-h-0 flex-col gap-1 text-white/95 text-xs">
            {upcoming.map((slot) => (
              <li key={slot.startsAt} className="grid grid-cols-[auto_1fr] gap-2">
                <span className="font-mono tabular-nums">{formatTime(slot.startsAt)}</span>
                <span className="truncate" title={slot.zoneName}>
                  {slot.zoneName}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* A failed refresh leaves the zones of the last load on screen */}
      {error && (
        <p role="alert" className="text-center text-white/70 text-xs">
          {error}
        </p>
      )}

      {/* The zones may not be the ones the player's game runs */}
      {schedule.source !== 'gameFile' && (
        <p className="text-center text-white/70 text-xs">{t(translations.widget.retailSchedule)}</p>
      )}
    </div>
  );
}
