import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { translations } from '@/i18n/translations';
import { useGrailStatistics, useGrailStore } from '@/stores/grailStore';
import { AdvancedSearch } from './AdvancedSearch';
import { ItemGrid } from './ItemGrid';
import { ProgressGauge } from './ProgressGauge';

function getSettledValue<T>(result: PromiseSettledResult<T>, label: string): T | undefined {
  if (result.status === 'fulfilled') return result.value;
  console.error(`Failed to load ${label}:`, result.reason);
  return undefined;
}

/**
 * GrailTracker component that serves as the main Holy Grail tracking interface.
 * Manages loading of grail data, displays statistics, and provides item tracking interface.
 * @returns {JSX.Element} The main grail tracker interface with statistics and item grid
 */
export function GrailTracker() {
  const { t } = useTranslation();
  const { setCharacters, setItems, setProgress, hydrateSettings, settings } = useGrailStore();

  const statistics = useGrailStatistics();

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load settings first (other UI may depend on it)
        const settingsData = await window.electronAPI?.grail.getSettings();
        if (settingsData) {
          hydrateSettings(settingsData);
          console.log('Loaded settings from database');
        }

        // Load characters, items, and progress in parallel.
        // Use allSettled so a failure in one call doesn't prevent the others from applying.
        const [charactersResult, itemsResult, progressResult] = await Promise.allSettled([
          window.electronAPI?.grail.getCharacters(),
          window.electronAPI?.grail.getItems(),
          window.electronAPI?.grail.getProgress(),
        ]);

        const characters = getSettledValue(charactersResult, 'characters');
        if (characters) setCharacters(characters);

        const items = getSettledValue(itemsResult, 'items');
        if (items) {
          setItems(items);
          console.log(`Loaded ${items.length} Holy Grail items from database`);
        }

        const progress = getSettledValue(progressResult, 'progress');
        if (progress) {
          setProgress(progress);
          console.log(`Loaded ${progress.length} progress entries from database`);
        }
      } catch (error) {
        console.error('Failed to load grail data:', error);
      }
    };

    loadData();
  }, [setCharacters, setItems, setProgress, hydrateSettings]);

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
      <div className="flex h-full gap-6 p-6">
        {/* Left Sidebar - Progress Overview and Advanced Search */}
        <div className="flex w-80 shrink-0 flex-col gap-6 overflow-y-auto">
          {statistics && (
            <Card>
              <CardContent className="flex flex-col items-center gap-4">
                <ProgressGauge
                  label={t(translations.grail.tracker.totalProgress)}
                  current={statistics.foundItems}
                  total={statistics.totalItems}
                  showLabel
                  color="purple"
                />

                {/* Progress breakdown */}
                {settings.grailEthereal && (
                  <div className="flex gap-4">
                    <ProgressGauge
                      label={t(translations.grail.tracker.normalItems)}
                      current={statistics.normalItems.found}
                      total={statistics.normalItems.total}
                      showLabel
                      color="orange"
                    />
                    <ProgressGauge
                      label={t(translations.grail.tracker.etherealItems)}
                      current={statistics.etherealItems.found}
                      total={statistics.etherealItems.total}
                      showLabel
                      color="blue"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Advanced Search */}
          <AdvancedSearch />
        </div>

        {/* Right Content - Item Grid */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
          <ItemGrid />
        </div>
      </div>
    </TooltipProvider>
  );
}
