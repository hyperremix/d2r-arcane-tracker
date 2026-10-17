import { act, render, screen, waitFor, within } from '@testing-library/react';
import type { TerrorZoneSchedule as TerrorZoneScheduleData } from 'electron/types/grail';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTerrorZoneSessionStore } from '@/stores/terrorZoneSessionStore';
import { TerrorZoneSchedule } from './TerrorZoneSchedule';

const originalElectronAPI = window.electronAPI;

const MINUTE_MS = 60 * 1000;
const NOW = Date.parse('2026-10-17T14:47:30Z');
// The windows of the retail rotation: 14:30 (running), 15:00, 15:30, 16:00
const WINDOW_START = Date.parse('2026-10-17T14:30:00Z');

function slot(index: number, zoneName: string) {
  const startsAt = WINDOW_START + index * 30 * MINUTE_MS;
  return { startsAt, endsAt: startsAt + 30 * MINUTE_MS, zoneId: `zone-${index}`, zoneName };
}

const schedule: TerrorZoneScheduleData = {
  source: 'gameFile',
  slots: [
    slot(0, 'Spider Forest'),
    slot(1, 'Travincal'),
    slot(2, 'Durance of Hate'),
    slot(3, 'Worldstone Keep'),
  ],
};

function setupApi(getSchedule: ReturnType<typeof vi.fn>) {
  window.electronAPI = { terrorZone: { getSchedule } } as unknown as typeof window.electronAPI;
}

