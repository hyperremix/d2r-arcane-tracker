import type { CharacterOverview } from 'electron/types/grail';
import { useEffect, useState } from 'react';
import { onMainEvent } from '@/lib/ipcEvents';

/** Loading state of a character overview. */
export type CharacterOverviewState =
  | { status: 'loading' }
  | { status: 'ready'; overview: CharacterOverview }
  | { status: 'unavailable' };

/**
 * Loads the overview of a character save and loads it again whenever the save file monitor
 * reports a change of that file.
 * @param filePath - Path of the .d2s file.
 */
export function useCharacterOverview(filePath: string): CharacterOverviewState {
  const [state, setState] = useState<CharacterOverviewState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const overview = await window.electronAPI.saveFile.getCharacterOverview(filePath);
        if (!cancelled) {
          setState(overview ? { status: 'ready', overview } : { status: 'unavailable' });
        }
      } catch {
        if (!cancelled) {
          setState({ status: 'unavailable' });
        }
      }
    };

    setState({ status: 'loading' });
    void load();
    const unsubscribe = onMainEvent('save-file-event', (event) => {
      if (event.type !== 'deleted' && event.file.path === filePath) {
        void load();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [filePath]);

  return state;
}
