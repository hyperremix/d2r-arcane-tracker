import type { FarmingRange } from 'electron/types/grail';
import type { TFunction } from 'i18next';
import { translations } from '@/i18n/translations';
import { toDropRateDisplay } from '@/lib/farming';

/**
 * Formats an expected number of drops per kill, e.g. "1 in 1,234" or "1.5 per kill".
 */
export function formatDropRate(t: TFunction, language: string, dropsPerKill: number): string {
  const display = toDropRateDisplay(dropsPerKill);
  return display.kind === 'oneIn'
    ? t(translations.farming.oneIn, { kills: display.kills.toLocaleString(language) })
    : t(translations.farming.perKill, { drops: display.drops.toLocaleString(language) });
}

/**
 * Formats a range of drop rates, best first; a range whose ends read the same is shown once.
 */
export function formatDropRateRange(t: TFunction, language: string, range: FarmingRange): string {
  const best = formatDropRate(t, language, range.max);
  const worst = formatDropRate(t, language, range.min);
  return best === worst ? best : t(translations.farming.dropRateRange, { best, worst });
}

/**
 * Formats a monster level range, e.g. "85" or "85–88".
 */
export function formatLevelRange(t: TFunction, range: FarmingRange): string {
  return range.min === range.max
    ? String(range.min)
    : t(translations.farming.levelRange, { min: range.min, max: range.max });
}
