import { create } from 'zustand';

/**
 * Farming advisor inputs that last for the current app session (they are not persisted), shared
 * by the farming advisor page and the item details.
 */
interface FarmingSessionState {
  /** The /players setting the drop rates use */
  players: number;
  /** Magic find in percent */
  magicFind: number;
  /** The character level for terror zones; undefined uses the highest character level */
  characterLevel: number | undefined;
  setPlayers: (players: number) => void;
  setMagicFind: (magicFind: number) => void;
  setCharacterLevel: (characterLevel: number) => void;
  /** Restores the defaults (used by tests). */
  reset: () => void;
}

const DEFAULTS = { players: 1, magicFind: 0, characterLevel: undefined };

export const useFarmingSessionStore = create<FarmingSessionState>((set) => ({
  ...DEFAULTS,
  setPlayers: (players) => set({ players }),
  setMagicFind: (magicFind) => set({ magicFind }),
  setCharacterLevel: (characterLevel) => set({ characterLevel }),
  reset: () => set(DEFAULTS),
}));
