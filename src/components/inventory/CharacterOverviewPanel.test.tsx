import { act, render, screen, waitFor, within } from '@testing-library/react';
import type {
  CharacterOverview,
  Difficulty,
  DifficultyProgress,
  QuestRewardState,
} from 'electron/types/grail';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CharacterOverviewPanel } from '@/components/inventory/CharacterOverviewPanel';
import { createMainEventsMock } from '@/test/mainEventsMock';

const FILE_PATH = '/saves/Warlock.d2s';
const mainEvents = createMainEventsMock();
const getCharacterOverview = vi.fn();

const ALL_REWARDS = [
  'denOfEvil',
  'charsiImbue',
  'akaraRespec',
  'radament',
  'lamEsen',
  'goldenBird',
  'izual',
  'larzukSocket',
  'anyaScroll',
] as const;

function difficulty(
  name: Difficulty,
  overrides: Partial<DifficultyProgress> = {},
  states: Partial<Record<(typeof ALL_REWARDS)[number], QuestRewardState>> = {},
): DifficultyProgress {
  return {
    difficulty: name,
    reached: true,
    completed: false,
    rewards: ALL_REWARDS.map((reward) => ({ reward, state: states[reward] ?? 'claimed' })),
    missingWaypoints: [],
    activatedWaypointCount: 39,
    totalWaypointCount: 39,
    ...overrides,
  };
}

function buildOverview(overrides: Partial<CharacterOverview> = {}): CharacterOverview {
  return {
    name: 'Warlock',
    characterClass: 'warlock',
    level: 90,
    experience: 1618479915,
    hardcore: false,
    expansion: true,
    saveVersion: 105,
    gold: { inventory: 222, stash: 2381049 },
    attributes: {
      strength: 35,
      dexterity: 20,
      vitality: 465,
      energy: 20,
      unusedStatPoints: 3,
      unusedSkillPoints: 1,
    },
    questDataAvailable: true,
    difficulties: [
      difficulty('normal', { completed: true }),
      difficulty(
        'nightmare',
        {
          missingWaypoints: [{ act: 2, waypoint: 'lostCity' }],
          activatedWaypointCount: 38,
        },
        { denOfEvil: 'unclaimed', akaraRespec: 'unclaimed' },
      ),
      difficulty(
        'hell',
        { reached: false },
        Object.fromEntries(ALL_REWARDS.map((reward) => [reward, 'notEarned'])),
      ),
    ],
    gear: {
      magicFind: 90,
      goldFind: 0,
      resistances: [
        {
          kind: 'fire',
          fromItems: 55,
          maxBonus: 0,
          byDifficulty: [
            { difficulty: 'normal', total: 85, cap: 75 },
            { difficulty: 'nightmare', total: 45, cap: 75 },
            { difficulty: 'hell', total: -15, cap: 75 },
          ],
        },
      ],
      anyaScrollBonus: 30,
      fasterCastRate: { total: 125, breakpoints: { reached: 125 } },
      fasterHitRecovery: { total: 60, breakpoints: { reached: 56, next: 86 } },
      fasterBlockRate: { total: 15 },
      increasedAttackSpeed: 40,
    },
    ...overrides,
  };
}

/** Row of a table, found by the text of its row header. */
function rowOf(name: string): HTMLElement {
  const row = screen.getByRole('rowheader', { name }).closest('tr');
  if (!row) {
    throw new Error(`No row for ${name}`);
  }
  return row;
}

