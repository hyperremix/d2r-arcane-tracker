import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useGrailStatistics, useGrailStore } from '@/stores/grailStore';
import { AdvancedSearch } from './AdvancedSearch';
import { ItemGrid } from './ItemGrid';
import { ProgressBar } from './ProgressBar';

/**
 * GrailTracker component that serves as the main Holy Grail tracking interface.
 * Manages loading of grail data, displays statistics, and provides item tracking interface.
 * @returns {JSX.Element} The main grail tracker interface with statistics and item grid
 */
export function GrailTracker() {
  const { setCharacters, setItems, setProgress, setSettings, settings } = useGrailStore();

  const statistics = useGrailStatistics();

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

  // Listen for grail progress updates from automatic detection
  useEffect(() => {
    const handleGrailProgressUpdate = async () => {
      try {
        // Reload progress data when items are auto-detected
        const progressData = await window.electronAPI?.grail.getProgress();
        if (progressData) {
          setProgress(progressData);
          console.log(`Reloaded ${progressData.length} progress entries after auto-detection`);
        }

        // Also reload characters in case new ones were created
        const charactersData = await window.electronAPI?.grail.getCharacters();
        if (charactersData) {
          setCharacters(charactersData);
        }
      } catch (error) {
        console.error('Failed to reload data after grail progress update:', error);
      }
    };

    window.ipcRenderer?.on('grail-progress-updated', handleGrailProgressUpdate);

    return () => {
      window.ipcRenderer?.off('grail-progress-updated', handleGrailProgressUpdate);
    };
  }, [setProgress, setCharacters]);

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

        {/* Advanced Search */}
        <AdvancedSearch />

        {/* Item Grid */}
        <ItemGrid />
      </div>
    </TooltipProvider>
  );
}
