import { BarChart3, Grid, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useGrailStatistics, useGrailStore } from '@/stores/grailStore';
import { Button } from '../ui/button';
import { AdvancedSearch } from './AdvancedSearch';
import { ItemGrid } from './ItemGrid';
import { NotificationButton } from './NotificationButton';
import { ProgressBar } from './ProgressBar';
import { StatsDashboard } from './StatsDashboard';

export function GrailTracker() {
  const [activeTab, setActiveTab] = useState('tracker');
  const { setCharacters, setItems, setProgress, settings } = useGrailStore();

  const statistics = useGrailStatistics();

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
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
  }, [setCharacters, setItems, setProgress]);

  return (
    <TooltipProvider>
      <div className="container mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <img src="/logo.svg" alt="Holy Grail" className="h-12 w-12" />
            <h1 className="font-bold text-3xl">Holy Grail Tracker</h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationButton />
            <Button asChild variant="outline">
              <Link to="/settings" title="Settings">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </Button>
          </div>
        </div>

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
                <div className="text-center">
                  <div className="font-bold text-2xl text-blue-600">{statistics.foundItems}</div>
                  <div className="text-gray-500 text-sm">Items Found</div>
                </div>
                {settings.grailEthereal && (
                  <div className="text-center">
                    <div className="font-bold text-2xl text-blue-600">
                      {statistics.etherealItems.found}
                    </div>
                    <div className="text-gray-500 text-sm">Ethereal Found</div>
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
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tracker" className="gap-2">
              <Grid className="h-4 w-4" />
              Item Tracker
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Statistics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tracker" className="space-y-6">
            {/* Advanced Search */}
            <AdvancedSearch />

            {/* Item Grid */}
            <ItemGrid />
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            <StatsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
}