describe('When CharacterOverviewPanel shows the overview of a character save', () => {
  beforeEach(() => {
    mainEvents.reset();
    getCharacterOverview.mockReset();
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      writable: true,
      value: { on: mainEvents.on, saveFile: { getCharacterOverview } },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'electronAPI');
  });

  describe('If the overview is read', () => {
    it('Then it shows the class, level, gold and base attributes', async () => {
      // Arrange
      getCharacterOverview.mockResolvedValue(buildOverview());

      // Act
      render(<CharacterOverviewPanel filePath={FILE_PATH} />);

      // Assert
      expect(await screen.findByText('Level 90 Warlock')).toBeInTheDocument();
      expect(screen.getByText('2,381,049')).toBeInTheDocument();
      expect(screen.getByText('Unused stat points').nextElementSibling).toHaveTextContent('3');
      expect(screen.getByText('Normal: Completed')).toBeInTheDocument();
      expect(screen.getByText('Hell: Not reached')).toBeInTheDocument();
      expect(getCharacterOverview).toHaveBeenCalledWith(FILE_PATH);
    });

    it('Then unclaimed rewards are marked per difficulty and the respec reads as available', async () => {
      // Arrange
      getCharacterOverview.mockResolvedValue(buildOverview());

      // Act
      render(<CharacterOverviewPanel filePath={FILE_PATH} />);

      // Assert
      await screen.findByText('Den of Evil: skill point');
      const denOfEvil = rowOf('Den of Evil: skill point');
      const [normal, nightmare, hell] = within(denOfEvil).getAllByRole('cell');
      expect(normal).toHaveTextContent('Claimed');
      expect(nightmare).toHaveTextContent('Not claimed');
      expect(nightmare).toHaveClass('bg-primary/10');
      expect(hell).toHaveTextContent('Not earned');
      const respecCells = within(rowOf("Akara's stat and skill reset")).getAllByRole('cell');
      expect(respecCells.map((cell) => cell.textContent)).toEqual([
        'Used',
        'Available',
        'Not earned',
      ]);
    });

    it("Then a note says that Radament, Larzuk and Akara's reset are read from unconfirmed flags", async () => {
      // Arrange
      getCharacterOverview.mockResolvedValue(buildOverview());

      // Act
      render(<CharacterOverviewPanel filePath={FILE_PATH} />);

      // Assert
      expect(
        await screen.findByText(
          "Radament's skill point, Larzuk's socket and Akara's reset are read from flags that weren't confirmed in game.",
        ),
      ).toBeInTheDocument();
    });

    it('Then missing waypoints are listed by act, and unreached difficulties are marked', async () => {
      // Arrange
      getCharacterOverview.mockResolvedValue(buildOverview());

      // Act
      render(<CharacterOverviewPanel filePath={FILE_PATH} />);

      // Assert
      expect(await screen.findByText('38 of 39 activated')).toBeInTheDocument();
      expect(screen.getByText('Act II').nextElementSibling).toHaveTextContent('Lost City');
      expect(screen.getAllByText('Every waypoint is activated.')).toHaveLength(1);
    });

    it('Then resistances are capped per difficulty and speed stats show their breakpoints', async () => {
      // Arrange
      getCharacterOverview.mockResolvedValue(buildOverview());

      // Act
      render(<CharacterOverviewPanel filePath={FILE_PATH} />);

      // Assert
      await screen.findByText('Fire');
      const fireCells = within(rowOf('Fire')).getAllByRole('cell');
      expect(fireCells[0]).toHaveTextContent('75%85% before the 75% cap');
      expect(fireCells[1]).toHaveTextContent('45%');
      expect(fireCells[2]).toHaveTextContent('-15%');
      expect(fireCells[2]).toHaveClass('text-destructive');
      expect(
        screen.getByText("Includes +30% from Anya's Scrolls of Resistance."),
      ).toBeInTheDocument();
      expect(
        within(rowOf('Faster cast rate'))
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      ).toEqual(['125%', '125%', 'Last one reached']);
      expect(within(rowOf('Faster hit recovery')).getAllByRole('cell')[2]).toHaveTextContent('86%');
      expect(within(rowOf('Increased attack speed')).getAllByRole('cell')[1]).toHaveTextContent(
        'Depends on weapon and skill',
      );
      expect(within(rowOf('Faster block rate')).getAllByRole('cell')[1]).toHaveTextContent(
        'No breakpoint table for this class',
      );
    });
  });

  describe('If the quest data of the save could not be read', () => {
    it('Then it says so instead of listing rewards', async () => {
      // Arrange
      getCharacterOverview.mockResolvedValue(buildOverview({ questDataAvailable: false }));

      // Act
      render(<CharacterOverviewPanel filePath={FILE_PATH} />);

      // Assert
      expect(
        await screen.findByText("The quest data of this save couldn't be read."),
      ).toBeInTheDocument();
      expect(screen.queryByText('Den of Evil: skill point')).not.toBeInTheDocument();
      expect(screen.queryByText(/weren't confirmed in game/)).not.toBeInTheDocument();
    });
  });

  describe('If the overview cannot be read', () => {
    it.each([
      ['the main process returns nothing', () => getCharacterOverview.mockResolvedValue(undefined)],
      ['the call fails', () => getCharacterOverview.mockRejectedValue(new Error('IPC failed'))],
    ])('Then it shows the unavailable message when %s', async (_, arrange) => {
      // Arrange
      arrange();

      // Act
      render(<CharacterOverviewPanel filePath={FILE_PATH} />);

      // Assert
      expect(
        await screen.findByText(/The overview couldn't be read from this save file/),
      ).toBeInTheDocument();
    });
  });

  describe('If the save file monitor reports a change', () => {
    it('Then only a change of this file reads the overview again', async () => {
      // Arrange
      getCharacterOverview.mockResolvedValue(buildOverview());
      render(<CharacterOverviewPanel filePath={FILE_PATH} />);
      await screen.findByText('Level 90 Warlock');

      // Act
      act(() => {
        mainEvents.emit('save-file-event', {
          type: 'modified',
          file: { path: '/saves/Other.d2s' },
        });
        mainEvents.emit('save-file-event', { type: 'modified', file: { path: FILE_PATH } });
      });

      // Assert
      await waitFor(() => expect(getCharacterOverview).toHaveBeenCalledTimes(2));
    });

    it('Then unmounting removes the listener', async () => {
      // Arrange
      getCharacterOverview.mockResolvedValue(buildOverview());
      const { unmount } = render(<CharacterOverviewPanel filePath={FILE_PATH} />);
      await screen.findByText('Level 90 Warlock');

      // Act
      unmount();

      // Assert
      expect(mainEvents.listenerCount('save-file-event')).toBe(0);
    });
  });
});
