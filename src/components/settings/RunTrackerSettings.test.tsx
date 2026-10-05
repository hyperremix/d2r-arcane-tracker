import { render, screen } from '@testing-library/react';
import type { Settings } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGrailStore } from '@/stores/grailStore';
import { RunTrackerSettings } from './RunTrackerSettings';

vi.mock('@/stores/grailStore');

const originalElectronAPI = window.electronAPI;

function setupGrailStore(settings: Partial<Settings>) {
  const storeState = { settings, setSettings: vi.fn() };
  vi.mocked(useGrailStore).mockImplementation((selector?: unknown) => {
    if (typeof selector === 'function') {
      return (selector as (s: typeof storeState) => unknown)(storeState);
    }
    return storeState as unknown as ReturnType<typeof useGrailStore>;
  });
}

describe('When RunTrackerSettings is rendered on Windows with auto mode enabled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.electronAPI = {
      platform: 'win32',
      runTracker: {
        getMemoryStatus: vi.fn().mockResolvedValue({ available: true, reason: null }),
      },
    } as unknown as typeof window.electronAPI;
    setupGrailStore({
      runTrackerMemoryReading: true,
      runTrackerMemoryPollingInterval: 500,
    });
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
  });

  it('Then the polling interval slider is labelled by its label', () => {
    // Arrange & Act
    render(<RunTrackerSettings />);

    // Assert (the thumb input stays visibility:hidden in jsdom until measured, which blanks its
    // computed role name, so verify the label association via getAllByLabelText instead)
    const slider = screen.getByRole('slider', { hidden: true });
    expect(screen.getAllByLabelText('Memory Polling Interval')).toContain(slider);
  });

  it('Then the shortcut edit buttons use translated text', () => {
    // Arrange & Act
    render(<RunTrackerSettings />);

    // Assert
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(4);
  });
});
