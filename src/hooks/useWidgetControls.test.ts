import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { useWidgetControls } from './useWidgetControls';

describe('useWidgetControls', () => {
  const originalSettings = useGrailStore.getState().settings;
  const originalSetSettings = useGrailStore.getState().setSettings;
  const originalElectronAPI = window.electronAPI;
  const mockSetSettings = vi.fn().mockResolvedValue(undefined);
  const updateOpacity = vi.fn().mockResolvedValue({ success: true });
  const updateDisplay = vi.fn().mockResolvedValue({ success: true });

  beforeEach(() => {
    mockSetSettings.mockClear();
    updateOpacity.mockClear();
    updateDisplay.mockClear();
    Object.defineProperty(window, 'electronAPI', {
      value: { widget: { updateOpacity, updateDisplay } },
      configurable: true,
      writable: true,
    });
    useGrailStore.setState((state) => ({
      setSettings: mockSetSettings,
      settings: {
        ...state.settings,
        widgetEnabled: true,
        widgetDisplay: 'run-only',
        widgetOpacity: 0.9,
        widgetRunOnlyShowItems: true,
        grailEthereal: false,
      },
    }));
  });

  afterEach(() => {
    useGrailStore.setState({ settings: originalSettings, setSettings: originalSetSettings });
    Object.defineProperty(window, 'electronAPI', {
      value: originalElectronAPI,
      configurable: true,
      writable: true,
    });
  });

  it('When the opacity is previewed, Then the draft is shown but nothing is saved', () => {
    // Arrange
    const { result } = renderHook(() => useWidgetControls());

    // Act
    act(() => {
      result.current.previewOpacity(0.5);
    });

    // Assert
    expect(result.current.widgetOpacity).toBe(0.5);
    expect(mockSetSettings).not.toHaveBeenCalled();
    expect(updateOpacity).not.toHaveBeenCalled();
  });

  it('If the previewed opacity is below the minimum, Then it is clamped', () => {
    // Arrange
    const { result } = renderHook(() => useWidgetControls());

    // Act
    act(() => {
      result.current.previewOpacity([0]);
    });

    // Assert
    expect(result.current.widgetOpacity).toBe(0.3);
  });

  it('When the opacity is committed, Then it is saved and sent to the widget and the draft is cleared', async () => {
    // Arrange
    const { result } = renderHook(() => useWidgetControls());
    act(() => {
      result.current.previewOpacity(0.5);
    });

    // Act
    await act(async () => {
      await result.current.commitOpacity(0.5);
    });

    // Assert
    expect(mockSetSettings).toHaveBeenCalledWith({ widgetOpacity: 0.5 });
    expect(updateOpacity).toHaveBeenCalledWith(0.5);
    expect(result.current.widgetOpacity).toBe(0.9);
  });

  it('If saving the opacity fails, Then the draft is still cleared', async () => {
    // Arrange
    mockSetSettings.mockRejectedValueOnce(new Error('db locked'));
    const { result } = renderHook(() => useWidgetControls());
    act(() => {
      result.current.previewOpacity(0.5);
    });

    // Act
    await act(async () => {
      await result.current.commitOpacity(0.5).catch(() => undefined);
    });

    // Assert
    expect(updateOpacity).not.toHaveBeenCalled();
    expect(result.current.widgetOpacity).toBe(0.9);
  });

  it('If the widget renders run-only, Then toggling the item list applies the default size and refreshes the window', async () => {
    // Arrange
    const { result } = renderHook(() => useWidgetControls());

    // Act
    await act(async () => {
      await result.current.toggleRunOnlyItems(false);
    });

    // Assert
    expect(mockSetSettings).toHaveBeenCalledWith({
      widgetRunOnlyShowItems: false,
      widgetSizeRunOnly: { width: 270, height: 190 },
    });
    expect(updateDisplay).toHaveBeenCalledWith('run-only', expect.any(Object));
  });

  it('If the widget does not render run-only, Then toggling the item list does not refresh the window', async () => {
    // Arrange
    useGrailStore.setState((state) => ({
      settings: { ...state.settings, widgetDisplay: 'overall' },
    }));
    const { result } = renderHook(() => useWidgetControls());

    // Act
    await act(async () => {
      await result.current.toggleRunOnlyItems(true);
    });

    // Assert
    expect(mockSetSettings).toHaveBeenCalledTimes(1);
    expect(updateDisplay).not.toHaveBeenCalled();
  });

  it('If split is stored without ethereal tracking, Then the effective display is overall', () => {
    // Arrange
    useGrailStore.setState((state) => ({
      settings: { ...state.settings, widgetDisplay: 'split', grailEthereal: false },
    }));

    // Act
    const { result } = renderHook(() => useWidgetControls());

    // Assert
    expect(result.current.effectiveDisplay).toBe('overall');
  });

  it('If the widget is disabled, Then toggling the item list does not refresh the window', async () => {
    // Arrange
    useGrailStore.setState((state) => ({
      settings: { ...state.settings, widgetEnabled: false },
    }));
    const { result } = renderHook(() => useWidgetControls());

    // Act
    await act(async () => {
      await result.current.toggleRunOnlyItems(true);
    });

    // Assert
    expect(mockSetSettings).toHaveBeenCalledTimes(1);
    expect(updateDisplay).not.toHaveBeenCalled();
  });
});
