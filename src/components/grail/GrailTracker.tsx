import { useEffect, useLayoutEffect } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { startLoad, useGrailStatistics, useGrailStore } from '@/stores/grailStore';
import { AdvancedSearch } from './AdvancedSearch';
import { ItemGrid } from './ItemGrid';
import { ProgressSummary } from './ProgressSummary';

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
  // Narrow selectors so unrelated store updates (filters, view mode, ...) don't re-render the page
  const setCharacters = useGrailStore((state) => state.setCharacters);
  const setItems = useGrailStore((state) => state.setItems);
  const setProgress = useGrailStore((state) => state.setProgress);
  const hydrateSettings = useGrailStore((state) => state.hydrateSettings);
  const grailEthereal = useGrailStore((state) => state.settings.grailEthereal);

  const statistics = useGrailStatistics();

  // Load initial data. A layout effect is used so the loading flag is set before the first paint;
  // otherwise the empty store would briefly render the "no items" state before the spinner.
  useLayoutEffect(() => {
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

    const finishLoad = startLoad();
    loadData().finally(finishLoad);
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
      <div className="flex h-full flex-col gap-4 p-6">
        {/* Progress summary */}
        {statistics && (
          <ProgressSummary statistics={statistics} showEtherealBreakdown={grailEthereal} />
        )}

        {/* Toolbar: search, filters, sorting, grouping and view mode */}
        <AdvancedSearch />

        {/* Item Grid - full content width. This wrapper only bounds the height; the grid's own
            container is the scroll element so its virtualization can measure the viewport. */}
        <div className="-mx-4 flex min-h-0 min-w-0 flex-1 flex-col">
          <ItemGrid />
        </div>
      </div>
    </TooltipProvider>
  );
}
