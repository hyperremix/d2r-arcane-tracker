import { BarChart3, Grid } from 'lucide-react';
import { Suspense, useEffect, useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useGrailStatistics, useGrailStore } from '@/stores/grailStore';
import { AdvancedSearch } from './AdvancedSearch';
import { ItemGrid } from './ItemGrid';
import { ProgressBar } from './ProgressBar';
import { StatsDashboard } from './StatsDashboard';

/**
 * Loading skeleton for tab content.
 */
function TabLoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-16 rounded-lg bg-gray-200 dark:bg-gray-800" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 20 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton elements that never reorder
          <div key={`skeleton-${i}`} className="h-32 rounded-lg bg-gray-200 dark:bg-gray-800" />
        ))}
      </div>
    </div>
  );
}

/**
 * GrailTracker component that serves as the main Holy Grail tracking interface.
 * Manages loading of grail data, displays statistics, and provides tabs for item tracking and statistics views.
 * @returns {JSX.Element} The main grail tracker interface with tabs, statistics, and item grid
 */
export function GrailTracker() {
  const [activeTab, setActiveTab] = useState('tracker');
  const [isPending, startTransition] = useTransition();
  const { setCharacters, setItems, setProgress, setSettings, settings } = useGrailStore();

  const statistics = useGrailStatistics();

  const handleTabChange = (value: string) => {
    startTransition(() => {
      setActiveTab(value);
    });
  };

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load settings first
        const settingsData = await window.electronAPI?.grail.getSettings();
        if (settingsData) {
          await setSettings(settingsData);
          console.log('Loaded settings from database');
        }

        // Load characters
        const charactersData = await window.electronAPI?.grail.getCharacters();
        if (charactersData) {
          setCharacters(charactersData);
        }

        // Load items from database
        const items = await window.electronAPI?.grail.getItems();
        if (items) {
          setItems(items);
          console.log(`Loaded ${items.length} Holy Grail items from database`);

          // Enable item detection and set grail items for monitoring
          await window.electronAPI?.itemDetection.setGrailItems(items);
          await window.electronAPI?.itemDetection.enable();
        }

        // Load progress data
        const progressData = await window.electronAPI?.grail.getProgress();
        if (progressData) {
          setProgress(progressData);
          console.log(`Loaded ${progressData.length} progress entries from database`);
        }
      } catch (error) {
        console.error('Failed to load grail data:', error);
      }
    };

    loadData();
  }, [setCharacters, setItems, setProgress, setSettings]);

  return (
    <TooltipProvider>
      <div className="container mx-auto space-y-6 p-6">
        {/* Enhanced Statistics */}
        {statistics && (
          <Card>
            <CardHeader>
              <CardTitle>Progress Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <ProgressBar
                label="Total Progress"
                current={statistics.foundItems}
                total={statistics.totalItems}
                className="mb-4"
              />
              <div
                className={`grid gap-4 ${settings.grailEthereal ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3'}`}
              >
                {settings.grailEthereal ? (
                  <>
                    <div className="text-center">
                      <div className="font-bold text-2xl text-blue-600">
                        {statistics.normalItems.found}
                      </div>
                      <div className="text-gray-500 text-sm">Normal Found</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-2xl text-blue-600">
                        {statistics.etherealItems.found}
                      </div>
                      <div className="text-gray-500 text-sm">Ethereal Found</div>
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <div className="font-bold text-2xl text-blue-600">{statistics.foundItems}</div>
                    <div className="text-gray-500 text-sm">Items Found</div>
                  </div>
                )}
                <div className="text-center">
                  <div className="font-bold text-2xl text-purple-600">
                    {statistics.totalItems - statistics.foundItems}
                  </div>
                  <div className="text-gray-500 text-sm">Items Remaining</div>
                </div>
                <div className="text-center">
                  <div className="font-bold text-2xl text-green-600">
                    {statistics.completionPercentage.toFixed(1)}%
                  </div>
                  <div className="text-gray-500 text-sm">Complete</div>
                </div>
              </div>

              {/* Progress breakdown */}
              {settings.grailEthereal && (
                <div
                  className={`mt-4 grid gap-4 ${settings.grailEthereal ? 'grid-cols-2' : 'grid-cols-1'}`}
                >
                  <div>
                    <ProgressBar
                      label="Normal Items"
                      current={statistics.normalItems.found}
                      total={statistics.normalItems.total}
                      className="mb-2"
                    />
                    <div className="text-center text-gray-500 text-xs">
                      {statistics.normalItems.found}/{statistics.normalItems.total} Normal
                    </div>
                  </div>

                  <div>
                    <ProgressBar
                      label="Ethereal Items"
                      current={statistics.etherealItems.found}
                      total={statistics.etherealItems.total}
                      className="mb-2"
                    />
                    <div className="text-center text-gray-500 text-xs">
                      {statistics.etherealItems.found}/{statistics.etherealItems.total} Ethereal
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tracker" className="gap-2" disabled={isPending}>
              <Grid className="h-4 w-4" />
              Item Tracker
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2" disabled={isPending}>
              <BarChart3 className="h-4 w-4" />
              Statistics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tracker" forceMount>
            <div className={cn('space-y-6', activeTab !== 'tracker' ? 'hidden' : '')}>
              {/* Advanced Search */}
              <AdvancedSearch />

              {/* Item Grid */}
              <Suspense fallback={<TabLoadingSkeleton />}>
                <ItemGrid />
              </Suspense>
            </div>
          </TabsContent>

          <TabsContent value="stats" className="space-y-6" forceMount>
            <div className={activeTab !== 'stats' ? 'hidden' : ''}>
              <Suspense fallback={<TabLoadingSkeleton />}>
                <StatsDashboard />
              </Suspense>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
