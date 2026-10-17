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
 * Loads the offline terror zone schedule and keeps it current: the schedule is read again when the
 * window that was running ends, and every time the page is opened, so it reflects the game file
 * as saved by the terror zone configuration page.
 * @returns The schedule, the current time, and a load error if the schedule could not be read
 */
export function useTerrorZoneSchedule() {
  const { t } = useTranslation();
  const [schedule, setSchedule] = useState<TerrorZoneSchedule | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const now = useNow(true);

  const load = useCallback(async () => {
    try {
      setSchedule(await window.electronAPI.terrorZone.getSchedule(SCHEDULE_SLOT_COUNT));
      setError(undefined);
    } catch (err) {
      console.error('Failed to load the terror zone schedule:', err);
      setError(t(translations.terrorZone.schedule.loadFailed));
    }
  }, [t]);

  // The first window of a schedule is the one running when it was read
  const firstWindowEnd = schedule?.slots[0]?.endsAt;
  const isOutdated = firstWindowEnd !== undefined && now >= firstWindowEnd;
  useEffect(() => {
    if (schedule === undefined || isOutdated) {
      void load();
    }
  }, [schedule, isOutdated, load]);

  return { schedule, error, now };
}
