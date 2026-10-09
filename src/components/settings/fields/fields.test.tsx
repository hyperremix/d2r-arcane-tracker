import { fireEvent, render, screen } from '@testing-library/react';
import { GameMode, GameVersion } from 'electron/types/grail';
import { describe, expect, it, vi } from 'vitest';
import { GameModeSelect } from './GameModeSelect';
import { GameVersionSelect } from './GameVersionSelect';
import { GrailTrackingFields } from './GrailTrackingFields';
import { NotificationFields } from './NotificationFields';
import { ThemeSelect } from './ThemeSelect';

describe('When a shared settings select is rendered', () => {
  describe('If a value is selected', () => {
    it('Then the game mode trigger shows the translated label instead of the raw value', () => {
      // Arrange
      const onValueChange = vi.fn();

      // Act
      render(<GameModeSelect id="mode" value={GameMode.Hardcore} onValueChange={onValueChange} />);

      // Assert
      expect(document.getElementById('mode')).toHaveTextContent('Hardcore Only');
    });

    it('Then the game version trigger shows the translated label instead of the raw value', () => {
      // Arrange
      const onValueChange = vi.fn();

      // Act
      render(
        <GameVersionSelect
          id="version"
          value={GameVersion.Classic}
          onValueChange={onValueChange}
        />,
      );

      // Assert
      expect(document.getElementById('version')).toHaveTextContent('Diablo II: Classic');
    });

    it('Then the theme trigger shows the translated label instead of the raw value', () => {
      // Arrange
      const onValueChange = vi.fn();

      // Act
      render(<ThemeSelect id="theme" value="system" onValueChange={onValueChange} />);

      // Assert
      expect(document.getElementById('theme')).toHaveTextContent('System');
    });
  });
});

describe('When GrailTrackingFields is rendered', () => {
  describe('If a grail content switch is toggled', () => {
    it('Then only that setting is passed to onChange', () => {
      // Arrange
      const onChange = vi.fn();
      render(
        <GrailTrackingFields
          values={{
            grailNormal: true,
            grailEthereal: false,
            grailRunes: false,
            grailRunewords: true,
          }}
          onChange={onChange}
        />,
      );

      // Act
      fireEvent.click(screen.getByLabelText('Include Ethereal Items'));

      // Assert
      expect(onChange).toHaveBeenCalledWith({ grailEthereal: true });
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });
});

describe('When NotificationFields is rendered', () => {
  const values = {
    enableSounds: true,
    notificationVolume: 0.4,
    inAppNotifications: true,
    nativeNotifications: false,
  };

  describe('If a notification switch is toggled', () => {
    it('Then the switch is named and described by its heading and passes its setting to onChange', () => {
      // Arrange
      const onChange = vi.fn();
      render(<NotificationFields values={values} onChange={onChange} />);
      const nativeSwitch = screen.getByRole('switch', { name: 'Native Notifications' });

      // Act
      fireEvent.click(nativeSwitch);

      // Assert
      expect(nativeSwitch).toHaveAccessibleDescription('Show browser/OS notifications');
      expect(onChange).toHaveBeenCalledWith({ nativeNotifications: true });
    });
  });

  describe('If sounds are disabled', () => {
    it('Then the labelled volume slider shows 0% and is disabled', () => {
      // Arrange
      const onChange = vi.fn();

      // Act
      render(
        <NotificationFields values={{ ...values, enableSounds: false }} onChange={onChange} />,
      );

      // Assert
      const slider = screen.getByRole('slider', { hidden: true });
      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Volume:')).toContain(slider);
      expect(slider).toBeDisabled();
    });
  });
});
