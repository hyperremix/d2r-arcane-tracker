import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { items as catalogItems } from '../items';
import type { Character, GrailProgress } from '../types/grailProgress';
import { parseCsv } from '../utils/csv';
import {
  GRAIL_EXPORT_FORMAT,
  GRAIL_IMPORT_ERRORS,
  type GrailTransferDatabase,
  GrailTransferService,
  MAX_GRAIL_IMPORT_BYTES,
  matchGrailImport,
  planGrailImport,
  readGrailImport,
} from './grailTransfer';

const NOW = new Date('2026-10-18T12:00:00.000Z');

function character(id: string, name: string): Character {
  return {
    id,
    name,
    characterClass: 'sorceress',
    level: 90,
    hardcore: false,
    expansion: true,
    lastUpdated: NOW,
    created: NOW,
  };
}

function progress(
  overrides: Partial<GrailProgress> & Pick<GrailProgress, 'itemId'>,
): GrailProgress {
  return {
    id: `progress-${overrides.itemId}-${overrides.isEthereal ? 'eth' : 'normal'}`,
    characterId: 'char-1',
    foundDate: new Date('2026-05-01T00:00:00.000Z'),
    manuallyAdded: false,
    isEthereal: false,
    ...overrides,
  };
}

/** In-memory database with the real item catalog. */
function createDatabase(initialProgress: GrailProgress[] = []) {
  const records = new Map(initialProgress.map((record) => [record.id, record]));
  const characters = [character('char-1', 'Sorc'), character('char-2', 'Pala')];
  const database = {
    getAllItems: () => catalogItems,
    getAllProgress: () => [...records.values()],
    getCharacterMap: () => new Map(characters.map((c) => [c.id, c.name])),
    getCharacterById: (id: string) => characters.find((c) => c.id === id),
    getCharacterByName: (name: string) => characters.find((c) => c.name === name),
    upsertProgress: vi.fn((record: GrailProgress) => {
      records.set(record.id, record);
    }),
    transaction: <T>(fn: () => T): T => fn(),
  };
  return { database: database as unknown as GrailTransferDatabase, records, mock: database };
}

describe('When the grail progress is exported', () => {
  it('If JSON is chosen, Then every find is written with item, version, date, character and source', () => {
    // Arrange
    const { database } = createDatabase([
      progress({ itemId: 'harlequincrest', isEthereal: true, manuallyAdded: true }),
      progress({ itemId: 'annihilus', characterId: 'char-2', fromInitialScan: true }),
      progress({ itemId: 'tarnhelm', foundDate: undefined }),
    ]);
    const service = new GrailTransferService(database, () => NOW);

    // Act
    const exported = JSON.parse(service.exportProgress('json'));

    // Assert
    expect(exported).toMatchObject({ format: GRAIL_EXPORT_FORMAT, version: 1 });
    expect(exported.finds).toEqual([
      {
        itemId: 'harlequincrest',
        itemName: 'Harlequin Crest',
        itemType: 'unique',
        ethereal: true,
        foundDate: '2026-05-01T00:00:00.000Z',
        character: 'Sorc',
        source: 'manual',
        fromInitialScan: false,
      },
      {
        itemId: 'annihilus',
        itemName: 'Annihilus',
        itemType: 'unique',
        ethereal: false,
        foundDate: '2026-05-01T00:00:00.000Z',
        character: 'Pala',
        source: 'auto-detected',
        fromInitialScan: true,
      },
    ]);
  });

  it('If CSV is chosen, Then names with commas are quoted and the header names the columns', () => {
    // Arrange
    const { database } = createDatabase([progress({ itemId: 'talrashasguardianship' })]);
    const service = new GrailTransferService(database, () => NOW);

    // Act
    const rows = parseCsv(service.exportProgress('csv'));

    // Assert
    expect(rows).toEqual([
      ['item', 'item_id', 'type', 'version', 'found_date', 'character', 'source'],
      [
        "Tal Rasha's Guardianship",
        'talrashasguardianship',
        'set',
        'normal',
        '2026-05-01T00:00:00.000Z',
        'Sorc',
        'auto-detected',
      ],
    ]);
  });

  it('If the export is imported into an empty grail, Then every find is added again', () => {
    // Arrange
    const { database } = createDatabase([
      progress({ itemId: 'harlequincrest', isEthereal: true }),
      progress({ itemId: 'enigma' }),
    ]);
    const exported = new GrailTransferService(database, () => NOW).exportProgress('json');

    // Act
    const { finds } = matchGrailImport(
      readGrailImport(exported, '.json', NOW).entries,
      catalogItems,
    );

    // Assert
    expect(finds).toEqual([
      expect.objectContaining({
        itemId: 'harlequincrest',
        isEthereal: true,
        characterName: 'Sorc',
      }),
      expect.objectContaining({ itemId: 'enigma', isEthereal: false }),
    ]);
  });
});

