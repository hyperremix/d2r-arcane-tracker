import type { RunStatistics, RunTypeStats } from 'electron/types/grail';
import { Clock, Download, Target, TrendingUp, Trophy } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Interface for chart data points
 */
interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: unknown;
}

/**
 * Interface for run type chart data
 */
interface RunTypeChartData {
  name: string;
  runs: number;
  avgDuration: number;
  totalDuration: number;
  itemsFound: number;
}

/**
 * Analytics component that displays comprehensive run statistics and visualizations.
 * Shows session statistics, run duration charts, item find rates, and run type distributions.
 */
export function Analytics() {
  const [overallStats, setOverallStats] = useState<RunStatistics | null>(null);
  const [runTypeStats, setRunTypeStats] = useState<RunTypeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load analytics data
  const loadAnalyticsData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load overall statistics
      const overall = await window.electronAPI?.runTracker.getOverallStatistics();
      if (overall) {
        setOverallStats(overall);
      }

      // Load run type statistics
      const byType = await window.electronAPI?.runTracker.getStatisticsByType();
      if (byType) {
        setRunTypeStats(byType);
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

  // Prepare chart data
  const runTypeChartData = useMemo((): RunTypeChartData[] => {
    return runTypeStats.map((stat) => ({
      name: stat.runType,
      runs: stat.count,
      avgDuration: stat.averageDuration,
      totalDuration: stat.totalDuration,
      itemsFound: stat.itemsFound,
    }));
  }, [runTypeStats]);

  const runTypeDistributionData = useMemo((): ChartDataPoint[] => {
    return runTypeStats.map((stat) => ({
      name: stat.runType,
      value: stat.count,
    }));
  }, [runTypeStats]);

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

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
        ['Most Common Run Type', overallStats?.mostCommonRunType || 'N/A'],
        [''],
        ['Run Type', 'Count', 'Avg Duration', 'Total Duration', 'Items Found'],
        ...runTypeStats.map((stat) => [
          stat.runType,
          stat.count,
          formatDuration(stat.averageDuration),
          formatTime(stat.totalDuration),
          stat.itemsFound,
        ]),
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
  }, [overallStats, runTypeStats, formatDuration, formatTime]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          <p className="text-muted-foreground">Loading analytics data...</p>
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
              <h3 className="mb-2 font-semibold">Error Loading Analytics</h3>
              <p className="mb-4 text-sm">{error}</p>
              <Button onClick={loadAnalyticsData} variant="outline">
                Retry
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
              <h3 className="mb-2 font-semibold">No Data Available</h3>
              <p className="mb-4 text-sm">Start tracking runs to see analytics and statistics.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl">Run Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive statistics and visualizations of your farming runs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={exportData} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Sessions</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{overallStats.totalSessions}</div>
            <p className="text-muted-foreground text-xs">{overallStats.totalRuns} total runs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{formatTime(overallStats.totalTime)}</div>
            <p className="text-muted-foreground text-xs">Across all sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Avg Run Duration</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {formatDuration(overallStats.averageRunDuration)}
            </div>
            <p className="text-muted-foreground text-xs">Per run average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Items Per Run</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{overallStats.itemsPerRun.toFixed(2)}</div>
            <p className="text-muted-foreground text-xs">Average efficiency</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Run Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Run Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={runTypeDistributionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${((percent as number) * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {runTypeDistributionData.map((data, index) => (
                    <Cell key={`cell-${data.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Run Counts by Type */}
        <Card>
          <CardHeader>
            <CardTitle>Runs by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={runTypeChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="runs" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Average Duration by Type */}
        <Card>
          <CardHeader>
            <CardTitle>Average Duration by Run Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={runTypeChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatDuration(value as number)} />
                <Bar dataKey="avgDuration" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Items Found by Type */}
        <Card>
          <CardHeader>
            <CardTitle>Items Found by Run Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={runTypeChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="itemsFound" fill="#ffc658" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Run Statistics Table */}
      {runTypeStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed Run Type Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Run Type</th>
                    <th className="p-2 text-right">Count</th>
                    <th className="p-2 text-right">Avg Duration</th>
                    <th className="p-2 text-right">Total Duration</th>
                    <th className="p-2 text-right">Items Found</th>
                    <th className="p-2 text-right">Items/Run</th>
                  </tr>
                </thead>
                <tbody>
                  {runTypeStats.map((stat, index) => (
                    <tr key={stat.runType} className="border-b">
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          {stat.runType}
                        </div>
                      </td>
                      <td className="p-2 text-right">{stat.count}</td>
                      <td className="p-2 text-right">{formatDuration(stat.averageDuration)}</td>
                      <td className="p-2 text-right">{formatTime(stat.totalDuration)}</td>
                      <td className="p-2 text-right">{stat.itemsFound}</td>
                      <td className="p-2 text-right">
                        {(stat.itemsFound / stat.count).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Highlights */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Highlights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium">Fastest Run</h4>
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
              <h4 className="font-medium">Slowest Run</h4>
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
              <h4 className="font-medium">Most Common Run Type</h4>
              <Badge variant="outline">{overallStats.mostCommonRunType}</Badge>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Overall Efficiency</h4>
              <Badge variant="outline">{overallStats.itemsPerRun.toFixed(2)} items/run</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
