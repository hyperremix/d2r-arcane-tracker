import { render, screen } from '@testing-library/react';
import type { Settings } from 'electron/types/grail';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { NotificationSettings } from './NotificationSettings';

vi.mock('@/stores/grailStore');

const mockSetSettings = vi.fn();

function setupGrailStore(settings: Partial<Settings>) {
  const storeState = { settings, setSettings: mockSetSettings };
  vi.mocked(useGrailStore).mockImplementation((selector?: unknown) => {
    if (typeof selector === 'function') {
      return (selector as (s: typeof storeState) => unknown)(storeState);
    }
    return storeState as unknown as ReturnType<typeof useGrailStore>;
  });
}

describe('When NotificationSettings is rendered', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGrailStore({
      enableSounds: true,
      notificationVolume: 0.5,
      inAppNotifications: true,
      nativeNotifications: false,
    });
  });

  it('Then each switch is labelled by its heading', () => {
    // Arrange & Act
    render(<NotificationSettings />);

    // Assert
    expect(screen.getByLabelText('Sound Notifications')).toHaveAttribute('role', 'switch');
    expect(screen.getByLabelText('In-App Notifications')).toHaveAttribute('role', 'switch');
    expect(screen.getByLabelText('Native Notifications')).toHaveAttribute('role', 'switch');
  });

  it('Then each switch is described by its description text', () => {
    // Arrange & Act
    render(<NotificationSettings />);

    // Assert
    expect(screen.getByRole('switch', { name: 'Sound Notifications' })).toHaveAccessibleDescription(
      'Play sound when items are found',
    );
    expect(
      screen.getByRole('switch', { name: 'Native Notifications' }),
    ).toHaveAccessibleDescription('Show browser/OS notifications');
  });

  it('Then the volume slider is labelled', () => {
    // Arrange & Act
    render(<NotificationSettings />);

    // Assert (the thumb input stays visibility:hidden in jsdom until measured, which blanks its
    // computed role name, so verify the label association via getAllByLabelText instead)
    const slider = screen.getByRole('slider', { hidden: true });
    expect(screen.getAllByLabelText('Volume:')).toContain(slider);
  });
});