describe('When an import file is read', () => {
  it('If it is a Nasicus holy grail export, Then only found items are read, without a version', () => {
    // Arrange
    const content = JSON.stringify({
      uniques: {
        armor: {
          helm: {
            normal: { "Biggin's Bonnet": { wasFound: true, note: 'x' }, Tarnhelm: {} },
          },
        },
        other: {
          'rainbow facet (jewel)': { 'level up': { Light: { wasFound: true } }, die: { Cold: {} } },
          charms: { all: { Annihilus: { wasFound: 2 }, 'Hellfire Torch': { wasFound: 0 } } },
        },
      },
      sets: { "Tal Rasha's Wrappings": { "Tal Rasha's Guardianship": { wasFound: true } } },
    });

    // Act
    const { source, entries } = readGrailImport(content, '.json', NOW);
    const { finds } = matchGrailImport(entries, catalogItems);

    // Assert
    expect(source).toBe('nasicus-json');
    expect(finds.map((find) => [find.itemId, find.isEthereal])).toEqual([
      ['bigginsbonnet', false],
      ['rainbowfacetlightninglevelup', false],
      ['annihilus', false],
      ['talrashasguardianship', false],
    ]);
    expect(finds.every((find) => find.foundDate === undefined)).toBe(true);
  });

  it('If it is a Nasicus ethereal grail export, Then the finds are ethereal', () => {
    // Arrange
    const content = JSON.stringify({
      uniques: { weapons: { polearms: { elite: { "The Reaper's Toll": { wasFound: true } } } } },
    });

    // Act
    const { finds } = matchGrailImport(
      readGrailImport(content, '.json', NOW).entries,
      catalogItems,
    );

    // Assert
    expect(finds).toEqual([
      expect.objectContaining({ itemId: 'thereaperstoll', isEthereal: true }),
    ]);
  });

  it('If it is a Nasicus runeword export, Then the names are matched to runewords', () => {
    // Arrange
    const content = JSON.stringify({ 'Crescent Moon': { wasFound: true }, Enigma: {} });

    // Act
    const { finds } = matchGrailImport(
      readGrailImport(content, '.json', NOW).entries,
      catalogItems,
    );

    // Assert
    expect(finds).toHaveLength(1);
    expect(catalogItems.find((item) => item.id === finds[0].itemId)?.type).toBe('runeword');
  });

  it('If it is a CSV without a header, Then the columns are name, version and date', () => {
    // Arrange
    const content = 'Harlequin Crest,ethereal,2024-01-15\nBer Rune,,\n"Shako, the hat",,\n';

    // Act
    const { source, entries } = readGrailImport(content, '.csv', NOW);
    const { finds, unmatched } = matchGrailImport(entries, catalogItems);

    // Assert
    expect(source).toBe('csv');
    expect(finds).toEqual([
      { itemId: 'harlequincrest', isEthereal: true, foundDate: new Date(2024, 0, 15) },
      { itemId: 'ber', isEthereal: false, foundDate: undefined },
    ]);
    expect(unmatched).toEqual([{ name: 'Shako, the hat' }]);
  });

  it('If a CSV names a version the item does not have, Then the entry is listed as unmatched', () => {
    // Arrange
    const content = 'item,ethereal\nAnnihilus,yes\nGhostflame,\n';

    // Act
    const { finds, unmatched } = matchGrailImport(
      readGrailImport(content, '.csv', NOW).entries,
      catalogItems,
    );

    // Assert
    expect(unmatched).toEqual([{ name: 'Annihilus', version: 'ethereal' }]);
    // An item that only exists ethereal is recorded ethereal when the file doesn't say
    expect(finds).toEqual([expect.objectContaining({ itemId: 'ghostflame', isEthereal: true })]);
  });

  it('If an item version appears twice, Then the earliest date is kept', () => {
    // Arrange
    const content = 'item,date\nAnnihilus,2025-03-01\nAnnihilus,2024-02-01\nAnnihilus,\n';

    // Act
    const { finds } = matchGrailImport(readGrailImport(content, '.csv', NOW).entries, catalogItems);

    // Assert
    expect(finds).toEqual([
      expect.objectContaining({ itemId: 'annihilus', foundDate: new Date(2024, 1, 1) }),
    ]);
  });

  it('If a date lies in the future, Then the find has no date', () => {
    // Arrange
    const content = 'Annihilus,,2027-01-01';

    // Act
    const { finds } = matchGrailImport(readGrailImport(content, '.csv', NOW).entries, catalogItems);

    // Assert
    expect(finds[0].foundDate).toBeUndefined();
  });

  it.each([
    ['broken JSON', '{"uniques":', '.json'],
    ['a JSON array', '[1, 2]', '.json'],
    ['unrelated JSON', '{"name": "my notes", "count": 3}', '.json'],
    ['an app export without finds', `{"format": "${GRAIL_EXPORT_FORMAT}"}`, '.json'],
  ])('If the file is %s, Then it is refused as unsupported', (_, content, extension) => {
    // Arrange (the table above)

    // Act
    const read = () => readGrailImport(content, extension, NOW);

    // Assert
    expect(read).toThrow(GRAIL_IMPORT_ERRORS.unsupported);
  });
});

