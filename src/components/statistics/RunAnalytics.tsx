import type { RunStatistics } from 'electron/types/grail';
import { Clock, Download, Target, TrendingUp, Trophy } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { translations } from '@/i18n/translations';

/**
 * RunAnalytics component that displays overall run statistics and highlights.
 * Shows aggregate metrics, efficiency details, and performance highlights.
 * @returns {JSX.Element} Run analytics dashboard with statistics
 */
export function RunAnalytics() {
  const { t } = useTranslation();
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

  // Format duration helper
  const formatDuration = useCallback((ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Format time helper
  const formatTime = useCallback((ms: number): string => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }, []);

  // Export functionality
  const exportData = useCallback(async () => {
    try {
      const csvData = [
        ['Metric', 'Value'],
        ['Total Sessions', overallStats?.totalSessions || 0],
        ['Total Runs', overallStats?.totalRuns || 0],
        ['Total Time', overallStats?.totalTime ? formatTime(overallStats.totalTime) : '0m'],
        [
          'Average Run Duration',
          overallStats?.averageRunDuration
            ? formatDuration(overallStats.averageRunDuration)
            : '0:00',
        ],
        ['Items Per Run', overallStats?.itemsPerRun.toFixed(2) || '0.00'],
      ];

      const csvContent = csvData.map((row) => row.join(',')).join('\n');

      // Use Electron dialog to save file
      const result = await window.electronAPI?.dialog.showSaveDialog({
        title: 'Export Analytics Data',
        defaultPath: 'run-analytics.csv',
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      });

      if (result && !result.canceled && result.filePath) {
        // Write file using Node.js fs (this would need to be implemented in Electron)
        console.log('Would save CSV to:', result.filePath);
        console.log('CSV content:', csvContent);
      }
    } catch (err) {
      console.error('[Analytics] Error exporting data:', err);
    }
  }, [overallStats, formatDuration, formatTime]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          <p className="text-muted-foreground">
            {t(translations.statistics.runAnalytics.loadingAnalytics)}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="text-center text-muted-foreground">
              <h3 className="mb-2 font-semibold">
                {t(translations.statistics.runAnalytics.errorLoadingAnalytics)}
              </h3>
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

  if (!overallStats) {
    return (
      <div className="flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="text-center text-muted-foreground">
              <h3 className="mb-2 font-semibold">
                {t(translations.statistics.runAnalytics.noDataAvailable)}
              </h3>
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-end gap-2">
        <Button onClick={exportData} variant="outline" size="sm">
          <Download className="h-4 w-4" />
          {t(translations.statistics.runAnalytics.exportData)}
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">
              {t(translations.statistics.runAnalytics.totalSessions)}
            </CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{overallStats.totalSessions}</div>
            <p className="text-muted-foreground text-xs">
              {t(translations.statistics.runAnalytics.totalRuns, { count: overallStats.totalRuns })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">
              {t(translations.statistics.runAnalytics.totalTime)}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{formatTime(overallStats.totalTime)}</div>
            <p className="text-muted-foreground text-xs">
              {t(translations.statistics.runAnalytics.acrossAllSessions)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">
              {t(translations.statistics.runAnalytics.avgRunDuration)}
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {formatDuration(overallStats.averageRunDuration)}
            </div>
            <p className="text-muted-foreground text-xs">
              {t(translations.statistics.runAnalytics.perRunAverage)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">
              {t(translations.statistics.runAnalytics.itemsPerRun)}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{overallStats.itemsPerRun.toFixed(2)}</div>
            <p className="text-muted-foreground text-xs">
              {t(translations.statistics.runAnalytics.averageEfficiency)}
            </p>
          </CardContent>
        </Card>
      </div>
      {/* Performance Highlights */}
      <Card>
        <CardHeader>
          <CardTitle>{t(translations.statistics.runAnalytics.performanceHighlights)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">{t(translations.statistics.runAnalytics.fastestRun)}</h4>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {formatDuration(overallStats.fastestRun.duration)}
                </Badge>
                <span className="text-muted-foreground text-sm">
                  {overallStats.fastestRun.timestamp.toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">{t(translations.statistics.runAnalytics.slowestRun)}</h4>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {formatDuration(overallStats.slowestRun.duration)}
                </Badge>
                <span className="text-muted-foreground text-sm">
                  {overallStats.slowestRun.timestamp.toLocaleDateString()}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">
                {t(translations.statistics.runAnalytics.overallEfficiency)}
              </h4>
              <Badge variant="outline">
                {t(translations.statistics.runAnalytics.itemsPerRunMetric, {
                  count: Number.parseFloat(overallStats.itemsPerRun.toFixed(2)),
                })}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
