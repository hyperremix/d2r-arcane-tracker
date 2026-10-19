import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  FarmingOverview,
  Item,
  TerrorZoneSchedule as TerrorZoneScheduleData,
  TerrorZoneValidationResult,
} from 'electron/types/grail';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HolyGrailItemBuilder } from '@/fixtures';
import { useFarmingSessionStore } from '@/stores/farmingSessionStore';
import { useGrailStore } from '@/stores/grailStore';
import { useTerrorZoneSessionStore } from '@/stores/terrorZoneSessionStore';
import { TerrorZoneSchedule } from './TerrorZoneSchedule';

const originalElectronAPI = window.electronAPI;
const initialGrailState = useGrailStore.getState();

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

const shako: Item = HolyGrailItemBuilder.new()
  .withId('harlequincrest')
  .withName('Harlequin Crest')
  .withType('unique')
  .withEtherealType('none')
  .build();
const ber: Item = HolyGrailItemBuilder.new()
  .withId('ber')
  .withName('Ber')
  .withType('rune')
  .withEtherealType('none')
  .build();

const notConfigured: FarmingOverview = { status: 'unavailable', errorCode: 'pathNotConfigured' };

function terrorZone(zoneId: string, difficulty: 'normal' | 'hell', itemIndexes: number[]) {
  return { zoneId, difficulty, monsterLevel: { min: 90, max: 90 }, itemIndexes };
}

interface ApiOptions {
  validation?: TerrorZoneValidationResult;
  overview?: FarmingOverview;
  suggestedD2RPath?: string;
}

function setupApi(
  getSchedule: ReturnType<typeof vi.fn>,
  { validation = { valid: true }, overview = notConfigured, suggestedD2RPath }: ApiOptions = {},
) {
  const validatePath = vi.fn().mockResolvedValue(validation);
  const getOverview = vi.fn().mockResolvedValue(overview);
  const icon = {
    getSuggestedD2RPath: vi.fn().mockResolvedValue(suggestedD2RPath),
    setD2RPath: vi.fn().mockResolvedValue(undefined),
  };
  window.electronAPI = {
    terrorZone: { getSchedule, validatePath },
    farming: { getOverview },
    icon,
  } as unknown as typeof window.electronAPI;
  return { validatePath, getOverview };
}

