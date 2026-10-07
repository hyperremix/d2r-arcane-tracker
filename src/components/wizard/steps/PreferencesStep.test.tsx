import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { PreferencesStep } from './PreferencesStep';

describe('PreferencesStep', () => {
  const originalSettings = useGrailStore.getState().settings;

  afterEach(() => {
    useGrailStore.setState({ settings: originalSettings });
  });

  beforeEach(() => {
    useGrailStore.setState((state) => ({
      settings: { ...state.settings, widgetEnabled: true, widgetOpacity: 0.1 },
    }));
  });

  it('When rendered, Then it combines the theme, notification and widget preferences', () => {
    // Arrange
    const ui = <PreferencesStep />;

    // Act
    render(ui);

    // Assert
    expect(screen.getByRole('heading', { level: 2, name: 'Preferences' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Notification Settings' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Widget Settings' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Sound Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Enable Widget' })).toBeInTheDocument();
  });

  it('If a stored widget opacity is below the minimum, Then the slider is clamped to 30%', () => {
    // Arrange
    const ui = <PreferencesStep />;

    // Act
    render(ui);

    // Assert
    const opacityLabel = screen.getByText('Opacity', { selector: 'label' }) as HTMLLabelElement;
    const opacitySliderRoot = document.getElementById(opacityLabel.htmlFor);
    const opacityInput = opacitySliderRoot?.querySelector('input[type="range"]');
    expect(opacityInput).toHaveAttribute('min', '0.3');
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('Adjust widget background opacity (30% to 100%)')).toBeInTheDocument();
  });

  it('When rendered, Then the widget tip recommends Windowed (Fullscreen) over exclusive fullscreen', () => {
    // Arrange
    const ui = <PreferencesStep />;

    // Act
    render(ui);

    // Assert
    const widgetRegion = screen.getByRole('region', { name: 'Widget Settings' });
    expect(widgetRegion).toHaveTextContent('"Windowed (Fullscreen)"');
    expect(widgetRegion).toHaveTextContent('exclusive "Fullscreen"');
  });
});
