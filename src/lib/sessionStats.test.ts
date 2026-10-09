import type { GrailProgress, Run, RunItem, Session } from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import { GrailProgressBuilder, HolyGrailItemBuilder } from '@/fixtures';
import { computeSessionStats, findFirstDiscoveries } from './sessionStats';

const at = (hour: number, minute = 0): Date => new Date(2024, 5, 15, hour, minute);

const session: Session = {
  id: 'session-1',
  startTime: at(10),
  totalRunTime: 600_000,
  totalSessionTime: 900_000,
  runCount: 2,
  archived: false,
  created: at(10),
  lastUpdated: at(11),
};

const makeRun = (id: string, runNumber: number, startTime: Date, duration?: number): Run => ({
  id,
  sessionId: session.id,
  runNumber,
  startTime,
  duration,
  created: startTime,
  lastUpdated: startTime,
});

const makeRunItem = (id: string, runId: string, grailProgressId?: string): RunItem => ({
  id,
  runId,
  grailProgressId,
  foundTime: at(12),
  created: at(12),
});

const progressRecord = (id: string, itemId: string, foundDate: Date): GrailProgressBuilder =>
  GrailProgressBuilder.new()
    .withId(id)
    .withCharacterId('c1')
    .withItemId(itemId)
    .withFoundDate(foundDate)
    .withFromInitialScan(false)
    .asNormal();

const normalOnly = { grailNormal: true, grailEthereal: false };
const etherealOnly = { grailNormal: false, grailEthereal: true };
const normalAndEthereal = { grailNormal: true, grailEthereal: true };

const items = [
  HolyGrailItemBuilder.new().withId('shako').withEtherealType('optional').build(),
  HolyGrailItemBuilder.new().withId('soj').build(),
];

describe('When computeSessionStats is called', () => {
  describe('If the session has finished runs with items', () => {
    it('Then run counts, durations and found items are summarised', () => {
      // Arrange
      const runs = [makeRun('r1', 1, at(10), 120_000), makeRun('r2', 2, at(10, 5), 60_000)];
      const runItems = new Map([
        ['r1', [makeRunItem('i1', 'r1'), makeRunItem('i2', 'r1')]],
        ['r2', [makeRunItem('i3', 'r2')]],
      ]);

      // Act
      const stats = computeSessionStats(session, runs, runItems, new Map());

      // Assert
      expect(stats).toEqual({
        sessionId: 'session-1',
        totalRuns: 2,
        totalTime: 900_000,
        totalRunTime: 600_000,
        averageRunDuration: 90_000,
        fastestRun: 60_000,
        slowestRun: 120_000,
        itemsFound: 3,
        newGrailItems: 0,
      });
    });
  });

  describe('If a run is still in progress', () => {
    it('Then it counts as a run but not towards the durations', () => {
      // Arrange
      const runs = [makeRun('r1', 1, at(10), 120_000), makeRun('r2', 2, at(10, 5))];

      // Act
      const stats = computeSessionStats(session, runs, new Map(), new Map());

      // Assert
      expect(stats.totalRuns).toBe(2);
      expect(stats.averageRunDuration).toBe(120_000);
      expect(stats.slowestRun).toBe(120_000);
    });
  });

  describe('If items found in the runs were added to the grail for the first time', () => {
    it('Then each of them counts once as a new grail item', () => {
      // Arrange
      const runs = [makeRun('r1', 1, at(10), 120_000), makeRun('r2', 2, at(10, 5), 60_000)];
      const progress = [
        progressRecord('p-shako', 'shako', at(10, 1)).build(),
        progressRecord('p-soj', 'soj', at(10, 6)).build(),
      ];
      const runItems = new Map([
        ['r1', [makeRunItem('i1', 'r1', 'p-shako')]],
        ['r2', [makeRunItem('i2', 'r2', 'p-soj'), makeRunItem('i3', 'r2', 'p-soj')]],
      ]);

      // Act
      const stats = computeSessionStats(
        session,
        runs,
        runItems,
        findFirstDiscoveries(progress, items, normalOnly),
      );

      // Assert
      expect(stats.itemsFound).toBe(3);
      expect(stats.newGrailItems).toBe(2);
    });
  });

  describe('If an item found in a run was already in the grail', () => {
    it('Then the repeat find is not a new grail item', () => {
      // Arrange
      const runs = [makeRun('r1', 1, at(10), 120_000)];
      // Repeat finds are linked to the record that was already in the grail
      const progress = [progressRecord('p-shako', 'shako', new Date(2024, 0, 1)).build()];
      const runItems = new Map([['r1', [makeRunItem('i1', 'r1', 'p-shako')]]]);

      // Act
      const stats = computeSessionStats(
        session,
        runs,
        runItems,
        findFirstDiscoveries(progress, items, normalOnly),
      );

      // Assert
      expect(stats.newGrailItems).toBe(0);
    });
  });
});

