import type { LucideIcon } from 'lucide-react';
import { BarChart3, Clock, Target, TrendingUp, Trophy, Users, Zap } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemCard } from '@/components/grail/ItemCard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress, ProgressLabel } from '@/components/ui/progress';
import { useCurrentDay } from '@/hooks/useCurrentDay';
import { useProgressLookup } from '@/hooks/useProgressLookup';
import { translations } from '@/i18n/translations';
import { formatTimeAgo } from '@/lib/date';
import { itemCategoryLabelKeys, itemSubCategoryLabelKeys } from '@/lib/labelKeys';
import { useGrailStatistics, useGrailStore } from '@/stores/grailStore';
import { buildCumulativeFinds, buildWeeklyFinds, toLocalDayIndex } from './chartData';
import { GrailProgressChart } from './GrailProgressChart';
import { StatTile } from './StatTile';
import { WeeklyFindsChart } from './WeeklyFindsChart';

/**
 * Card heading of a dashboard section, rendered as an `h2` with a decorative icon.
 * @returns {JSX.Element} The section heading
 */
function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
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
 * Shows headline statistics, progress over time, finds per week, category breakdowns, a character
 * comparison and recent activity.
 * Memoized to prevent unnecessary re-renders when parent component updates.
 * @returns {JSX.Element} A dashboard with multiple statistical views and progress indicators
 */
export const StatsDashboard = memo(function StatsDashboard() {
  const { t, i18n } = useTranslation();
  const stats = useGrailStatistics();
  const items = useGrailStore((state) => state.items);
  const progress = useGrailStore((state) => state.progress);
  const characters = useGrailStore((state) => state.characters);
  const settings = useGrailStore((state) => state.settings);
  const grailNormal = settings.grailNormal;
  const grailEthereal = settings.grailEthereal;
  // The charts end today, so recalculate them when the day rolls over
  const currentDay = useCurrentDay();

  const lastFindItem = useMemo(
    () => items.find((i) => i.id === stats.lastFind?.itemId),
    [items, stats.lastFind?.itemId],
  );
  // Only the last found item is shown with its progress
  const lastFindItems = useMemo(() => (lastFindItem ? [lastFindItem] : []), [lastFindItem]);
  const progressLookup = useProgressLookup(lastFindItems, progress, settings);

  // biome-ignore lint/correctness/useExhaustiveDependencies: currentDay only triggers a recalculation with a fresh current time
  const chartData = useMemo(() => {
    const now = new Date();
    return {
      today: toLocalDayIndex(now),
      cumulativeFinds: buildCumulativeFinds(progress, items, { grailNormal, grailEthereal }),
      weeklyFinds: buildWeeklyFinds(progress, now),
    };
  }, [progress, items, grailNormal, grailEthereal, currentDay]);

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
          label={t(translations.statistics.dashboard.recentFinds)}
          icon={TrendingUp}
          value={stats.recentFinds}
          hint={t(translations.statistics.dashboard.last7Days)}
        />
        <StatTile
          label={t(translations.statistics.dashboard.currentStreak)}
          icon={Zap}
          value={stats.currentStreak}
          hint={t(translations.statistics.dashboard.maxStreak, { count: stats.maxStreak })}
        />
        <StatTile
          label={t(translations.statistics.dashboard.avgPerDay)}
          icon={Target}
          value={stats.averageItemsPerDay.toFixed(1)}
          hint={t(translations.statistics.dashboard.recentAverage)}
        />
      </div>

      {/* Progress over time */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GrailProgressChart
          points={chartData.cumulativeFinds}
          today={chartData.today}
          totalItems={stats.totalItems}
        />
        <WeeklyFindsChart weeks={chartData.weeklyFinds} />
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <SectionTitle icon={Clock}>
            {t(translations.statistics.dashboard.recentActivity)}
          </SectionTitle>
        </CardHeader>
        <CardContent>
          {stats.lastFind && lastFindItem ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">
                  {t(translations.statistics.dashboard.lastFind)}
                </span>
                <span className="font-medium text-sm">
                  {stats.lastFind.foundDate
                    ? formatTimeAgo(new Date(stats.lastFind.foundDate), t, i18n.language)
                    : t(translations.common.unknown)}
                </span>
              </div>
              <ItemCard
                item={lastFindItem}
                normalProgress={progressLookup.get(lastFindItem?.id)?.normalProgress}
                etherealProgress={progressLookup.get(lastFindItem?.id)?.etherealProgress}
                characters={characters}
                viewMode="list"
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t(translations.statistics.dashboard.noItemsFoundYet)}
            </p>
          )}
        </CardContent>
      </Card>

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
