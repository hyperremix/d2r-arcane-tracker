import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { WidgetStep } from './WidgetStep';

describe('WidgetStep', () => {
  const originalSettings = useGrailStore.getState().settings;
  const originalSetSettings = useGrailStore.getState().setSettings;
  const originalElectronAPI = window.electronAPI;
  const mockSetSettings = vi.fn().mockResolvedValue({ success: true });
  const toggle = vi.fn().mockResolvedValue({ success: true });
  const updateOpacity = vi.fn().mockResolvedValue({ success: true });
  const updateDisplay = vi.fn().mockResolvedValue({ success: true });

  beforeEach(() => {
    for (const mock of [mockSetSettings, toggle, updateOpacity, updateDisplay]) {
      mock.mockClear();
    }
    Object.defineProperty(window, 'electronAPI', {
      value: { widget: { toggle, updateOpacity, updateDisplay } },
      configurable: true,
      writable: true,
    });
    useGrailStore.setState((state) => ({
      setSettings: mockSetSettings,
      settings: {
        ...state.settings,
        widgetEnabled: true,
        widgetDisplay: 'overall',
        widgetOpacity: 0.9,
        widgetRunOnlyShowItems: true,
        grailEthereal: true,
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

  it('If the stored opacity is below the minimum, Then the slider shows the clamped 30%', () => {
    // Arrange
    useGrailStore.setState((state) => ({ settings: { ...state.settings, widgetOpacity: 0 } }));

    // Act
    render(<WidgetStep />);

    // Assert
    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  it('If the opacity is committed, Then it is saved and sent to the widget exactly once', async () => {
    // Arrange
    render(<WidgetStep />);
    const opacityInput = screen.getByRole('slider', { hidden: true });

    // Act
    await act(async () => {
      fireEvent.change(opacityInput, { target: { value: '0.5' } });
    });

    // Assert
    expect(mockSetSettings).toHaveBeenCalledTimes(1);
    expect(mockSetSettings).toHaveBeenCalledWith({ widgetOpacity: 0.5 }, { notifyOnError: false });
    expect(updateOpacity).toHaveBeenCalledTimes(1);
    expect(updateOpacity).toHaveBeenCalledWith(0.5);
  });

  it('If the run item list is hidden while the widget shows run-only, Then the compact default size is applied', async () => {
    // Arrange
    useGrailStore.setState((state) => ({
      settings: { ...state.settings, widgetDisplay: 'run-only' },
    }));
    render(<WidgetStep />);

    // Act
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Show Run Item List'));
    });

    // Assert
    expect(mockSetSettings).toHaveBeenCalledWith(
      {
        widgetRunOnlyShowItems: false,
        widgetSizeRunOnly: { width: 270, height: 190 },
      },
      { notifyOnError: false },
    );
    expect(updateDisplay).toHaveBeenCalledWith('run-only', expect.any(Object));
  });

  it('If the run item list is toggled in another display mode, Then the widget window is not refreshed', async () => {
    // Arrange
    render(<WidgetStep />);

    // Act
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Show Run Item List'));
    });

    // Assert
    expect(mockSetSettings).toHaveBeenCalledTimes(1);
    expect(updateDisplay).not.toHaveBeenCalled();
  });

  it('If the widget is disabled, Then the run item list switch is disabled', () => {
    // Arrange
    useGrailStore.setState((state) => ({
      settings: { ...state.settings, widgetEnabled: false },
    }));

    // Act
    render(<WidgetStep />);

    // Assert
    expect(screen.getByLabelText('Show Run Item List')).toHaveAttribute('aria-disabled', 'true');
  });

  it('When the enable switch is turned off, Then the setting is saved and the widget is closed', async () => {
    // Arrange
    render(<WidgetStep />);

    // Act
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Enable Widget'));
    });

    // Assert
    expect(mockSetSettings).toHaveBeenCalledWith(
      { widgetEnabled: false },
      { notifyOnError: false },
    );
    expect(toggle).toHaveBeenCalledWith(false, expect.any(Object));
  });
});
