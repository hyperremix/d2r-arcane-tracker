import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { FarmingOverviewData, Item, TerrorZoneSchedule } from 'electron/types/grail';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterBuilder, HolyGrailItemBuilder } from '@/fixtures';
import { FARMING_INPUT_DEBOUNCE_MS } from '@/lib/farming';
import { useFarmingSessionStore } from '@/stores/farmingSessionStore';
import { useGrailStore } from '@/stores/grailStore';
import { FarmingAdvisor } from './FarmingAdvisor';

vi.mock('@/components/grail/ItemDetailsDialog', () => ({
  ItemDetailsDialog: ({ itemId }: { itemId: string | null }) =>
    itemId ? <div>Details of {itemId}</div> : null,
}));

const originalElectronAPI = window.electronAPI;
const initialGrailState = useGrailStore.getState();
const NOW = Date.parse('2026-10-17T14:47:30Z');

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

const schedule: TerrorZoneSchedule = {
  source: 'gameFile',
  slots: [
    {
      startsAt: Date.parse('2026-10-17T14:30:00Z'),
      endsAt: Date.parse('2026-10-17T15:00:00Z'),
      zoneId: 'Act1-Tower',
      zoneName: 'Forgotten Tower',
    },
    {
      startsAt: Date.parse('2026-10-17T15:00:00Z'),
      endsAt: Date.parse('2026-10-17T15:30:00Z'),
      zoneId: 'Act2-Sewers',
      zoneName: 'Lut Gholein Sewers',
    },
  ],
};

const readyOverview: FarmingOverviewData = {
  status: 'ready',
  locations: [
    {
      id: 'boss:mephisto:hell',
      kind: 'boss',
      difficulty: 'hell',
      name: 'Mephisto',
      areaName: 'Durance of Hate Level 3',
      monsterLevel: { min: 87, max: 87 },
      itemIndexes: [0],
    },
    {
      id: 'area:2:normal',
      kind: 'area',
      difficulty: 'normal',
      name: 'Blood Moor',
      monsterLevel: { min: 1, max: 3 },
      itemIndexes: [],
    },
  ],
  terrorZones: [
    {
      zoneId: 'Act1-Tower',
      difficulty: 'hell',
      monsterLevel: { min: 92, max: 95 },
      itemIndexes: [0],
    },
  ],
  unknownItemIndexes: [],
};

