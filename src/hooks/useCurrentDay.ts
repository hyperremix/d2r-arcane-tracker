import { useEffect, useState } from 'react';

/**
 * Identifies the local calendar day of a date, so the value changes exactly when the day does.
 */
const toDayKey = (date: Date): string =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/**
 * Returns a key for the current local calendar day that changes when the day rolls over, so
 * values memoized on the current date (recent finds, streaks) can be refreshed after midnight in
 * a window that stays open. A single timer is scheduled for the next local midnight and cleared
 * on unmount; it does not tick otherwise, so it causes no re-renders within a day.
 * @returns A key unique to the current local day
 */
export function useCurrentDay(): string {
  const [day, setDay] = useState(() => toDayKey(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const scheduleNextMidnight = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(() => {
        setDay(toDayKey(new Date()));
        scheduleNextMidnight();
      }, nextMidnight.getTime() - now.getTime());
    };

    // The day may have changed between the first render and this effect
    setDay(toDayKey(new Date()));
    scheduleNextMidnight();
    return () => clearTimeout(timer);
  }, []);

  return day;
}
