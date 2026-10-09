import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_PREFERENCE_STORAGE_KEY } from '@/lib/theme';
import { useGrailStore } from '@/stores/grailStore';
import { createMainEventsMock } from '@/test/mainEventsMock';
import { useWindowBootstrap } from './useWindowBootstrap';

/**
 * Uses the real store, theme and language hooks (no module mocks): test files share one module
 * registry, so mocking this hook's dependencies would leak into the window roots' suites.
 */
describe('When useWindowBootstrap is used', () => {
  const originalElectronAPI = window.electronAPI;
  const initialGrailState = useGrailStore.getInitialState();
  const events = createMainEventsMock();
  const grail = {
    getSettings: vi.fn(),
    getCharacters: vi.fn(),
    getItems: vi.fn(),
    getProgress: vi.fn(),
  };

  beforeEach(() => {
    events.reset();
    grail.getSettings.mockReset().mockResolvedValue({ lang: 'en', grailEthereal: false });
    grail.getCharacters.mockReset().mockResolvedValue([]);
    grail.getItems.mockReset().mockResolvedValue([]);
    grail.getProgress.mockReset().mockResolvedValue([]);
    useGrailStore.setState(initialGrailState, true);
    document.documentElement.lang = '';
    Object.defineProperty(window, 'electronAPI', {
      value: { platform: 'darwin', grail, on: events.on },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    useGrailStore.setState(initialGrailState, true);
    localStorage.removeItem(THEME_PREFERENCE_STORAGE_KEY);
    Object.defineProperty(window, 'electronAPI', {
      value: originalElectronAPI,
      configurable: true,
      writable: true,
    });
  });

  it('If no options are given, Then the grail data and settings are loaded and the language is applied', async () => {
    // Arrange & Act
    const { unmount } = renderHook(() => useWindowBootstrap());

    // Assert
    await waitFor(() => expect(useGrailStore.getState().settingsHydrated).toBe(true));
    await waitFor(() => expect(useGrailStore.getState().loading).toBe(false));
    expect(grail.getItems).toHaveBeenCalledTimes(1);
    expect(document.documentElement.lang).toBe('en');
    expect(events.listenerCount('grail-progress-updated')).toBe(1);
    expect(events.listenerCount('settings-updated')).toBe(0);
    unmount();
  });

  it('If settings updates are followed, Then settings saved in another window are applied', async () => {
    // Arrange
    const { unmount } = renderHook(() => useWindowBootstrap({ followSettingsUpdates: true }));
    await waitFor(() => expect(useGrailStore.getState().loading).toBe(false));

    // Act
    act(() => {
      events.emit('settings-updated', { widgetOpacity: 0.5 });
    });

    // Assert
    expect(useGrailStore.getState().settings.widgetOpacity).toBe(0.5);
    unmount();
  });

  it('If the window re-renders and then unmounts, Then the data is loaded once and the subscriptions are removed', async () => {
    // Arrange
    const { rerender, unmount } = renderHook(() =>
      useWindowBootstrap({ followSettingsUpdates: true }),
    );
    await waitFor(() => expect(useGrailStore.getState().loading).toBe(false));

    // Act
    rerender();
    unmount();

    // Assert
    expect(grail.getSettings).toHaveBeenCalledTimes(1);
    expect(events.listenerCount('grail-progress-updated')).toBe(0);
    expect(events.listenerCount('settings-updated')).toBe(0);
  });
});
