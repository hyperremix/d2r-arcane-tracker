import { BarChart3, Clock, Target, TrendingUp, Trophy, Users, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProgressLookup } from '@/hooks/useProgressLookup';
import { useGrailStatistics, useGrailStore } from '@/stores/grailStore';
import { ItemCard } from './ItemCard';
import { ProgressBar } from './ProgressBar';

/**
 * Formats a date as a relative time string (e.g., "2 days ago", "5 hours ago").
 * @param {Date} date - The date to format
 * @returns {string} A human-readable relative time string
 */
const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  return 'Just now';
};

/**
 * StatsDashboard component that displays comprehensive Holy Grail statistics and analytics.
 * Shows overall progress, category breakdowns, character comparisons, and recent activity.
 * @returns {JSX.Element} A dashboard with multiple statistical views and progress indicators
 */
export function StatsDashboard() {
  const stats = useGrailStatistics();
  const { items, progress, characters, selectedCharacterId } = useGrailStore();
  const progressLookup = useProgressLookup(items, progress, selectedCharacterId);

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
                <p className="font-medium text-gray-600 text-sm">Total Progress</p>
                <p className="font-bold text-2xl">
                  {stats.foundItems}/{stats.totalItems}
                </p>
                <p className="text-gray-500 text-xs">
                  {stats.completionPercentage.toFixed(1)}% complete
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
                <p className="font-medium text-gray-600 text-sm">Recent Finds</p>
                <p className="font-bold text-2xl text-green-600">{stats.recentFinds}</p>
                <p className="text-gray-500 text-xs">Last 7 days</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-600 text-sm">Current Streak</p>
                <p className="font-bold text-2xl text-blue-600">{stats.currentStreak}</p>
                <p className="text-gray-500 text-xs">Max: {stats.maxStreak} days</p>
              </div>
              <Zap className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-600 text-sm">Avg per Day</p>
                <p className="font-bold text-2xl text-purple-600">
                  {stats.averageItemsPerDay.toFixed(1)}
                </p>
                <p className="text-gray-500 text-xs">Recent average</p>
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
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.lastFind && lastFindItem ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-sm">Last Find:</span>
                <span className="font-medium text-sm">
                  {stats.lastFind.foundDate
                    ? formatTimeAgo(new Date(stats.lastFind.foundDate))
                    : 'Unknown'}
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
            <p className="text-gray-500 text-sm">No items found yet</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-2">
        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Progress by Category
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
                          +{category.recent} recent
                        </Badge>
                      )}
                    </div>
                  </div>
                  <ProgressBar
                    current={category.found}
                    total={category.total}
                    label={`${category.category} progress`}
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
                Character Comparison
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
                        <div className="font-bold">{charStat.totalFound} items</div>
                        <div className="text-gray-600 text-sm">{charStat.recentFinds} recent</div>
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
}
