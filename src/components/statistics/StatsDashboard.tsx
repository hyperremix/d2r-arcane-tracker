import type { LucideIcon } from 'lucide-react';
import { BarChart3, Gem, History, Layers, Trophy, Users } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildCumulativeFinds,
  buildWeeklyFinds,
  toLocalDayIndex,
} from '@/components/statistics/chartData';
import {
  findLastTrackedFind,
  summarizeRunes,
  summarizeSets,
} from '@/components/statistics/dashboardHighlights';
import { GrailProgressChart } from '@/components/statistics/GrailProgressChart';
import { StatTile } from '@/components/statistics/StatTile';
import { WeeklyFindsChart } from '@/components/statistics/WeeklyFindsChart';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress, ProgressLabel } from '@/components/ui/progress';
import { useCurrentDay } from '@/hooks/useCurrentDay';
import { translations } from '@/i18n/translations';
import { formatTimeAgo } from '@/lib/date';
import { itemCategoryLabelKeys, itemSubCategoryLabelKeys } from '@/lib/labelKeys';
import { cn } from '@/lib/utils';
import { useGrailStatistics, useGrailStore } from '@/stores/grailStore';

/**
 * Props for the SectionTitle component.
 */
interface SectionTitleProps {
  icon: LucideIcon;
  children: string;
}

/**
 * Card heading of a dashboard section, rendered as an `h2` with a decorative icon.
 * @returns {JSX.Element} The section heading
 */
function SectionTitle({ icon: Icon, children }: SectionTitleProps) {
  return (
    <CardTitle>
      <h2 className="flex items-center gap-2">
        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
        {children}
      </h2>
    </CardTitle>
  );
}

/**
 * StatsDashboard component that displays comprehensive Holy Grail statistics and analytics.
 * Shows headline statistics that stay meaningful when nothing was found recently (total progress,
 * last find while tracking, closest set and missing runes), progress over time, finds per week,
 * category breakdowns and a character comparison.
 * Memoized to prevent unnecessary re-renders when parent component updates.
 * @returns {JSX.Element} A dashboard with multiple statistical views and progress indicators
 */
