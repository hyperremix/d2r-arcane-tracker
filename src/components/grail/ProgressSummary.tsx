import type { GrailStatistics, ItemType } from 'electron/types/grail';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { translations } from '@/i18n/translations';
import type { ProgressCount } from '@/lib/grailStatistics';
import { itemTypeLabelKeys } from '@/lib/labelKeys';
import { cn } from '@/lib/utils';
import { useGrailStore } from '@/stores/grailStore';
import { toggleValue } from './search/options';
import { useTypeProgress } from './search/useTypeProgress';

/**
 * Item type colors of the ledger segments, using the shared `--item-*` theme tokens.
 */
const segmentStyles: Record<ItemType, { fill: string; pressed: string }> = {
  unique: { fill: 'bg-item-unique', pressed: 'border-item-unique bg-item-unique/10' },
  set: { fill: 'bg-item-set', pressed: 'border-item-set bg-item-set/10' },
  rune: { fill: 'bg-item-rune', pressed: 'border-item-rune bg-item-rune/10' },
  runeword: { fill: 'bg-item-runeword', pressed: 'border-item-runeword bg-item-runeword/10' },
};

function toPercentage(found: number, total: number): number {
  return total > 0 ? (found / total) * 100 : 0;
}

/**
 * Returns the item types that are part of the grail, in quality order. Runes and runewords are
 * only included while they are tracked.
 */
function useTrackedTypes(): ItemType[] {
  const grailRunes = useGrailStore((state) => state.settings.grailRunes);
  const grailRunewords = useGrailStore((state) => state.settings.grailRunewords);
  return useMemo(
    () => [
      'unique',
      'set',
      ...(grailRunes ? (['rune'] as const) : []),
      ...(grailRunewords ? (['runeword'] as const) : []),
    ],
    [grailRunes, grailRunewords],
  );
}

/**
 * Props for the LedgerSegment component.
 */
interface LedgerSegmentProps {
  type: ItemType;
  progress: ProgressCount | undefined;
  pressed: boolean;
  /** Whether any type filter is active, so the segments that are not selected recede */
  filtering: boolean;
  onToggle: (type: ItemType) => void;
}

/**
 * One segment of the progress ledger: the type name, its found/total count and a bar filled to the
 * found share. The segment is a toggle button for the type filter. All segments are equally wide,
 * so small types such as runes keep room for their label and count; a segment only grows beyond
 * its share if its label and count need more room (`min-w-fit`).
 */
function LedgerSegment({ type, progress, pressed, filtering, onToggle }: LedgerSegmentProps) {
  const { t } = useTranslation();
  const found = progress?.found ?? 0;
  const total = progress?.total ?? 0;

  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onToggle(type)}
      className={cn(
        'flex min-w-fit flex-1 basis-0 flex-col gap-1.5 rounded-md border border-transparent px-2 py-1.5 text-left outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-safe:transition-colors',
        pressed ? segmentStyles[type].pressed : 'hover:bg-muted/60',
      )}
    >
      <span className="flex items-baseline justify-between gap-4 whitespace-nowrap text-xs">
        <span className="font-medium text-foreground">{t(itemTypeLabelKeys[type])}</span>
        {/* Plain space between label and counter keeps the accessible name readable */}{' '}
        <span className="text-muted-foreground tabular-nums">
          {found}/{total}
          {/* Extra word for screen readers; the name still starts with the visible text */}
          <span className="sr-only"> {t(translations.common.found)}</span>
        </span>
      </span>
      <span aria-hidden="true" className="block h-1.5 overflow-hidden rounded-full bg-muted">
        <span
          data-slot="ledger-fill"
          className={cn(
            'block h-full rounded-full motion-safe:transition-[width,opacity] motion-safe:duration-300',
            segmentStyles[type].fill,
            filtering && !pressed && 'opacity-40',
          )}
          style={{ width: `${toPercentage(found, total)}%` }}
        />
      </span>
    </button>
  );
}

/**
 * Props interface for the ProgressSummary component.
 */
interface ProgressSummaryProps {
  statistics: GrailStatistics;
  showEtherealBreakdown: boolean;
}

/**
 * ProgressSummary renders the grail progress ledger: the overall completion percentage and found
 * count next to one segment per tracked item type (unique, set, rune, runeword). The segments are
 * equally wide, filled to their found share in the type's quality color, and toggle the type
 * filter of the item grid. When ethereal tracking is enabled, the normal and ethereal progress are
 * listed below the segments.
 */
export function ProgressSummary({ statistics, showEtherealBreakdown }: ProgressSummaryProps) {
  const { t } = useTranslation();
  const trackedTypes = useTrackedTypes();
  const typeProgress = useTypeProgress();
  const selectedTypes = useGrailStore((state) => state.filter.types) ?? [];
  const setFilter = useGrailStore((state) => state.setFilter);

  const percentage = toPercentage(statistics.foundItems, statistics.totalItems);
  const showVersionBreakdown =
    showEtherealBreakdown && statistics.normalItems.total > 0 && statistics.etherealItems.total > 0;

  const toggleType = (type: ItemType) => setFilter({ types: toggleValue(selectedTypes, type) });

  const versionBreakdown = [
    { key: 'normal', label: t(translations.grail.tracker.normalItems), ...statistics.normalItems },
    {
      key: 'ethereal',
      label: t(translations.grail.tracker.etherealItems),
      ...statistics.etherealItems,
    },
  ];

  return (
    <section
      aria-label={t(translations.grail.tracker.progressSummary)}
      className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-1"
    >
      <div className="flex flex-col">
        <span className="font-semibold text-2xl text-foreground tabular-nums leading-tight">
          {percentage.toFixed(1)}%
        </span>
        <span className="whitespace-nowrap text-muted-foreground text-xs tabular-nums">
          {t(translations.grail.tracker.foundOfTotal, {
            found: statistics.foundItems,
            total: statistics.totalItems,
          })}
        </span>
      </div>

      <fieldset className="flex min-w-0 gap-1">
        <legend className="sr-only">{t(translations.grail.tracker.typeLedger)}</legend>
        {trackedTypes.map((type) => (
          <LedgerSegment
            key={type}
            type={type}
            progress={typeProgress[type]}
            pressed={selectedTypes.includes(type)}
            filtering={selectedTypes.length > 0}
            onToggle={toggleType}
          />
        ))}
      </fieldset>

      {showVersionBreakdown && (
        <p className="col-start-2 flex gap-3 px-2 text-muted-foreground text-xs">
          {versionBreakdown.map((version) => (
            <span key={version.key}>
              {version.label}{' '}
              <span className="text-foreground tabular-nums">
                {version.found}/{version.total}
              </span>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
