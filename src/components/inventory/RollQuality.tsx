import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { translations } from '@/i18n/translations';
import type { ItemRollQuality, ItemStatRoll } from '@/lib/rollQuality';

/** Percent as shown: rounded down, so only a perfect stat reads 100%. */
function formatPercent(percent: number): number {
  return Math.floor(percent);
}

interface RollQualityBadgeProps {
  rollQuality: ItemRollQuality;
}

/** Overall roll quality of an item: "Perfect roll", the percent, or "Not rated". */
export function RollQualityBadge({ rollQuality }: RollQualityBadgeProps) {
  const { t } = useTranslation();

  if (rollQuality.isPerfect) {
    return <Badge className="shrink-0">{t(translations.rollQuality.perfect)}</Badge>;
  }

  return (
    <Badge variant="outline" className="shrink-0">
      {rollQuality.percent === undefined
        ? t(translations.rollQuality.notRated)
        : t(translations.rollQuality.percent, { percent: formatPercent(rollQuality.percent) })}
    </Badge>
  );
}

function StatRollLine({ stat }: { stat: ItemStatRoll }) {
  const { t } = useTranslation();

  return (
    <li className="flex items-baseline justify-between gap-3">
      <span>
        {stat.description ?? t(translations.rollQuality.variableStat)}{' '}
        <span className="text-muted-foreground text-xs">
          ({t(translations.rollQuality.statRange, { min: stat.min, max: stat.max })})
        </span>
      </span>
      <span className="shrink-0 tabular-nums">
        {stat.percent === undefined
          ? t(translations.rollQuality.notRated)
          : t(translations.rollQuality.percent, { percent: formatPercent(stat.percent) })}
      </span>
    </li>
  );
}

interface RollQualityDetailsProps {
  rollQuality: ItemRollQuality;
}

/**
 * Roll quality of a unique or set item: the overall rating, then each variable stat with its
 * range and where the rolled value sits in it.
 */
export function RollQualityDetails({ rollQuality }: RollQualityDetailsProps) {
  const { t } = useTranslation();

  return (
    <section className="space-y-1 border-t pt-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">{t(translations.rollQuality.label)}</h3>
        <RollQualityBadge rollQuality={rollQuality} />
      </div>
      <ul className="space-y-0.5">
        {rollQuality.stats.map((stat, index) => (
          // The game data can list the same property twice, so the index keeps keys unique
          <StatRollLine key={`${stat.propertyCode}-${index}`} stat={stat} />
        ))}
      </ul>
      {rollQuality.unratedCount > 0 && (
        <p className="text-muted-foreground text-xs">
          {t(translations.rollQuality.unrated, { count: rollQuality.unratedCount })}
        </p>
      )}
    </section>
  );
}
