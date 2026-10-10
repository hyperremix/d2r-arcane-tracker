import { create } from 'zustand';

/**
 * Terror zone state that lasts for the current app session (it is not persisted).
 */
interface TerrorZoneSessionState {
  /** Whether the game file was changed in this session, so D2R needs a restart to pick it up. */
  hasChangesToApply: boolean;
  /** Records that the game file was written in this session. */
  markChangesToApply: () => void;
  /** Clears the flag (used by tests). */
  reset: () => void;
}

/**
 * Remembers across page navigation that terror zone changes were saved in this app session.
 */
export const useTerrorZoneSessionStore = create<TerrorZoneSessionState>((set) => ({
  hasChangesToApply: false,
  markChangesToApply: () => set({ hasChangesToApply: true }),
  reset: () => set({ hasChangesToApply: false }),
}));
