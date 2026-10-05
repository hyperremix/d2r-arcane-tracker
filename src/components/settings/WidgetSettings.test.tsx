import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { WidgetSettings } from './WidgetSettings';

describe('WidgetSettings', () => {
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
    // Arrange & Act
    render(<WidgetSettings />);

    // Assert
    const opacityLabel = screen.getByText('Opacity', { selector: 'label' }) as HTMLLabelElement;
    const opacitySliderRoot = document.getElementById(opacityLabel.htmlFor);
    const opacityInput = opacitySliderRoot?.querySelector('input[type="range"]');
    expect(opacityInput).toHaveAttribute('min', '0.3');
    expect(opacityInput).toHaveAttribute('max', '1');
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('Adjust widget background opacity (30% to 100%)')).toBeInTheDocument();
  });
});
