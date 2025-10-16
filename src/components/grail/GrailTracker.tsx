import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useGrailStatistics, useGrailStore } from '@/stores/grailStore';
import { AdvancedSearch } from './AdvancedSearch';
import { ItemGrid } from './ItemGrid';
import { ProgressGauge } from './ProgressGauge';

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
      <div className="p-6">
        <div className="flex gap-6">
          {/* Left Sidebar - Progress Overview */}
          <div className="w-50 shrink-0">
            {statistics && (
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle>Progress Overview</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                  <ProgressGauge
                    label="Total Progress"
                    current={statistics.foundItems}
                    total={statistics.totalItems}
                    showLabel
                    color="purple"
                  />

                  {/* Progress breakdown */}
                  {settings.grailEthereal && (
                    <>
                      <ProgressGauge
                        label="Normal Items"
                        current={statistics.normalItems.found}
                        total={statistics.normalItems.total}
                        showLabel
                        color="orange"
                      />
                      <ProgressGauge
                        label="Ethereal Items"
                        current={statistics.etherealItems.found}
                        total={statistics.etherealItems.total}
                        showLabel
                        color="blue"
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Content - Advanced Search and Item Grid */}
          <div className="min-w-0 flex-1 space-y-6">
            {/* Advanced Search */}
            <AdvancedSearch />

            {/* Item Grid */}
            <ItemGrid />
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
