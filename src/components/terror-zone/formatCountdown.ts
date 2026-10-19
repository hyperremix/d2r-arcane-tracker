import { getActiveLocale } from '@/lib/date';

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

type CountdownUnit = 'hour' | 'minute' | 'second';

function formatUnit(value: number, unit: CountdownUnit, locale: string | undefined): string {
  const options: Intl.NumberFormatOptions = { style: 'unit', unit, unitDisplay: 'short' };
  try {
    return new Intl.NumberFormat(locale, options).format(value);
  } catch {
    return new Intl.NumberFormat(undefined, options).format(value);
  }
}

/**
 * Formats the time until a terror zone window starts or ends with spelled-out units, so it can't
 * be mistaken for a time of day: "45 sec" below a minute, then whole minutes ("12 min") and hours
 * ("1 hr 20 min"), rounded down.
 * @param durationMs - The time left, in milliseconds
 * @param locale - BCP 47 locale to format with (defaults to the active UI language)
 * @returns The localized duration
 */
export function formatCountdown(
  durationMs: number,
  locale: string | undefined = getActiveLocale(),
): string {
  if (durationMs < MINUTE_MS) {
    return formatUnit(Math.max(0, Math.floor(durationMs / SECOND_MS)), 'second', locale);
  }
  const totalMinutes = Math.floor(durationMs / MINUTE_MS);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return formatUnit(minutes, 'minute', locale);
  if (minutes === 0) return formatUnit(hours, 'hour', locale);
  return `${formatUnit(hours, 'hour', locale)} ${formatUnit(minutes, 'minute', locale)}`;
}
