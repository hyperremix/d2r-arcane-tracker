import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { toast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetSettingsWriteTracking, useGrailStore } from '@/stores/grailStore';
import { WidgetSettings } from './WidgetSettings';

describe('WidgetSettings', () => {
  const originalSettings = useGrailStore.getState().settings;
  const originalSetSettings = useGrailStore.getState().setSettings;
  const originalElectronAPI = window.electronAPI;
  const originalBundle = structuredClone(i18n.getResourceBundle('en', 'common'));

  afterEach(() => {
    useGrailStore.setState({ settings: originalSettings, setSettings: originalSetSettings });
    Object.defineProperty(window, 'electronAPI', {
      value: originalElectronAPI,
      configurable: true,
      writable: true,
    });
    i18n.addResourceBundle('en', 'common', originalBundle, true, true);
  });

  beforeEach(() => {
    useGrailStore.setState((state) => ({
      settings: {
        ...state.settings,
        widgetEnabled: true,
        widgetDisplay: 'overall',
        widgetOpacity: 0,
      },
    }));
  });

  it('If the stored opacity is below the minimum, Then the slider is clamped to 30%', () => {
    // Arrange
    const ui = <WidgetSettings />;

    // Act
    render(ui);

    // Assert
    const opacityInput = screen.getByRole('slider', { hidden: true });
    expect(opacityInput).toHaveAttribute('min', '0.3');
    expect(opacityInput).toHaveAttribute('max', '1');
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('Adjust widget background opacity (30% to 100%)')).toBeInTheDocument();
  });

  it('If translations are provided, Then the position hint and feature list use them', () => {
    // Arrange
    i18n.addResourceBundle(
      'en',
      'common',
      {
        settings: {
          widget: {
            positionDescription: 'tr:positionDescription',
            features: 'tr:features',
            featureAlwaysOnTop: 'tr:featureAlwaysOnTop',
            featureTransparent: 'tr:featureTransparent',
            featureDrag: 'tr:featureDrag',
            featureSnap: 'tr:featureSnap',
            featureSizePersists: 'tr:featureSizePersists',
            featureRealtime: 'tr:featureRealtime',
          },
        },
      },
      true,
      true,
    );

    // Act
    render(<WidgetSettings />);

    // Assert
    expect(screen.getByText('tr:positionDescription')).toBeInTheDocument();
    expect(screen.getByText('tr:features')).toBeInTheDocument();
    for (const key of [
      'featureAlwaysOnTop',
      'featureTransparent',
      'featureDrag',
      'featureSnap',
      'featureSizePersists',
      'featureRealtime',
    ]) {
      expect(screen.getByText(new RegExp(`tr:${key}`))).toBeInTheDocument();
    }
  });

  it('If split is stored but ethereal tracking is off, Then Reset Size resets the resolved overall mode', async () => {
    // Arrange
    const resetSize = vi
      .fn()
      .mockResolvedValue({ success: true, size: { width: 250, height: 250 } });
    Object.defineProperty(window, 'electronAPI', {
      value: { widget: { resetSize, updateDisplay: vi.fn().mockResolvedValue({ success: true }) } },
      configurable: true,
      writable: true,
    });
    // Keep the stored mode as split: the component would otherwise auto-switch it to overall
    useGrailStore.setState((state) => ({
      setSettings: vi.fn().mockResolvedValue({ success: true }),
      settings: { ...state.settings, widgetDisplay: 'split', grailEthereal: false },
    }));
    render(<WidgetSettings />);

    // Act
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reset Size' }));
    });

    // Assert
    expect(resetSize).toHaveBeenCalledTimes(1);
    expect(resetSize).toHaveBeenCalledWith('overall');
  });

  describe('If split is stored while ethereal tracking is off', () => {
    const updateSettingsFailures: readonly [string, () => Promise<unknown>][] = [
      ['rejects', () => Promise.reject(new Error('database locked'))],
      ['reports success: false', () => Promise.resolve({ success: false })],
    ];

    const spies: Array<{ mockRestore: () => void }> = [];
    let consoleError: ReturnType<typeof vi.spyOn>;

    const installElectronAPI = (
      updateSettings: () => Promise<unknown>,
      updateDisplay = vi.fn(),
    ) => {
      Object.defineProperty(window, 'electronAPI', {
        value: { grail: { updateSettings }, widget: { updateDisplay } },
        configurable: true,
        writable: true,
      });
    };

    /** Lets pending promises and the renders they trigger run, so a retry loop would show up. */
    const settle = () =>
      act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

    beforeEach(() => {
      consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      spies.push(
        consoleError,
        vi.spyOn(toast, 'error').mockImplementation(() => 'toast-id'),
      );
      resetSettingsWriteTracking();
      useGrailStore.setState((state) => ({
        settings: { ...state.settings, widgetDisplay: 'split', grailEthereal: false },
      }));
    });

    afterEach(() => {
      // Restore only these spies: restoreAllMocks would also reset sibling suites' vi.fn mocks
      for (const spy of spies.splice(0)) {
        spy.mockRestore();
      }
      resetSettingsWriteTracking();
    });

    it.each(updateSettingsFailures)(
      'When updateSettings %s, Then the auto-switch to overall is attempted once and the component settles',
      async (_name, failUpdateSettings) => {
        // Arrange
        const updateSettings = vi.fn(failUpdateSettings);
        const updateDisplay = vi.fn().mockResolvedValue({ success: true });
        installElectronAPI(updateSettings, updateDisplay);

        // Act
        render(<WidgetSettings />);
        await settle();

        // Assert
        expect(updateSettings).toHaveBeenCalledTimes(1);
        expect(updateSettings).toHaveBeenCalledWith({ widgetDisplay: 'overall' });
        expect(updateDisplay).not.toHaveBeenCalled();
        expect(useGrailStore.getState().settings.widgetDisplay).toBe('split');
      },
    );

    it('If a failed auto-switch is followed by ethereal tracking being enabled and disabled again, Then the auto-switch is attempted again', async () => {
      // Arrange
      const updateSettings = vi.fn().mockRejectedValue(new Error('database locked'));
      installElectronAPI(updateSettings);
      render(<WidgetSettings />);

      // Act
      await settle();
      act(() => {
        useGrailStore.getState().hydrateSettings({ grailEthereal: true });
      });
      act(() => {
        useGrailStore.getState().hydrateSettings({ grailEthereal: false });
      });
      await settle();

      // Assert
      expect(updateSettings).toHaveBeenCalledTimes(2);
    });

    it('If a failed auto-switch is followed by a manual display change that succeeds, Then a split mode arriving later is switched again', async () => {
      // Arrange
      const updateSettings = vi
        .fn()
        .mockRejectedValueOnce(new Error('database locked'))
        .mockResolvedValue({ success: true });
      installElectronAPI(updateSettings);
      render(<WidgetSettings />);

      // Act
      await settle();
      fireEvent.click(screen.getByRole('radio', { name: 'Run Only' }));
      await settle();
      act(() => {
        useGrailStore.getState().hydrateSettings({ widgetDisplay: 'split' });
      });
      await settle();

      // Assert
      expect(updateSettings).toHaveBeenCalledTimes(3);
      expect(updateSettings).toHaveBeenLastCalledWith({ widgetDisplay: 'overall' });
    });

    it('If the widget IPC rejects after the auto-switch was saved, Then the error is logged and not left unhandled', async () => {
      // Arrange
      const ipcError = new Error('ipc failed');
      const updateSettings = vi.fn().mockResolvedValue({ success: true });
      installElectronAPI(updateSettings, vi.fn().mockRejectedValue(ipcError));

      // Act
      render(<WidgetSettings />);
      await settle();

      // Assert
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to switch the widget display mode:',
        ipcError,
      );
    });
  });

  describe('When the widget is enabled with ethereal tracking', () => {
    const mockSetSettings = vi.fn().mockResolvedValue({ success: true });

    beforeEach(() => {
      mockSetSettings.mockClear();
      Object.defineProperty(window, 'electronAPI', {
        value: { widget: { updateDisplay: vi.fn().mockResolvedValue(undefined) } },
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
          grailEthereal: true,
        },
      }));
    });

    it('Then the enable and run item list switches are labelled', () => {
      // Arrange & Act
      render(<WidgetSettings />);

      // Assert
      expect(screen.getByLabelText('Enable Widget')).toHaveAttribute('role', 'switch');
      expect(screen.getByLabelText('Show Run Item List')).toHaveAttribute('role', 'switch');
    });

    it('Then the opacity slider is labelled', () => {
      // Arrange & Act
      render(<WidgetSettings />);

      // Assert (the thumb input stays visibility:hidden in jsdom until measured, which blanks its
      // computed role name, so verify the label association via getAllByLabelText instead)
      const slider = screen.getByRole('slider', { hidden: true });
      expect(screen.getAllByLabelText('Opacity')).toContain(slider);
    });

    it('Then display modes are exposed as a labelled radio group', () => {
      // Arrange & Act
      render(<WidgetSettings />);

      // Assert
      const group = screen.getByRole('group', { name: 'Display Mode' });
      expect(group).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Overall' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Split' })).not.toBeChecked();
      expect(screen.getByRole('radio', { name: 'All' })).not.toBeChecked();
      expect(screen.getByRole('radio', { name: 'Run Only' })).not.toBeChecked();
    });

    it('Then the enable and run item list switches are described by their help text', () => {
      // Arrange & Act
      render(<WidgetSettings />);

      // Assert
      expect(screen.getByLabelText('Enable Widget')).toHaveAccessibleDescription(
        'Show an overlay widget with grail progress',
      );
      expect(screen.getByLabelText('Show Run Item List')).toHaveAccessibleDescription(
        'In Run Only mode, show a compact text list of grail-relevant items found each run.',
      );
    });

    it('Then the display mode group is described by its help text', () => {
      // Arrange & Act
      render(<WidgetSettings />);

      // Assert
      expect(screen.getByRole('group', { name: 'Display Mode' })).toHaveAccessibleDescription(
        /Overall: Total progress only/,
      );
    });

    it('Then all display mode radios share one native radio group name (browser arrow-key navigation is not simulated by jsdom)', () => {
      // Arrange & Act
      render(<WidgetSettings />);

      // Assert
      const names = screen.getAllByRole('radio').map((radio) => radio.getAttribute('name'));
      expect(new Set(names).size).toBe(1);
      expect(names[0]).toBeTruthy();
    });

    it('Then selecting a display mode updates the setting', () => {
      // Arrange
      render(<WidgetSettings />);

      // Act
      fireEvent.click(screen.getByRole('radio', { name: 'Run Only' }));

      // Assert
      expect(mockSetSettings).toHaveBeenCalledWith({ widgetDisplay: 'run-only' });
    });

    it('If ethereal tracking is disabled, Then the split and all radios are disabled', () => {
      // Arrange
      useGrailStore.setState((state) => ({
        settings: { ...state.settings, grailEthereal: false },
      }));

      // Act
      render(<WidgetSettings />);

      // Assert
      expect(screen.getByRole('radio', { name: 'Split' })).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'All' })).toBeDisabled();
      expect(screen.getByRole('radio', { name: 'Overall' })).toBeEnabled();
    });
  });
});