describe('When findFirstDiscoveries is called', () => {
  describe('If an item was found several times', () => {
    it('Then only its earliest record is a first discovery', () => {
      // Arrange
      const progress = [
        progressRecord('later', 'soj', at(12)).build(),
        progressRecord('first', 'soj', at(9)).build(),
      ];

      // Act
      const discoveries = findFirstDiscoveries(progress, items, normalOnly);

      // Assert
      expect([...discoveries.keys()]).toEqual(['first']);
    });
  });

  describe('If ethereal versions are tracked separately', () => {
    it('Then the first ethereal find is a discovery of its own', () => {
      // Arrange
      const progress: GrailProgress[] = [
        progressRecord('normal', 'shako', at(9)).build(),
        progressRecord('ethereal', 'shako', at(12)).asEthereal().build(),
      ];

      // Act
      const separate = findFirstDiscoveries(progress, items, normalAndEthereal);
      const combined = findFirstDiscoveries(progress, items, normalOnly);

      // Assert
      expect([...separate.keys()].sort()).toEqual(['ethereal', 'normal']);
      expect([...combined.keys()]).toEqual(['normal']);
    });
  });

  describe('If only normal versions are tracked', () => {
    it('Then ethereal finds are not grail discoveries', () => {
      // Arrange
      const progress: GrailProgress[] = [
        progressRecord('ethereal', 'shako', at(9)).asEthereal().build(),
        progressRecord('normal', 'shako', at(12)).build(),
      ];

      // Act
      const discoveries = findFirstDiscoveries(progress, items, normalOnly);

      // Assert
      expect([...discoveries.keys()]).toEqual(['normal']);
    });
  });

  describe('If only ethereal versions are tracked', () => {
    it('Then normal finds are not grail discoveries', () => {
      // Arrange
      const progress: GrailProgress[] = [
        progressRecord('normal', 'shako', at(9)).build(),
        progressRecord('ethereal', 'shako', at(12)).asEthereal().build(),
      ];

      // Act
      const discoveries = findFirstDiscoveries(progress, items, etherealOnly);

      // Assert
      expect([...discoveries.keys()]).toEqual(['ethereal']);
    });
  });

  describe('If no version is tracked', () => {
    it('Then nothing is a grail discovery', () => {
      // Arrange
      const progress = [progressRecord('normal', 'shako', at(9)).build()];

      // Act
      const discoveries = findFirstDiscoveries(progress, items, {
        grailNormal: false,
        grailEthereal: false,
      });

      // Assert
      expect(discoveries.size).toBe(0);
    });
  });

  describe('If an item is not tracked', () => {
    it('Then its finds are not grail discoveries', () => {
      // Arrange
      const progress = [progressRecord('rune', 'ber-rune', at(9)).build()];

      // Act
      const discoveries = findFirstDiscoveries(progress, items, normalOnly);

      // Assert
      expect(discoveries.size).toBe(0);
    });
  });
});