function renderSchedule() {
  return render(
    <MemoryRouter initialEntries={['/terror-zones']}>
      <Routes>
        <Route path="/terror-zones" element={<TerrorZoneSchedule />} />
        <Route path="/terror-zones/configuration" element={<div>Configuration page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('When the TerrorZoneSchedule page is shown', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    useTerrorZoneSessionStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.electronAPI = originalElectronAPI;
  });

  describe('If the schedule is loaded', () => {
    it('Then the current zone counts down, and the next and upcoming zones are listed', async () => {
      // Arrange
      const getSchedule = vi.fn().mockResolvedValue(schedule);
      setupApi(getSchedule);

      // Act
      renderSchedule();

      // Assert
      const current = await screen.findByTestId('terror-zone-current');
      expect(within(current).getByText('Spider Forest')).toBeInTheDocument();
      expect(within(current).getByText('Ends in 12:30')).toBeInTheDocument();
      const next = screen.getByTestId('terror-zone-next');
      expect(within(next).getByText('Travincal')).toBeInTheDocument();
      expect(within(next).getByText('Starts in 12:30')).toBeInTheDocument();
      const upcoming = screen.getByRole('table');
      expect(within(upcoming).getByText('Durance of Hate')).toBeInTheDocument();
      expect(within(upcoming).getByText('Worldstone Keep')).toBeInTheDocument();
      expect(within(upcoming).queryByText('Travincal')).not.toBeInTheDocument();
      expect(getSchedule).toHaveBeenCalledWith(25);
    });

    it('Then the countdown follows the clock', async () => {
      // Arrange
      setupApi(vi.fn().mockResolvedValue(schedule));
      renderSchedule();
      await screen.findByText('Ends in 12:30');

      // Act
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      // Assert
      expect(screen.getByText('Ends in 12:20')).toBeInTheDocument();
    });

    it('Then the page links to the zone configuration', async () => {
      // Arrange
      setupApi(vi.fn().mockResolvedValue(schedule));
      renderSchedule();

      // Act
      const link = await screen.findByRole('link', { name: 'Configure zones' });

      // Assert
      expect(link).toHaveAttribute('href', '/terror-zones/configuration');
    });

    it('Then the file it was calculated from is explained', async () => {
      // Arrange
      setupApi(vi.fn().mockResolvedValue(schedule));

      // Act
      renderSchedule();

      // Assert
      expect(await screen.findByText(/Calculated from desecratedzones\.json/)).toHaveTextContent(
        '-direct -txt',
      );
      expect(screen.queryByText(/this is the retail schedule/)).not.toBeInTheDocument();
    });
  });

  describe('If the running window has ended', () => {
    it('Then the schedule is loaded again', async () => {
      // Arrange
      const later: TerrorZoneScheduleData = { source: 'gameFile', slots: schedule.slots.slice(1) };
      const getSchedule = vi.fn().mockResolvedValueOnce(schedule).mockResolvedValue(later);
      setupApi(getSchedule);
      renderSchedule();
      await screen.findByText('Ends in 12:30');

      // Act
      await act(async () => {
        await vi.advanceTimersByTimeAsync(13 * MINUTE_MS);
      });

      // Assert
      await waitFor(() => expect(getSchedule).toHaveBeenCalledTimes(2));
      const current = await screen.findByTestId('terror-zone-current');
      expect(within(current).getByText('Travincal')).toBeInTheDocument();
    });
  });

  describe('If no zone runs right now', () => {
    it('Then the current zone says so and the next zone is shown', async () => {
      // Arrange: a break between windows
      const inBreak: TerrorZoneScheduleData = {
        source: 'gameFile',
        slots: schedule.slots.slice(1),
      };
      setupApi(vi.fn().mockResolvedValue(inBreak));

      // Act
      renderSchedule();

      // Assert
      const current = await screen.findByTestId('terror-zone-current');
      expect(within(current).getByText('No terror zone right now')).toBeInTheDocument();
      expect(
        within(screen.getByTestId('terror-zone-next')).getByText('Travincal'),
      ).toBeInTheDocument();
    });
  });

  describe('If the schedule comes from the retail defaults', () => {
    it('Then the player is told how to follow their own zone list', async () => {
      // Arrange
      setupApi(vi.fn().mockResolvedValue({ ...schedule, source: 'retailDefault' }));

      // Act
      renderSchedule();

      // Assert
      expect(await screen.findByText(/this is the retail schedule/)).toBeInTheDocument();
      expect(screen.queryByText(/Calculated from desecratedzones\.json/)).not.toBeInTheDocument();
    });
  });

  describe('If the game file is from an older D2R version', () => {
    it('Then the player is told to extract the game files again, above the retail schedule', async () => {
      // Arrange
      setupApi(vi.fn().mockResolvedValue({ ...schedule, source: 'unusableGameFile' }));

      // Act
      renderSchedule();

      // Assert
      expect(await screen.findByText(/is from an older version of D2R/)).toBeInTheDocument();
      expect(screen.queryByText(/Calculated from desecratedzones\.json/)).not.toBeInTheDocument();
      expect(
        within(screen.getByTestId('terror-zone-current')).getByText('Spider Forest'),
      ).toBeInTheDocument();
    });
  });

  describe('If the game file schedules no terror zone', () => {
    it('Then an empty state is shown instead of the zones', async () => {
      // Arrange
      setupApi(vi.fn().mockResolvedValue({ source: 'gameFile', slots: [] }));

      // Act
      renderSchedule();

      // Assert
      expect(await screen.findByText(/schedules no terror zone/)).toBeInTheDocument();
      expect(screen.queryByTestId('terror-zone-current')).not.toBeInTheDocument();
    });
  });

  describe('If the schedule cannot be loaded', () => {
    it('Then an error is shown', async () => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      setupApi(vi.fn().mockRejectedValue(new Error('boom')));

      // Act
      renderSchedule();

      // Assert
      expect(
        await screen.findByText('Failed to load the terror zone schedule'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Loading the terror zone schedule...')).not.toBeInTheDocument();
    });
  });

  describe('If terror zones were saved in this session', () => {
    it('Then the reminder to restart D2R is shown', async () => {
      // Arrange
      useTerrorZoneSessionStore.getState().markChangesToApply();
      setupApi(vi.fn().mockResolvedValue(schedule));

      // Act
      renderSchedule();

      // Assert
      expect(await screen.findByText('Restart D2R to apply your changes')).toBeInTheDocument();
    });
  });
});
