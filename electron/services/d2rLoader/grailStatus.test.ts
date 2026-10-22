import { constants as constants105 } from '@dschu012/d2s/lib/data/versions/105_constant_data';
import { describe, expect, it } from 'vitest';
import { runes } from '../../items/runes';
import { sets } from '../../items/sets';
import { uniques } from '../../items/uniques';
import type { GrailProgress, Item } from '../../types/grail';
import {
  buildGrailStatusTable,
  getReportedItemKey,
  getStatusOfCopy,
  VersionStatus,
} from './grailStatus';

const BOTH_VERSIONS = { grailNormal: true, grailEthereal: true };

function findItem(items: Item[], id: string): Item {
  const item = items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`No catalog item ${id}`);
  return item;
}

/** Zero-based row of a unique or set in the parser data, found by its name. */
function findRow(rows: Array<{ n?: string } | undefined>, name: string): number {
  const row = rows.findIndex((candidate) => candidate?.n === name);
  if (row < 0) throw new Error(`No row named ${name}`);
  return row;
}

function createFind(itemId: string, isEthereal: boolean): GrailProgress {
  return {
    id: `${itemId}-${isEthereal}`,
    characterId: 'char-1',
    itemId,
    foundDate: new Date('2026-10-01T12:00:00Z'),
    manuallyAdded: false,
    isEthereal,
  };
}

const shako = findItem(uniques, 'harlequincrest');
const shakoRow = findRow(constants105.unq_items, 'Harlequin Crest');
const talHelm = findItem(sets, 'talrashashoradriccrest');
const talHelmRow = findRow(constants105.set_items, "Tal Rasha's Horadric Crest");
const ber = findItem(runes, 'ber');

describe('When buildGrailStatusTable builds the status the plugin shows', () => {
  it('Then uniques and set items are keyed by their row and item code, and runes by their code', () => {
    // Act
    const table = buildGrailStatusTable([shako, talHelm, ber], [], BOTH_VERSIONS);

    // Assert
    expect(table.byKey.get(`u:${shakoRow}:uap`)?.item).toBe(shako);
    expect(table.byKey.get(`s:${talHelmRow}:xsk`)?.item).toBe(talHelm);
    expect(table.byKey.get('r:r30')?.item).toBe(ber);
  });

  it('Then each tracked version is missing or found, and versions the item cannot have are not tracked', () => {
    // Arrange
    const progress = [createFind(shako.id, true), createFind(talHelm.id, false)];

    // Act
    const table = buildGrailStatusTable([shako, talHelm], progress, BOTH_VERSIONS);

    // Assert
    expect(table.byKey.get(`u:${shakoRow}:uap`)).toMatchObject({
      normal: VersionStatus.Missing,
      ethereal: VersionStatus.Found,
    });
    expect(table.byKey.get(`s:${talHelmRow}:xsk`)).toMatchObject({
      normal: VersionStatus.Found,
      ethereal: VersionStatus.NotTracked,
    });
    expect(table).toMatchObject({ found: 2, total: 3 });
  });

  it('If ethereal items are not tracked, then an ethereal find counts for nothing', () => {
    // Arrange
    const progress = [createFind(shako.id, true)];

    // Act
    const table = buildGrailStatusTable([shako], progress, {
      grailNormal: true,
      grailEthereal: false,
    });

    // Assert
    expect(table.byKey.get(`u:${shakoRow}:uap`)).toMatchObject({
      normal: VersionStatus.Missing,
      ethereal: VersionStatus.NotTracked,
    });
    expect(table).toMatchObject({ found: 0, total: 1 });
  });

  it('If a progress record has no found date, then the version stays missing', () => {
    // Arrange
    const progress = [{ ...createFind(ber.id, false), foundDate: undefined }];

    // Act
    const table = buildGrailStatusTable([ber], progress, BOTH_VERSIONS);

    // Assert
    expect(table.byKey.get('r:r30')?.normal).toBe(VersionStatus.Missing);
  });
});

describe('When getReportedItemKey builds the key of a reported item', () => {
  it('Then it matches the key the status table uses', () => {
    // Arrange
    const table = buildGrailStatusTable([shako], [], BOTH_VERSIONS);

    // Act
    const key = getReportedItemKey({
      kind: 'unique',
      recordId: shakoRow,
      code: 'uap',
      ethereal: false,
    });

    // Assert
    expect(table.byKey.get(key)?.item).toBe(shako);
  });

  it('If the row belongs to another item code, then the key matches nothing', () => {
    // Arrange
    const table = buildGrailStatusTable([shako], [], BOTH_VERSIONS);

    // Act
    const key = getReportedItemKey({
      kind: 'unique',
      recordId: shakoRow,
      code: 'cap',
      ethereal: false,
    });

    // Assert
    expect(table.byKey.has(key)).toBe(false);
  });
});

describe('When getStatusOfCopy picks the version of a copy', () => {
  it('Then an ethereal copy has the ethereal status and any other copy the normal status', () => {
    // Arrange
    const status = { item: shako, normal: VersionStatus.Found, ethereal: VersionStatus.Missing };

    // Act
    const statuses = [getStatusOfCopy(status, true), getStatusOfCopy(status, false)];

    // Assert
    expect(statuses).toEqual([VersionStatus.Missing, VersionStatus.Found]);
  });
});