describe('When an import is planned', () => {
  it('Then existing item versions are not added again and an earlier date replaces a later one', () => {
    // Arrange
    const existing = [
      progress({ itemId: 'annihilus', foundDate: new Date('2026-05-01T00:00:00.000Z') }),
      progress({ itemId: 'harlequincrest', foundDate: new Date('2024-01-01T00:00:00.000Z') }),
    ];
    const finds = [
      { itemId: 'annihilus', isEthereal: false, foundDate: new Date('2025-01-01T00:00:00.000Z') },
      {
        itemId: 'harlequincrest',
        isEthereal: false,
        foundDate: new Date('2025-01-01T00:00:00.000Z'),
      },
      { itemId: 'harlequincrest', isEthereal: true },
    ];

    // Act
    const plan = planGrailImport(finds, existing);

    // Assert
    expect(plan.additions).toEqual([{ itemId: 'harlequincrest', isEthereal: true }]);
    expect(plan.existingCount).toBe(2);
    expect(plan.dateUpdates).toEqual([
      { progress: existing[0], foundDate: new Date('2025-01-01T00:00:00.000Z') },
    ]);
  });
});

describe('When an import file is previewed and applied', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'grail-import-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('Then the preview counts new and existing finds, and applying adds manual finds', async () => {
    // Arrange
    const { database, records } = createDatabase([progress({ itemId: 'annihilus' })]);
    const service = new GrailTransferService(database, () => NOW);
    const filePath = join(directory, 'grail.csv');
    await writeFile(filePath, 'item,date,character\nAnnihilus,2024-01-01,\nEnigma,,Pala\nNope,,\n');

    // Act
    const preview = await service.previewImport(filePath);
    const result = service.applyImport(preview.importId, 'char-1');

    // Assert
    expect(preview).toMatchObject({
      source: 'csv',
      fileName: 'grail.csv',
      matchedCount: 2,
      newCount: 1,
      existingCount: 1,
      earlierDateCount: 1,
      unmatched: [{ name: 'Nope' }],
    });
    expect(result).toEqual({ added: 1, earlierDates: 1 });
    const enigma = [...records.values()].find((record) => record.itemId === 'enigma');
    expect(enigma).toMatchObject({
      characterId: 'char-2',
      manuallyAdded: true,
      isEthereal: false,
      foundDate: NOW,
    });
    expect(records.get('progress-annihilus-normal')?.foundDate).toEqual(new Date(2024, 0, 1));
  });

  it('If a find names no known character, Then it is recorded for the chosen character', async () => {
    // Arrange
    const { database, records } = createDatabase();
    const service = new GrailTransferService(database, () => NOW);
    const filePath = join(directory, 'grail.csv');
    await writeFile(filePath, 'item,character\nAnnihilus,Gone\n');
    const preview = await service.previewImport(filePath);

    // Act
    service.applyImport(preview.importId, 'char-2');

    // Assert
    expect([...records.values()]).toEqual([
      expect.objectContaining({ itemId: 'annihilus', characterId: 'char-2', manuallyAdded: true }),
    ]);
  });

  it('If the import is applied twice, Then the second apply is refused', async () => {
    // Arrange
    const { database } = createDatabase();
    const service = new GrailTransferService(database, () => NOW);
    const filePath = join(directory, 'grail.csv');
    await writeFile(filePath, 'Annihilus\n');
    const preview = await service.previewImport(filePath);
    service.applyImport(preview.importId, 'char-1');

    // Act
    const applyAgain = () => service.applyImport(preview.importId, 'char-1');

    // Assert
    expect(applyAgain).toThrow(GRAIL_IMPORT_ERRORS.expired);
  });

  it('If the character does not exist, Then nothing is written', async () => {
    // Arrange
    const { database, mock } = createDatabase();
    const service = new GrailTransferService(database, () => NOW);
    const filePath = join(directory, 'grail.csv');
    await writeFile(filePath, 'Annihilus\n');
    const preview = await service.previewImport(filePath);

    // Act
    const apply = () => service.applyImport(preview.importId, 'unknown');

    // Assert
    expect(apply).toThrow(GRAIL_IMPORT_ERRORS.unknownCharacter);
    expect(mock.upsertProgress).not.toHaveBeenCalled();
  });

  it('If the file is too large, Then it is not read', async () => {
    // Arrange
    const { database } = createDatabase();
    const service = new GrailTransferService(database, () => NOW);
    const filePath = join(directory, 'grail.json');
    await writeFile(filePath, Buffer.alloc(MAX_GRAIL_IMPORT_BYTES + 1, 32));

    // Act
    const preview = service.previewImport(filePath);

    // Assert
    await expect(preview).rejects.toThrow(GRAIL_IMPORT_ERRORS.tooLarge);
  });

  it('If the file does not exist, Then the preview fails as unreadable', async () => {
    // Arrange
    const { database } = createDatabase();
    const service = new GrailTransferService(database, () => NOW);

    // Act
    const preview = service.previewImport(join(directory, 'missing.json'));

    // Assert
    await expect(preview).rejects.toThrow(GRAIL_IMPORT_ERRORS.unreadable);
  });
});
