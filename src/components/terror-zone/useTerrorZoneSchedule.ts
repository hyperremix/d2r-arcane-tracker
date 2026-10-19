import type { TerrorZoneSchedule } from 'electron/types/grail';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNow } from '@/hooks/useNow';
import { translations } from '@/i18n/translations';

/**
 * How many windows are requested: the current one, the next one and the rest of the next 12 hours
 * of the 30 minute retail rotation.
 */
const SCHEDULE_SLOT_COUNT = 25;

/**
 * Options of the useTerrorZoneSchedule hook.
 */
interface UseTerrorZoneScheduleOptions {
  /** How many windows to load (defaults to the next 12 hours of the retail rotation) */
  slotCount?: number;
  /** Reads the schedule again at this interval, for views that stay open while the game file changes */
  refreshIntervalMs?: number;
}

/**
 * Loads the offline terror zone schedule and keeps it current: the schedule is read again when the
 * window that was running ends, every time the view is opened and, if asked, at an interval, so it
 * reflects the game file as saved by the terror zone configuration page.
 * @param options - How much of the schedule to load, and how often to read it again
 * @returns The schedule, the current time, a load error if the schedule could not be read, and a
 * function that reads it again
 */
export function useTerrorZoneSchedule({
  slotCount = SCHEDULE_SLOT_COUNT,
  refreshIntervalMs,
}: UseTerrorZoneScheduleOptions = {}) {
  const { t } = useTranslation();
  const [schedule, setSchedule] = useState<TerrorZoneSchedule | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const now = useNow(true);

  const load = useCallback(async () => {
    try {
      setSchedule(await window.electronAPI.terrorZone.getSchedule(slotCount));
      setError(undefined);
    } catch (err) {
      console.error('Failed to load the terror zone schedule:', err);
      setError(t(translations.terrorZone.schedule.loadFailed));
    }
  }, [slotCount, t]);

  // The first window of a schedule is the one running when it was read
  const firstWindowEnd = schedule?.slots[0]?.endsAt;
  const isOutdated = firstWindowEnd !== undefined && now >= firstWindowEnd;
  useEffect(() => {
    if (schedule === undefined || isOutdated) {
      void load();
    }
  }, [schedule, isOutdated, load]);

  useEffect(() => {
    if (refreshIntervalMs === undefined) {
      return;
    }
    const interval = setInterval(() => void load(), refreshIntervalMs);
    return () => clearInterval(interval);
  }, [refreshIntervalMs, load]);

  return { schedule, error, now, reload: load };
}