export const StatsDashboard = memo(function StatsDashboard() {
  const { t, i18n } = useTranslation();
  const stats = useGrailStatistics();
  const items = useGrailStore((state) => state.items);
  const progress = useGrailStore((state) => state.progress);
  const settings = useGrailStore((state) => state.settings);
  const grailNormal = settings.grailNormal;
  const grailEthereal = settings.grailEthereal;
  // The charts end today, so recalculate them when the day rolls over
  const currentDay = useCurrentDay();

  // biome-ignore lint/correctness/useExhaustiveDependencies: currentDay only triggers a recalculation with a fresh current time
  const chartData = useMemo(() => {
    const now = new Date();
    return {
      today: toLocalDayIndex(now),
      cumulativeFinds: buildCumulativeFinds(progress, items, { grailNormal, grailEthereal }),
      weeklyFinds: buildWeeklyFinds(progress, now),
    };
  }, [progress, items, grailNormal, grailEthereal, currentDay]);

  // Headline statistics that stay meaningful when nothing was found recently
  const highlights = useMemo(() => {
    const versions = { grailNormal, grailEthereal };
    return {
      lastTrackedFind: findLastTrackedFind(items, progress, versions),
      sets: summarizeSets(items, progress, versions),
      runes: summarizeRunes(items, progress, versions),
    };
  }, [items, progress, grailNormal, grailEthereal]);
  const { lastTrackedFind, sets, runes } = highlights;
  const hasProgressPoints = chartData.cumulativeFinds.points.length > 0;
  const hasWeeklyFinds = chartData.weeklyFinds.some((week) => week.count > 0);

  // Shared stashes are not characters, so they are not compared
  const characterStats = stats.characterStats.filter(
    (charStat) => charStat.character.characterClass !== 'shared_stash',
  );

  return (
    <div className="space-y-6">
      {/* Headline statistics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t(translations.statistics.dashboard.totalProgress)}
          icon={Trophy}
          value={`${stats.foundItems}/${stats.totalItems}`}
          hint={t(translations.statistics.dashboard.complete, {
            percentage: stats.completionPercentage.toFixed(1),
          })}
        />
        <StatTile
          label={t(translations.statistics.dashboard.lastTrackedFind)}
          icon={History}
          value={
            lastTrackedFind
              ? formatTimeAgo(lastTrackedFind.foundDate, t, i18n.language)
              : t(translations.statistics.dashboard.noTrackedFindYet)
          }
          hint={
            lastTrackedFind
              ? lastTrackedFind.item.name
              : t(translations.statistics.dashboard.sinceTrackingBegan)
          }
        />
        {sets && (
          <StatTile
            label={t(translations.statistics.dashboard.closestSet)}
            icon={Layers}
            value={
              sets.closest
                ? `${sets.closest.found}/${sets.closest.total}`
                : `${sets.setCount}/${sets.setCount}`
            }
            hint={
              sets.closest
                ? sets.closest.setName
                : t(translations.statistics.dashboard.allSetsComplete)
            }
          />
        )}
        {runes && (
          <StatTile
            label={t(translations.statistics.dashboard.runesMissing)}
            icon={Gem}
            value={runes.missing}
            hint={
              runes.highestMissing
                ? t(translations.statistics.dashboard.highestMissingRune, {
                    rune: runes.highestMissing.name,
                  })
                : t(translations.statistics.dashboard.allRunesFound)
            }
          />
        )}
      </div>

      {/* Progress over time; an empty chart shrinks to one line, so the other gets the whole row */}
      <div
        className={cn(
          'grid grid-cols-1 gap-4',
          hasProgressPoints && hasWeeklyFinds && 'lg:grid-cols-2',
        )}
      >
        <GrailProgressChart
          points={chartData.cumulativeFinds.points}
          baseline={chartData.cumulativeFinds.baseline}
          today={chartData.today}
          totalItems={stats.totalItems}
        />
        <WeeklyFindsChart weeks={chartData.weeklyFinds} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2">
        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <SectionTitle icon={BarChart3}>
              {t(translations.statistics.dashboard.progressByCategory)}
            </SectionTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="space-y-6">
              {stats.categoryStats.map((category) => (
                <Progress
                  key={category.category}
                  value={category.percentage}
                  className="items-center gap-x-2 gap-y-2"
                >
                  <ProgressLabel>{t(itemCategoryLabelKeys[category.category])}</ProgressLabel>
                  {category.recent > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {t(translations.statistics.dashboard.recentBadge, {
                        count: category.recent,
                      })}
                    </Badge>
                  )}
                  <span className="ml-auto text-muted-foreground text-sm tabular-nums">
                    {t(translations.grail.progressBar.progress, {
                      current: category.found,
                      total: category.total,
                      percentage: category.percentage.toFixed(1),
                    })}
                  </span>
                </Progress>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Character Comparison */}
        {characterStats.length > 1 && (
          <Card>
            <CardHeader>
              <SectionTitle icon={Users}>
                {t(translations.statistics.dashboard.characterComparison)}
              </SectionTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {characterStats.map((charStat, index) => (
                  <li key={charStat.character.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className="font-bold text-lg text-muted-foreground tabular-nums"
                          aria-hidden="true"
                        >
                          #{index + 1}
                        </span>
                        <div>
                          <div className="font-medium">{charStat.character.name}</div>
                          <div className="text-muted-foreground text-sm">
                            {t(translations.statistics.dashboard.classLevel, {
                              characterClass: t(
                                itemSubCategoryLabelKeys[charStat.character.characterClass],
                              ),
                              level: charStat.character.level,
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold tabular-nums">
                          {t(translations.statistics.dashboard.items, {
                            count: charStat.totalFound,
                          })}
                        </div>
                        <div className="text-muted-foreground text-sm tabular-nums">
                          {t(translations.statistics.dashboard.recentLabel, {
                            count: charStat.recentFinds,
                          })}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
});