function renderSchedule() {
  return render(
    <MemoryRouter initialEntries={['/terror-zones']}>
      <Routes>
        <Route path="/terror-zones" element={<TerrorZoneSchedule />} />
        <Route path="/terror-zones/configuration" element={<div>Configuration page</div>} />
        <Route path="/settings" element={<div>Settings page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('When the TerrorZoneSchedule page is shown', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    useTerrorZoneSessionStore.getState().reset();
    useFarmingSessionStore.getState().reset();
  });

  afterEach(() => {
    // Unmount before the store and API are restored, so no effect runs against them
    cleanup();
    vi.useRealTimers();
    window.electronAPI = originalElectronAPI;
    useGrailStore.setState(initialGrailState, true);
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
      expect(within(current).getByText('Ends in 12 min')).toBeInTheDocument();
      const next = screen.getByTestId('terror-zone-next');
      expect(within(next).getByText('Travincal')).toBeInTheDocument();
      expect(within(next).getByText('Starts in 12 min')).toBeInTheDocument();
      const upcoming = screen.getByTestId('terror-zone-upcoming');
      expect(within(upcoming).getByText('Durance of Hate')).toBeInTheDocument();
      expect(within(upcoming).getByText('Worldstone Keep')).toBeInTheDocument();
      expect(within(upcoming).queryByText('Travincal')).not.toBeInTheDocument();
      expect(getSchedule).toHaveBeenCalledWith(25);
    });

    it('Then the countdown follows the clock', async () => {
      // Arrange
      setupApi(vi.fn().mockResolvedValue(schedule));
      renderSchedule();
      await screen.findByText('Ends in 12 min');

      // Act
      await act(async () => {
        await vi.advanceTimersByTimeAsync(MINUTE_MS);
      });

      // Assert
      expect(screen.getByText('Ends in 11 min')).toBeInTheDocument();
    });

    it('Then the last minute counts down in seconds', async () => {
      // Arrange
      setupApi(vi.fn().mockResolvedValue(schedule));
      renderSchedule();
      await screen.findByText('Ends in 12 min');

      // Act
      await act(async () => {
        await vi.advanceTimersByTimeAsync(12 * MINUTE_MS);
      });

      // Assert
      expect(screen.getByText('Ends in 30 sec')).toBeInTheDocument();
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
      await screen.findByText('Ends in 12 min');

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

  describe('If no D2R installation folder is set', () => {
    it('Then a calm prompt links to the D2R installation settings', async () => {
      // Arrange
      setupApi(vi.fn().mockResolvedValue({ ...schedule, source: 'retailDefault' }), {
        validation: { valid: false, errorCode: 'pathNotConfigured' },
      });
      renderSchedule();
      const prompt = await screen.findByTestId('d2r-folder-prompt');

      // Act
      fireEvent.click(
        within(prompt).getByRole('button', { name: 'Open D2R installation settings' }),
      );

      // Assert
      expect(await screen.findByText('Settings page')).toBeInTheDocument();
    });

    it('Then the retail schedule is shown with a one-line note and no warning', async () => {
      // Arrange
      setupApi(vi.fn().mockResolvedValue({ ...schedule, source: 'retailDefault' }), {
        validation: { valid: false, errorCode: 'pathNotConfigured' },
      });

      // Act
      renderSchedule();

      // Assert
      const note = await screen.findByText(
        'This is the retail schedule. Set your D2R folder to follow the zone schedule from your game files.',
      );
      expect(screen.getByTestId('d2r-folder-prompt')).toContainElement(note);
      expect(screen.queryByText('Set your D2R installation folder')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText(/Calculated from desecratedzones\.json/)).not.toBeInTheDocument();
      expect(
        within(screen.getByTestId('terror-zone-current')).getByText('Spider Forest'),
      ).toBeInTheDocument();
    });
  });

  describe('If a found D2R installation is used', () => {
    it('Then the schedule and the folder are checked again', async () => {
      // Arrange
      const getSchedule = vi.fn().mockResolvedValue({ ...schedule, source: 'retailDefault' });
      const { validatePath } = setupApi(getSchedule, {
        validation: { valid: false, errorCode: 'pathNotConfigured' },
        suggestedD2RPath: 'C:\\Program Files (x86)\\Diablo II Resurrected',
      });
      renderSchedule();
      const useFolder = await screen.findByRole('button', {
        name: 'Use C:\\Program Files (x86)\\Diablo II Resurrected',
      });
      validatePath.mockResolvedValue({ valid: false, errorCode: 'gameFileNotFound' });

      // Act
      fireEvent.click(useFolder);

      // Assert
      expect(
        await screen.findByText(/^desecratedzones\.json isn't in your D2R folder/),
      ).toBeInTheDocument();
      expect(screen.queryByTestId('d2r-folder-prompt')).not.toBeInTheDocument();
      expect(getSchedule).toHaveBeenCalledTimes(2);
      expect(validatePath).toHaveBeenCalledTimes(2);
    });
  });

  describe('If the D2R folder is set but cannot be used', () => {
    it('Then a missing folder is a warning that links to the D2R installation settings', async () => {
      // Arrange
      setupApi(vi.fn().mockResolvedValue({ ...schedule, source: 'retailDefault' }), {
        validation: { valid: false, errorCode: 'directoryNotFound' },
      });

      // Act
      renderSchedule();

      // Assert
      const warning = await screen.findByRole('alert');
      expect(warning).toHaveTextContent(/set in Settings doesn't exist/);
      expect(
        within(warning).getByRole('button', { name: 'Open D2R installation settings' }),
      ).toBeInTheDocument();
      expect(screen.queryByTestId('d2r-folder-prompt')).not.toBeInTheDocument();
    });

    it('Then a missing game file is a warning that says to extract the game files and links to the settings', async () => {
      // Arrange
      setupApi(vi.fn().mockResolvedValue({ ...schedule, source: 'retailDefault' }), {
        validation: { valid: false, errorCode: 'gameFileNotFound' },
      });

      // Act
      renderSchedule();

      // Assert
      const warning = await screen.findByRole('alert');
      expect(warning).toHaveTextContent(/isn't in your D2R folder/);
      expect(warning).toHaveTextContent(/Extract the game files/);
      expect(
        within(warning).getByRole('button', { name: 'Open D2R installation settings' }),
      ).toBeInTheDocument();
      expect(screen.queryByTestId('d2r-folder-prompt')).not.toBeInTheDocument();
    });

    it('Then an unreadable game file is a warning that says to extract the game files again', async () => {
      // Arrange
      setupApi(vi.fn().mockResolvedValue({ ...schedule, source: 'retailDefault' }), {
        validation: { valid: false, errorCode: 'corruptedFile' },
      });

      // Act
      renderSchedule();

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(/can't be read/);
    });

    it('Then an invalid game file structure is also a warning that the file can not be read', async () => {
      // Arrange
      setupApi(vi.fn().mockResolvedValue({ ...schedule, source: 'retailDefault' }), {
        validation: { valid: false, errorCode: 'invalidStructure' },
      });

      // Act
      renderSchedule();

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(/can't be read/);
    });
  });

  describe('If the D2R folder check gives no usable reason', () => {
    it.each<{ scenario: string; validation: TerrorZoneValidationResult | Error }>([
      { scenario: 'an unknown error', validation: { valid: false, errorCode: 'unknown' } },
      { scenario: 'a folder that now validates', validation: { valid: true } },
      { scenario: 'a failed check', validation: new Error('boom') },
    ])('Then $scenario shows the retail schedule without advice to extract the game files', async ({
      validation,
    }) => {
      // Arrange
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { validatePath } = setupApi(
        vi.fn().mockResolvedValue({ ...schedule, source: 'retailDefault' }),
      );
      if (validation instanceof Error) validatePath.mockRejectedValue(validation);
      else validatePath.mockResolvedValue(validation);

      // Act
      renderSchedule();
      await screen.findByTestId('terror-zone-current');
      await waitFor(() => expect(validatePath).toHaveBeenCalled());

      // Assert
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByTestId('d2r-folder-prompt')).not.toBeInTheDocument();
      expect(screen.queryByText(/Extract the game files/)).not.toBeInTheDocument();
    });
  });

  describe('If the schedule stops being the retail default and becomes it again', () => {
    it('Then the earlier reason is not shown while the folder is checked again', async () => {
      // Arrange
      const retail = { ...schedule, source: 'retailDefault' as const };
      const getSchedule = vi
        .fn()
        .mockResolvedValueOnce(retail)
        .mockResolvedValueOnce({ source: 'gameFile', slots: schedule.slots.slice(1) })
        .mockResolvedValue({ ...retail, slots: schedule.slots.slice(2) });
      const { validatePath } = setupApi(getSchedule, {
        validation: { valid: false, errorCode: 'directoryNotFound' },
      });
      renderSchedule();
      expect(await screen.findByRole('alert')).toHaveTextContent(/doesn't exist/);
      validatePath.mockReturnValue(new Promise(() => undefined));

      // Act: the first window ends and the game file is used, then its window ends and it is not
      await act(async () => {
        await vi.advanceTimersByTimeAsync(13 * MINUTE_MS);
      });
      await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30 * MINUTE_MS);
      });

      // Assert
      await waitFor(() => expect(validatePath).toHaveBeenCalledTimes(2));
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('If the schedule comes from the game file', () => {
    it('Then the D2R folder is not checked again', async () => {
      // Arrange
      const { validatePath } = setupApi(vi.fn().mockResolvedValue(schedule));

      // Act
      renderSchedule();
      await screen.findByTestId('terror-zone-current');

      // Assert
      expect(validatePath).not.toHaveBeenCalled();
      expect(screen.queryByTestId('d2r-folder-prompt')).not.toBeInTheDocument();
    });
  });

  describe('If the farming data is available', () => {
    it('Then each zone shows how many missing items can drop there', async () => {
      // Arrange
      useGrailStore.setState({ items: [shako, ber], progress: [], characters: [] });
      setupApi(vi.fn().mockResolvedValue(schedule), {
        overview: {
          status: 'ready',
          locations: [],
          terrorZones: [
            // An item that drops in several difficulties counts once
            terrorZone('zone-0', 'hell', [0, 1]),
            terrorZone('zone-0', 'normal', [0]),
            terrorZone('zone-2', 'hell', [1]),
            terrorZone('zone-3', 'hell', []),
          ],
          unknownItemIndexes: [],
        },
      });

      // Act
      renderSchedule();

      // Assert
      const current = await screen.findByTestId('terror-zone-current');
      expect(await within(current).findByText('2 missing items can drop here')).toBeInTheDocument();
      expect(within(screen.getByTestId('terror-zone-next')).queryByText(/missing/)).toBeNull();
      const upcoming = screen.getByTestId('terror-zone-upcoming');
      expect(within(upcoming).getByText('1 missing item can drop here')).toHaveClass('sr-only');
      expect(within(upcoming).getByText('1 missing item')).toBeInTheDocument();
      expect(within(upcoming).getAllByText(/missing item/)).toHaveLength(2);
    });
  });

  describe('If the farming data is not available', () => {
    it('Then no missing items are shown', async () => {
      // Arrange
      useGrailStore.setState({ items: [shako, ber], progress: [], characters: [] });
      const { getOverview } = setupApi(vi.fn().mockResolvedValue(schedule));

      // Act
      renderSchedule();
      await screen.findByTestId('terror-zone-current');
      await waitFor(() => expect(getOverview).toHaveBeenCalled());

      // Assert
      expect(screen.queryByText(/missing item/)).not.toBeInTheDocument();
    });
  });

  describe('If the upcoming zones run into the next day', () => {
    it('Then they are grouped under Today and Tomorrow', async () => {
      // Arrange: local times, so the day boundary doesn't depend on the time zone
      vi.setSystemTime(new Date(2026, 9, 17, 22, 47, 30));
      const localSlot = (hours: number, minutes: number, zoneName: string) => {
        const startsAt = new Date(2026, 9, 17, hours, minutes).getTime();
        return { startsAt, endsAt: startsAt + 30 * MINUTE_MS, zoneId: zoneName, zoneName };
      };
      setupApi(
        vi.fn().mockResolvedValue({
          source: 'gameFile',
          slots: [
            localSlot(22, 30, 'Spider Forest'),
            localSlot(23, 0, 'Travincal'),
            localSlot(23, 30, 'Durance of Hate'),
            localSlot(24, 0, 'Worldstone Keep'),
          ],
        }),
      );

      // Act
      renderSchedule();

      // Assert
      const upcoming = await screen.findByTestId('terror-zone-upcoming');
      const [today, tomorrow] = within(upcoming).getAllByRole('list');
      expect(within(upcoming).getByRole('heading', { name: 'Today' })).toBeInTheDocument();
      expect(within(upcoming).getByRole('heading', { name: 'Tomorrow' })).toBeInTheDocument();
      expect(within(today).getByText('Durance of Hate')).toBeInTheDocument();
      expect(within(tomorrow).getByText('Worldstone Keep')).toBeInTheDocument();
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
