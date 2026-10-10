import type { RunStatistics } from 'electron/types/grail';
import { Clock, Download, Target, TrendingUp, Trophy } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { RunDurationCard } from '@/components/statistics/RunDurationChart';
import { StatTile } from '@/components/statistics/StatTile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { translations } from '@/i18n/translations';
import { escapeCsvCell } from '@/lib/csv';
import { formatDuration, formatLocalizedDate, HOUR_MS } from '@/lib/date';
import { getFileName } from '@/lib/path';

/**
 * RunAnalytics component that displays overall run statistics and highlights.
 * Shows aggregate metrics, efficiency details, and performance highlights.
 * @returns {JSX.Element} Run analytics dashboard with statistics
 */
export function RunAnalytics() {
  const { t, i18n } = useTranslation();
  const [overallStats, setOverallStats] = useState<RunStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load analytics data
  const loadAnalyticsData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const overall = await window.electronAPI?.runTracker.getOverallStatistics();
      if (overall) {
        setOverallStats(overall);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      console.error('[Analytics] Error loading analytics data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadAnalyticsData();
  }, [loadAnalyticsData]);

  // Formats a total time in hours and minutes
  const formatTime = useCallback(
    (ms: number): string => {
      const hours = Math.floor(ms / HOUR_MS);
      const minutes = Math.floor((ms % HOUR_MS) / 60000);
      if (hours > 0) {
        return t(translations.statistics.runAnalytics.hoursMinutes, { hours, minutes });
      }
      return t(translations.statistics.runAnalytics.minutes, { minutes });
    },
    [t],
  );

  // Export functionality
  const exportData = useCallback(async () => {
    const analyticsT = translations.statistics.runAnalytics;
    try {
      const csvData = [
        [t(analyticsT.csvHeaders.metric), t(analyticsT.csvHeaders.value)],
        [t(analyticsT.totalSessions), overallStats?.totalSessions || 0],
        [t(analyticsT.csvHeaders.totalRuns), overallStats?.totalRuns || 0],
        [t(analyticsT.totalTime), formatTime(overallStats?.totalTime ?? 0)],
        [
          t(analyticsT.csvHeaders.averageRunDuration),
          formatDuration(overallStats?.averageRunDuration),
        ],
        [t(analyticsT.itemsPerRun), overallStats?.itemsPerRun.toFixed(2) || '0.00'],
      ];

      const csvContent = csvData.map((row) => row.map(escapeCsvCell).join(',')).join('\n');

      const result = await window.electronAPI?.dialog.showSaveDialog({
        title: t(analyticsT.exportDialogTitle),
        defaultPath: 'run-analytics.csv',
        filters: [{ name: t(analyticsT.csvFilesFilter), extensions: ['csv'] }],
      });

      if (!result || result.canceled || !result.filePath) {
        return;
      }

      await window.electronAPI.dialog.writeFile(result.filePath, csvContent);

      toast.success(t(analyticsT.exportSuccess), {
        description: t(analyticsT.exportSuccessDescription, {
          filename: getFileName(result.filePath),
        }),
      });
    } catch (err) {
      console.error('[Analytics] Error exporting data:', err);
      toast.error(t(analyticsT.exportFailed), {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  }, [overallStats, formatTime, t]);

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary motion-reduce:animate-none"
            aria-hidden="true"
          />
          <p className="text-muted-foreground">
            {t(translations.statistics.runAnalytics.loadingAnalytics)}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="text-center text-muted-foreground">
              <h2 className="mb-2 font-semibold">
                {t(translations.statistics.runAnalytics.errorLoadingAnalytics)}
              </h2>
              <p className="mb-4 text-sm">{error}</p>
              <Button onClick={loadAnalyticsData} variant="outline">
                {t(translations.common.retry)}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!overallStats || overallStats.totalRuns === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="text-center text-muted-foreground">
              <h2 className="mb-2 font-semibold">
                {t(translations.statistics.runAnalytics.noDataAvailable)}
              </h2>
              <p className="mb-4 text-sm">
                {t(translations.statistics.runAnalytics.startTrackingRuns)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-end gap-2">
        <Button onClick={exportData} variant="outline" size="sm">
          <Download className="h-4 w-4" />
          {t(translations.statistics.runAnalytics.exportData)}
        </Button>
      </div>

      {/* Headline statistics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t(translations.statistics.runAnalytics.totalSessions)}
          icon={Trophy}
          value={overallStats.totalSessions}
          hint={t(translations.statistics.runAnalytics.totalRuns, {
            count: overallStats.totalRuns,
          })}
        />
        <StatTile
          label={t(translations.statistics.runAnalytics.totalTime)}
          icon={Clock}
          value={formatTime(overallStats.totalTime)}
          hint={t(translations.statistics.runAnalytics.acrossAllSessions)}
        />
        <StatTile
          label={t(translations.statistics.runAnalytics.avgRunDuration)}
          icon={Target}
          value={formatDuration(overallStats.averageRunDuration)}
          hint={t(translations.statistics.runAnalytics.perRunAverage)}
        />
        <StatTile
          label={t(translations.statistics.runAnalytics.itemsPerRun)}
          icon={TrendingUp}
          value={overallStats.itemsPerRun.toFixed(2)}
          hint={t(translations.statistics.runAnalytics.itemsPerRunHint)}
        />
      </div>

      <RunDurationCard />

      {/* Performance Highlights (only once at least one run has been completed) */}
      {overallStats.fastestRun && overallStats.slowestRun && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{t(translations.statistics.runAnalytics.performanceHighlights)}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="font-medium">
                  {t(translations.statistics.runAnalytics.fastestRun)}
                </h3>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {formatDuration(overallStats.fastestRun.duration)}
                  </Badge>
                  <span className="text-muted-foreground text-sm">
                    {formatLocalizedDate(overallStats.fastestRun.timestamp, i18n.language)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-medium">
                  {t(translations.statistics.runAnalytics.slowestRun)}
                </h3>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {formatDuration(overallStats.slowestRun.duration)}
                  </Badge>
                  <span className="text-muted-foreground text-sm">
                    {formatLocalizedDate(overallStats.slowestRun.timestamp, i18n.language)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
