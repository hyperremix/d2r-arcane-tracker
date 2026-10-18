import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { FarmingItemSource, FarmingItemSources } from 'electron/types/grail';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterBuilder, HolyGrailItemBuilder } from '@/fixtures';
import { FARMING_INPUT_DEBOUNCE_MS } from '@/lib/farming';
import { useFarmingSessionStore } from '@/stores/farmingSessionStore';
import { ItemFarmingSources } from './ItemFarmingSources';

const originalElectronAPI = window.electronAPI;

const shako = HolyGrailItemBuilder.new()
  .withId('harlequincrest')
  .withName('Harlequin Crest')
  .withType('unique')
  .build();
const characters = [CharacterBuilder.new().withLevel(85).withoutDeleted().build()];

const source = (overrides: Partial<FarmingItemSource>): FarmingItemSource => ({
  locationId: 'boss:mephisto:hell',
  kind: 'boss',
  monsterKind: 'boss',
  difficulty: 'hell',
  name: 'Mephisto',
  areaName: 'Durance of Hate Level 3',
  monsterLevel: { min: 87, max: 87 },
  dropsPerKill: { min: 1 / 1779, max: 1 / 1779 },
  ...overrides,
});

function setup(result: FarmingItemSources, item = shako) {
  const getItemSources = vi.fn().mockResolvedValue(result);
  window.electronAPI = { farming: { getItemSources } } as unknown as typeof window.electronAPI;
  render(
    <MemoryRouter>
      <ItemFarmingSources item={item} characters={characters} />
    </MemoryRouter>,
  );
  return getItemSources;
}

describe('When the farming sources of an item are shown', () => {
  beforeEach(() => {
    useFarmingSessionStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.electronAPI = originalElectronAPI;
  });

  it('Then each source shows its location, monster kind, level and drop rate', async () => {
    // Arrange
    const result: FarmingItemSources = {
      status: 'ready',
      known: true,
      sources: [
        source({}),
        source({
          locationId: 'terrorZone:Act5-WorldstoneKeep:area:hell',
          kind: 'area',
          monsterKind: 'regular',
          name: 'Worldstone Keep',
          areaName: undefined,
          terrorZoneId: 'Act5-WorldstoneKeep',
          monsterLevel: { min: 96, max: 96 },
          dropsPerKill: { min: 1 / 250000, max: 1 / 120000 },
        }),
      ],
    };

    // Act
    const getItemSources = setup(result);

    // Assert
    const table = await screen.findByRole('table');
    const [, mephisto, keep] = within(table).getAllByRole('row');
    expect(mephisto).toHaveTextContent('Mephisto');
    expect(mephisto).toHaveTextContent('Durance of Hate Level 3 · Hell · Boss');
    expect(mephisto).toHaveTextContent('1 in 1,779');
    expect(keep).toHaveTextContent('Terror zone');
    expect(keep).toHaveTextContent('Hell · Monsters');
    expect(keep).toHaveTextContent('1 in 120,000 to 1 in 250,000');
    expect(
      screen.getByText(
        /Terror zone monster levels follow assumed rules, described in the Farming Advisor guide\./,
      ),
    ).toBeInTheDocument();
    expect(getItemSources).toHaveBeenCalledWith({
      itemId: 'harlequincrest',
      players: 1,
      magicFind: 0,
      characterLevel: 85,
    });
  });

  it('If /players or magic find change, Then the sources are loaded for them', async () => {
    // Arrange
    const getItemSources = setup({ status: 'ready', known: true, sources: [source({})] });
    await screen.findByRole('table');

    // Act
    fireEvent.change(screen.getByLabelText('Players'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Magic find'), { target: { value: '300' } });

    // Assert
    await waitFor(() =>
      expect(getItemSources).toHaveBeenLastCalledWith({
        itemId: 'harlequincrest',
        players: 3,
        magicFind: 300,
        characterLevel: 85,
      }),
    );
  });

  it('If /players and magic find are typed in, Then the inputs follow at once and the sources are requested once after a pause', async () => {
    // Arrange
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const getItemSources = setup({ status: 'ready', known: true, sources: [source({})] });
    await screen.findByRole('table');
    getItemSources.mockClear();

    // Act
    fireEvent.change(screen.getByLabelText('Magic find'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Magic find'), { target: { value: '30' } });
    fireEvent.change(screen.getByLabelText('Magic find'), { target: { value: '300' } });
    const shownImmediately = screen.getByLabelText('Magic find');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FARMING_INPUT_DEBOUNCE_MS - 1);
    });
    const callsBeforePause = getItemSources.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    // Assert
    expect(shownImmediately).toHaveValue(300);
    expect(callsBeforePause).toBe(0);
    expect(getItemSources).toHaveBeenCalledTimes(1);
    expect(getItemSources).toHaveBeenCalledWith({
      itemId: 'harlequincrest',
      players: 1,
      magicFind: 300,
      characterLevel: 85,
    });
  });

  it('If there are many sources, Then the list can be expanded', async () => {
    // Arrange
    const sources = Array.from({ length: 10 }, (_, index) =>
      source({ locationId: `boss:${index}:hell`, name: `Boss ${index}` }),
    );
    setup({ status: 'ready', known: true, sources });
    await screen.findByRole('table');

    // Act
    const before = screen.getAllByRole('row').length;
    fireEvent.click(screen.getByRole('button', { name: 'Show all 10' }));

    // Assert
    expect(before).toBe(9);
    expect(screen.getAllByRole('row')).toHaveLength(11);
  });

  it('If the game files are not available, Then it links to the farming advisor', async () => {
    // Arrange & Act
    setup({ status: 'unavailable', errorCode: 'gameFilesMissing', missingFiles: [] });

    // Assert
    expect(await screen.findByRole('link', { name: 'Open the farming advisor' })).toHaveAttribute(
      'href',
      '/farming',
    );
  });

  it('If no monster drops the item, Then it says so', async () => {
    // Arrange & Act
    setup({ status: 'ready', known: true, sources: [] });

    // Assert
    expect(
      await screen.findByText('No monster in the game files drops this item.'),
    ).toBeInTheDocument();
  });

  it('If the item is a runeword, Then nothing is shown', () => {
    // Arrange
    const runeword = HolyGrailItemBuilder.new().withId('enigma').withType('runeword').build();

    // Act
    const getItemSources = setup({ status: 'ready', known: false, sources: [] }, runeword);

    // Assert
    expect(screen.queryByText('Where to farm')).not.toBeInTheDocument();
    expect(getItemSources).not.toHaveBeenCalled();
  });
});
