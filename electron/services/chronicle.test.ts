import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ChronicleCategory } from '../types/grail';
import { readChronicle, resolveChronicleGrailItemId } from './chronicle';
import { readD2iMetadata } from './stashFormat';

/** Reads the payload of the Chronicle sector of a stash fixture. */
function readFixtureChronicle(fileName: string): Buffer {
  const buffer = readFileSync(resolve(process.cwd(), 'electron/services/fixtures', fileName));
  const sector = readD2iMetadata(buffer).sectors.find(
    (candidate) => candidate.payloadSignature === 'c0ed',
  );
  if (!sector) {
    throw new Error(`${fileName} has no Chronicle sector`);
  }
  return buffer.subarray(sector.payloadOffset, sector.payloadOffset + sector.payloadSize);
}

/** Builds a Chronicle payload with the given header fields and records. */
function buildChronicle({
  version = 1,
  records = [],
  counts,
}: {
  version?: number;
  records?: Array<{ category: ChronicleCategory; id: number; minutes: number }>;
  counts?: [number, number, number];
}): Buffer {
  const categories: ChronicleCategory[] = ['set', 'unique', 'runeword'];
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0xc0eaedc0, 0);
  header.writeUInt16LE(version, 4);
  categories.forEach((category, index) => {
    const count =
      counts?.[index] ?? records.filter((record) => record.category === category).length;
    header.writeUInt16LE(count, 6 + index * 2);
  });

  const body = categories.flatMap((category) =>
    records
      .filter((record) => record.category === category)
      .map(({ id, minutes }) => {
        const record = Buffer.alloc(10);
        record.writeUInt32LE(id, 0);
        record.writeUInt32LE(minutes, 6);
        return record;
      }),
  );
  return Buffer.concat([header, ...body, Buffer.alloc(64)]);
}

describe('When readChronicle reads the Chronicle of a real v105 shared stash', () => {
  it('Then it reads every set and unique entry with the time it was recorded', () => {
    // Arrange
    const payload = readFixtureChronicle('ModernSharedStashSoftCoreV2.d2i');

    // Act
    const entries = readChronicle(payload);

    // Assert
    expect(entries.filter((entry) => entry.category === 'set')).toHaveLength(84);
    expect(entries.filter((entry) => entry.category === 'unique')).toHaveLength(144);
    expect(entries.filter((entry) => entry.category === 'runeword')).toHaveLength(0);
    expect(entries[0]).toEqual({
      category: 'set',
      index: 0,
      foundAt: new Date('2026-02-17T19:50:00.000Z'),
    });
  });

  it('Then a crafted runeword is read as its runes.txt row', () => {
    // Arrange
    const payload = readFixtureChronicle('ModernSharedStashSoftCoreV2.spirit.d2i');

    // Act
    const entries = readChronicle(payload);

    // Assert
    expect(entries.filter((entry) => entry.category === 'runeword')).toEqual([
      { category: 'runeword', index: 155, foundAt: new Date('2026-10-17T06:56:00.000Z') },
    ]);
  });

  it('Then every entry of both fixtures resolves to a grail item', () => {
    // Arrange
    const entries = [
      ...readChronicle(readFixtureChronicle('ModernSharedStashSoftCoreV2.d2i')),
      ...readChronicle(readFixtureChronicle('ModernSharedStashSoftCoreV2.spirit.d2i')),
    ];

    // Act
    const unresolved = entries.filter((entry) => resolveChronicleGrailItemId(entry) === null);

    // Assert
    expect(unresolved).toEqual([]);
  });
});

describe('When readChronicle reads a payload that is no readable Chronicle', () => {
  it('Then a payload without the Chronicle magic throws', () => {
    // Arrange
    const payload = buildChronicle({});
    payload.writeUInt32LE(0, 0);

    // Act & Assert
    expect(() => readChronicle(payload)).toThrow('missing Chronicle header');
  });

  it('Then a payload shorter than the header throws', () => {
    // Arrange
    const payload = buildChronicle({}).subarray(0, 12);

    // Act & Assert
    expect(() => readChronicle(payload)).toThrow('missing Chronicle header');
  });

  it('Then an unknown version throws', () => {
    // Arrange
    const payload = buildChronicle({ version: 2 });

    // Act & Assert
    expect(() => readChronicle(payload)).toThrow('Unsupported Chronicle version 2');
  });

  it('Then a header that counts more entries than the payload holds throws', () => {
    // Arrange
    const payload = buildChronicle({ counts: [0, 50, 0] });

    // Act & Assert
    expect(() => readChronicle(payload)).toThrow('50 entries need');
  });
});

describe('When readChronicle reads records of every list', () => {
  it('Then the lists follow each other and the runeword flag bits are dropped', () => {
    // Arrange
    const payload = buildChronicle({
      records: [
        { category: 'set', id: 3, minutes: 1 },
        { category: 'unique', id: 7, minutes: 2 },
        { category: 'runeword', id: 0x5000 | 155, minutes: 3 },
      ],
    });

    // Act
    const entries = readChronicle(payload);

    // Assert
    expect(entries).toEqual([
      { category: 'set', index: 3, foundAt: new Date(60_000) },
      { category: 'unique', index: 7, foundAt: new Date(120_000) },
      { category: 'runeword', index: 155, foundAt: new Date(180_000) },
    ]);
  });
});

describe('When resolveChronicleGrailItemId maps an entry to a grail item', () => {
  it.each([
    ['set', 0, 'civerbsward'],
    ['unique', 154, 'bloodletter'],
    ['unique', 393, 'rainbowfacetcolddeath'],
    ['unique', 399, 'rainbowfacetpoisonlevelup'],
    ['runeword', 155, 'spirit'],
    ['runeword', 101, 'lore'],
    ['runeword', 196, 'hysteria'],
    ['runeword', 197, 'mania'],
  ] as const)('Then the %s row %i is %s', (category, index, expectedId) => {
    // Arrange
    const entry = { category, index, foundAt: new Date(0) };

    // Act
    const itemId = resolveChronicleGrailItemId(entry);

    // Assert
    expect(itemId).toBe(expectedId);
  });

  it.each([
    ['set', 9999],
    ['unique', 126],
    ['runeword', 0],
  ] as const)('Then the %s row %i that is no grail item resolves to null', (category, index) => {
    // Arrange
    const entry = { category, index, foundAt: new Date(0) };

    // Act
    const itemId = resolveChronicleGrailItemId(entry);

    // Assert
    expect(itemId).toBeNull();
  });
});
