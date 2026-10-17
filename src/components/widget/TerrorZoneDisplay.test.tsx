import { act, render, screen, within } from '@testing-library/react';
import type { TerrorZoneSchedule } from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TerrorZoneDisplay } from './TerrorZoneDisplay';

const originalElectronAPI = window.electronAPI;

const MINUTE_MS = 60 * 1000;
const NOW = Date.parse('2026-10-17T14:47:30Z');
// The windows of the retail rotation: 14:30 (running), 15:00, 15:30, 16:00
const WINDOW_START = Date.parse('2026-10-17T14:30:00Z');

function slot(index: number, zoneName: string) {
  const startsAt = WINDOW_START + index * 30 * MINUTE_MS;
  return { startsAt, endsAt: startsAt + 30 * MINUTE_MS, zoneId: `zone-${index}`, zoneName };
}

const schedule: TerrorZoneSchedule = {
  source: 'gameFile',
  slots: [
    slot(0, 'Spider Forest'),
    slot(1, 'Travincal'),
    slot(2, 'Durance of Hate'),
    slot(3, 'Worldstone Keep'),
    slot(4, 'Pit'),
  ],
};

function setupApi(getSchedule: ReturnType<typeof vi.fn>) {
  window.electronAPI = { terrorZone: { getSchedule } } as unknown as typeof window.electronAPI;
}

describe('When the widget shows the terror zones', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.electronAPI = originalElectronAPI;
  });

  describe('If the schedule is loaded', () => {
    it('Then the current zone counts down and the next three zones are listed', async () => {
      // Arrange
      const getSchedule = vi.fn().mockResolvedValue(schedule);
      setupApi(getSchedule);

      // Act
      render(<TerrorZoneDisplay />);

      // Assert
      expect(await screen.findByTestId('widget-terror-zone-current')).toHaveTextContent(
        'Spider Forest',
      );
      expect(screen.getByText('12:30')).toBeInTheDocument();
      const upcoming = screen.getByRole('list');
      expect(within(upcoming).getAllByRole('listitem')).toHaveLength(3);
      expect(within(upcoming).getByText('Travincal')).toBeInTheDocument();
      expect(within(upcoming).getByText('Durance of Hate')).toBeInTheDocument();
      expect(within(upcoming).getByText('Worldstone Keep')).toBeInTheDocument();
      expect(within(upcoming).queryByText('Pit')).not.toBeInTheDocument();
      expect(getSchedule).toHaveBeenCalledWith(4);
    });

    it('Then the countdown follows the clock', async () => {
      // Arrange
      setupApi(vi.fn().mockResolvedValue(schedule));
      render(<TerrorZoneDisplay />);
      await screen.findByText('12:30');

      // Act
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      // Assert
      expect(screen.getByText('12:20')).toBeInTheDocument();
    });

    it('Then the schedule is read again every minute', async () => {
      // Arrange
      const getSchedule = vi.fn().mockResolvedValue(schedule);
      setupApi(getSchedule);
      render(<TerrorZoneDisplay />);
      await screen.findByText('12:30');
      const callsAfterLoad = getSchedule.mock.calls.length;

      // Act
      await act(async () => {
        await vi.advanceTimersByTimeAsync(MINUTE_MS);
      });

      // Assert
      expect(getSchedule.mock.calls.length).toBeGreaterThan(callsAfterLoad);
    });

    it('Then the retail note is not shown', async () => {
      // Arrange
      setupApi(vi.fn().mockResolvedValue(schedule));

      // Act
      render(<TerrorZoneDisplay />);

      // Assert
      await screen.findByTestId('widget-terror-zone-current');
      expect(screen.queryByText('Retail schedule')).not.toBeInTheDocument();
    });
  });

  describe('If the schedule is not from the game file', () => {
    it('Then the widget says it shows the retail schedule', async () => {
      // Arrange
      setupApi(vi.fn().mockResolvedValue({ ...schedule, source: 'retailDefault' }));

      // Act
      render(<TerrorZoneDisplay />);

      // Assert
      expect(await screen.findByText('Retail schedule')).toBeInTheDocument();
    });
  });

  describe('If no zone runs right now', () => {
    it('Then the widget says so and still lists the next zones', async () => {
      // Arrange: a break between windows
      setupApi(vi.fn().mockResolvedValue({ source: 'gameFile', slots: schedule.slots.slice(1) }));

      // Act
      render(<TerrorZoneDisplay />);

      // Assert
      expect(await screen.findByText('No terror zone right now')).toBeInTheDocument();
      expect(within(screen.getByRole('list')).getByText('Travincal')).toBeInTheDocument();
    });
  });

  describe('If the schedule cannot be loaded', () => {
    it('Then the widget shows the error', async () => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      setupApi(vi.fn().mockRejectedValue(new Error('boom')));

      // Act
      render(<TerrorZoneDisplay />);

      // Assert
      expect(
        await screen.findByText('Failed to load the terror zone schedule'),
      ).toBeInTheDocument();
    });
  });
});
