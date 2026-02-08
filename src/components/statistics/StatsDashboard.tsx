import { BarChart3, Clock, Target, TrendingUp, Trophy, Users, Zap } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemCard } from '@/components/grail/ItemCard';
import { ProgressBar } from '@/components/grail/ProgressBar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProgressLookup } from '@/hooks/useProgressLookup';
import { translations } from '@/i18n/translations';
import { formatTimeAgo } from '@/lib/utils';
import { useGrailStatistics, useGrailStore } from '@/stores/grailStore';

/**
 * StatsDashboard component that displays comprehensive Holy Grail statistics and analytics.
 * Shows overall progress, category breakdowns, character comparisons, and recent activity.
 * Memoized to prevent unnecessary re-renders when parent component updates.
 * @returns {JSX.Element} A dashboard with multiple statistical views and progress indicators
 */
export const StatsDashboard = memo(function StatsDashboard() {
  const { t } = useTranslation();
  const stats = useGrailStatistics();
  const { items, progress, characters, selectedCharacterId, settings } = useGrailStore();
  const progressLookup = useProgressLookup(items, progress, settings, selectedCharacterId);

  const lastFindItem = useMemo(
    () => items.find((i) => i.id === stats.lastFind?.itemId),
    [items, stats.lastFind?.itemId],
  );

  return (
    <div className="space-y-6">
      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-600 text-sm">
                  {t(translations.statistics.dashboard.totalProgress)}
                </p>
                <p className="font-bold text-2xl">
                  {stats.foundItems}/{stats.totalItems}
                </p>
                <p className="text-gray-500 text-xs">
                  {t(translations.statistics.dashboard.complete, {
                    percentage: stats.completionPercentage.toFixed(1),
                  })}
                </p>
              </div>
              <Trophy className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-600 text-sm">
                  {t(translations.statistics.dashboard.recentFinds)}
                </p>
                <p className="font-bold text-2xl text-green-600">{stats.recentFinds}</p>
                <p className="text-gray-500 text-xs">
                  {t(translations.statistics.dashboard.last7Days)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-600 text-sm">
                  {t(translations.statistics.dashboard.currentStreak)}
                </p>
                <p className="font-bold text-2xl text-blue-600">{stats.currentStreak}</p>
                <p className="text-gray-500 text-xs">
                  {t(translations.statistics.dashboard.maxStreak, { count: stats.maxStreak })}
                </p>
              </div>
              <Zap className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-600 text-sm">
                  {t(translations.statistics.dashboard.avgPerDay)}
                </p>
                <p className="font-bold text-2xl text-purple-600">
                  {stats.averageItemsPerDay.toFixed(1)}
                </p>
                <p className="text-gray-500 text-xs">
                  {t(translations.statistics.dashboard.recentAverage)}
                </p>
              </div>
              <Target className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t(translations.statistics.dashboard.recentActivity)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.lastFind && lastFindItem ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-sm">
                  {t(translations.statistics.dashboard.lastFind)}
                </span>
                <span className="font-medium text-sm">
                  {stats.lastFind.foundDate
                    ? formatTimeAgo(new Date(stats.lastFind.foundDate))
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
            <p className="text-gray-500 text-sm">
              {t(translations.statistics.dashboard.noItemsFoundYet)}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2">
        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t(translations.statistics.dashboard.progressByCategory)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="space-y-8">
              {stats.categoryStats.map((category) => (
                <div key={category.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{category.category}</span>
                      {category.recent > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {t(translations.statistics.dashboard.recentBadge, {
                            count: category.recent,
                          })}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <ProgressBar
                    current={category.found}
                    total={category.total}
                    label={t(translations.statistics.dashboard.categoryProgress, {
                      category: category.category,
                    })}
                    className="h-4"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Character Comparison */}
        {stats.characterStats.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t(translations.statistics.dashboard.characterComparison)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.characterStats.map((charStat, index) => (
                  <div
                    key={charStat.character.id}
                    className="rounded-lg border border-gray-200 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-400 text-lg">#{index + 1}</span>
                        <div>
                          <div className="font-medium">{charStat.character.name}</div>
                          <div className="text-gray-600 text-sm">
                            {charStat.character.characterClass} • Level {charStat.character.level}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">
                          {t(translations.statistics.dashboard.items, {
                            count: charStat.totalFound,
                          })}
                        </div>
                        <div className="text-gray-600 text-sm">
                          {t(translations.statistics.dashboard.recentLabel, {
                            count: charStat.recentFinds,
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
});