function setup(getOverview: ReturnType<typeof vi.fn>, suggestedD2RPath?: string) {
  const icon = {
    getSuggestedD2RPath: vi.fn().mockResolvedValue(suggestedD2RPath),
    setD2RPath: vi.fn().mockResolvedValue(undefined),
  };
  window.electronAPI = {
    farming: { getOverview },
    terrorZone: { getSchedule: vi.fn().mockResolvedValue(schedule) },
    icon,
  } as unknown as typeof window.electronAPI;
  render(
    <MemoryRouter initialEntries={['/farming']}>
      <Routes>
        <Route path="/farming" element={<FarmingAdvisor />} />
        <Route path="/settings" element={<div>Settings page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function manyLocationsOverview(count: number): FarmingOverviewData {
  return {
    ...readyOverview,
    locations: Array.from({ length: count }, (_, index) => ({
      id: `area:${index}:hell`,
      kind: 'area' as const,
      difficulty: 'hell' as const,
      name: `Area ${String(index + 1).padStart(2, '0')}`,
      monsterLevel: { min: 80, max: 80 },
      // The first area also drops the second item, so it sorts first
      itemIndexes: index === 0 ? [0, 1] : [0],
    })),
  };
}

describe('When the farming advisor page is shown', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    useFarmingSessionStore.getState().reset();
    useGrailStore.setState({
      items: [shako, ber],
      progress: [],
      characters: [CharacterBuilder.new().withLevel(90).withoutDeleted().build()],
    });
  });

  afterEach(() => {
    // Unmount before the store and API are restored, so no effect runs against them
    cleanup();
    vi.useRealTimers();
    window.electronAPI = originalElectronAPI;
    useGrailStore.setState(initialGrailState, true);
  });

  it('If no D2R installation is set, Then it asks for it and links to the settings', async () => {
    // Arrange
    const getOverview = vi
      .fn()
      .mockResolvedValue({ status: 'unavailable', errorCode: 'pathNotConfigured' });

    // Act
    setup(getOverview);
    const prompt = await screen.findByTestId('d2r-folder-prompt');
    fireEvent.click(within(prompt).getByRole('button', { name: 'Open D2R installation settings' }));

    // Assert
    expect(await screen.findByText('Settings page')).toBeInTheDocument();
  });

  it('If no D2R installation is set, Then the prompt is about drop rates and the missing items are listed', async () => {
    // Arrange
    const getOverview = vi
      .fn()
      .mockResolvedValue({ status: 'unavailable', errorCode: 'pathNotConfigured' });

    // Act
    setup(getOverview);

    // Assert
    const prompt = await screen.findByTestId('d2r-folder-prompt');
    expect(
      within(prompt).getByText(/^Drop rates are read from the drop tables/),
    ).toBeInTheDocument();
    const missingItems = screen.getByRole('region', { name: 'Missing items' });
    expect(
      within(missingItems).getByRole('button', { name: /2 missing items are tracked/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(within(missingItems).getByRole('button', { name: 'Harlequin Crest' }));
    expect(await screen.findByText('Details of harlequincrest')).toBeInTheDocument();
    expect(within(missingItems).getByRole('button', { name: 'Ber' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Terror zones' })).not.toBeInTheDocument();
  });

  it('If a found D2R installation is used, Then the farming data is read again', async () => {
    // Arrange
    const getOverview = vi
      .fn()
      .mockResolvedValueOnce({ status: 'unavailable', errorCode: 'pathNotConfigured' })
      .mockResolvedValue(readyOverview);
    setup(getOverview, 'C:\\Program Files (x86)\\Diablo II Resurrected');
    const useFolder = await screen.findByRole('button', {
      name: 'Use C:\\Program Files (x86)\\Diablo II Resurrected',
    });

    // Act
    fireEvent.click(useFolder);

    // Assert
    expect(await screen.findByRole('heading', { name: 'Terror zones' })).toBeInTheDocument();
    expect(getOverview).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('d2r-folder-prompt')).not.toBeInTheDocument();
  });

  it('If game files are missing, Then it lists them', async () => {
    // Arrange
    const getOverview = vi.fn().mockResolvedValue({
      status: 'unavailable',
      errorCode: 'gameFilesMissing',
      missingFiles: ['treasureclassex.txt', 'levels.txt'],
    });

    // Act
    setup(getOverview);

    // Assert
    expect(await screen.findByText('Game files must be extracted')).toBeInTheDocument();
    expect(screen.getByText(/treasureclassex\.txt, levels\.txt/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveClass('text-warning');
    expect(screen.getByRole('alert')).not.toHaveClass('text-destructive');
  });

  it('If the page is shown, Then the missing items are requested for the highest character level', async () => {
    // Arrange
    const getOverview = vi.fn().mockResolvedValue(readyOverview);

    // Act
    setup(getOverview);

    // Assert
    await screen.findByText('2 missing items are tracked by your grail.');
    expect(getOverview).toHaveBeenCalledWith({
      itemIds: ['harlequincrest', 'ber'],
      characterLevel: 90,
    });
    expect(
      screen.getByText("1 missing item doesn't drop from any monster in the game files: Ber"),
    ).toBeInTheDocument();
  });

  it('If the overview is ready, Then the current terror zone shows how many missing items drop there when terrorized', async () => {
    // Arrange
    const getOverview = vi.fn().mockResolvedValue(readyOverview);

    // Act
    setup(getOverview);

    // Assert
    const current = await screen.findByTestId('farming-terror-zone-current');
    expect(within(current).getByText('Forgotten Tower')).toBeInTheDocument();
    expect(
      within(current).getByRole('button', { name: /Hell: 1 item, monster level 92–95/ }),
    ).toBeInTheDocument();
    const next = screen.getByTestId('farming-terror-zone-next');
    expect(within(next).getByText('Lut Gholein Sewers')).toBeInTheDocument();
  });

  it('If a terror zone has no entry in the overview, Then its card says there is no drop data', async () => {
    // Arrange
    const getOverview = vi.fn().mockResolvedValue(readyOverview);

    // Act
    setup(getOverview);

    // Assert
    const next = await screen.findByTestId('farming-terror-zone-next');
    expect(
      within(next).getByText('The game files have no drop data for this terror zone.'),
    ).toBeInTheDocument();
    expect(within(next).queryByText(/Missing items that can drop here/)).not.toBeInTheDocument();
    const current = screen.getByTestId('farming-terror-zone-current');
    expect(
      within(current).queryByText('The game files have no drop data for this terror zone.'),
    ).not.toBeInTheDocument();
  });

  it('If the overview is ready, Then the terror zones section points to the assumed monster level rules', async () => {
    // Arrange
    const getOverview = vi.fn().mockResolvedValue(readyOverview);

    // Act
    setup(getOverview);

    // Assert
    expect(
      await screen.findByText(
        'Terror zone monster levels follow assumed rules, described in the Farming Advisor guide.',
      ),
    ).toBeInTheDocument();
  });

  it('If a terror zone has no missing items that can drop, Then it shows its counts instead of the missing data message', async () => {
    // Arrange
    const getOverview = vi.fn().mockResolvedValue({
      ...readyOverview,
      terrorZones: [
        {
          zoneId: 'Act1-Tower',
          difficulty: 'hell',
          monsterLevel: { min: 92, max: 95 },
          itemIndexes: [],
        },
      ],
    });

    // Act
    setup(getOverview);

    // Assert
    const current = await screen.findByTestId('farming-terror-zone-current');
    expect(within(current).getByText('Forgotten Tower')).toBeInTheDocument();
    expect(
      within(current).getByRole('button', { name: /Hell: 0 items, monster level 92–95/ }),
    ).toBeDisabled();
    expect(
      within(current).queryByText('The game files have no drop data for this terror zone.'),
    ).not.toBeInTheDocument();
  });

  it('If a location is expanded and an item selected, Then the item details open', async () => {
    // Arrange
    const getOverview = vi.fn().mockResolvedValue(readyOverview);
    setup(getOverview);
    const row = (await screen.findByText('Mephisto')).closest('tr');
    if (!row) throw new Error('Mephisto row not found');

    // Act
    fireEvent.click(within(row).getByRole('button', { name: /1 item/ }));
    fireEvent.click(within(row).getByRole('button', { name: 'Harlequin Crest' }));

    // Assert
    expect(screen.getByText('Details of harlequincrest')).toBeInTheDocument();
  });

  it('If the character level is changed, Then the overview is requested for it', async () => {
    // Arrange
    const getOverview = vi.fn().mockResolvedValue(readyOverview);
    setup(getOverview);
    const input = await screen.findByLabelText('Character level');

    // Act
    fireEvent.change(input, { target: { value: '75' } });

    // Assert
    await waitFor(() =>
      expect(getOverview).toHaveBeenLastCalledWith({
        itemIds: ['harlequincrest', 'ber'],
        characterLevel: 75,
      }),
    );
  });

  it('If the character level is typed in, Then the field follows at once and the overview is requested once after a pause', async () => {
    // Arrange
    const getOverview = vi.fn().mockResolvedValue(readyOverview);
    setup(getOverview);
    const input = await screen.findByLabelText('Character level');
    getOverview.mockClear();

    // Act
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.change(input, { target: { value: '75' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FARMING_INPUT_DEBOUNCE_MS - 1);
    });
    const callsBeforePause = getOverview.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // Assert
    expect(input).toHaveValue(75);
    expect(callsBeforePause).toBe(0);
    expect(getOverview).toHaveBeenCalledTimes(1);
    expect(getOverview).toHaveBeenCalledWith({
      itemIds: ['harlequincrest', 'ber'],
      characterLevel: 75,
    });
  });

  it('If more locations drop missing items than fit a page, Then they are paged', async () => {
    // Arrange
    const getOverview = vi.fn().mockResolvedValue(manyLocationsOverview(12));
    setup(getOverview);
    await screen.findByText('Area 01');

    // Act
    const onFirstPage = screen.queryByText('Area 12');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Assert
    expect(onFirstPage).not.toBeInTheDocument();
    expect(screen.getByText('Area 12')).toBeInTheDocument();
    expect(screen.queryByText('Area 01')).not.toBeInTheDocument();
    expect(screen.getByText('11-12 of 12')).toBeInTheDocument();
  });

  it('If the locations are searched by item, Then only locations dropping a matching item remain', async () => {
    // Arrange
    const getOverview = vi.fn().mockResolvedValue(manyLocationsOverview(12));
    setup(getOverview);
    await screen.findByText('Area 01');

    // Act
    fireEvent.change(screen.getByLabelText('Search locations'), { target: { value: 'ber' } });

    // Assert
    expect(screen.getByText('Area 01')).toBeInTheDocument();
    expect(screen.queryByText('Area 02')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('If a search is made on a later page, Then the results start at the first page', async () => {
    // Arrange
    const getOverview = vi.fn().mockResolvedValue(manyLocationsOverview(12));
    setup(getOverview);
    await screen.findByText('Area 01');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    // Act
    fireEvent.change(screen.getByLabelText('Search locations'), { target: { value: 'area' } });

    // Assert
    expect(screen.getByText('Area 01')).toBeInTheDocument();
    expect(screen.getByText('1-10 of 12')).toBeInTheDocument();
  });

  it('If no location matches the search, Then it says so', async () => {
    // Arrange
    const getOverview = vi.fn().mockResolvedValue(readyOverview);
    setup(getOverview);
    await screen.findByText('Mephisto');

    // Act
    fireEvent.change(screen.getByLabelText('Search locations'), { target: { value: 'zzz' } });

    // Assert
    expect(screen.getByText('No location matches your search.')).toBeInTheDocument();
  });
});
