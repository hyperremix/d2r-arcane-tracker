import { constants as constants105 } from '@dschu012/d2s/lib/data/versions/105_constant_data';
import type { ChronicleCategory, ChronicleEntry } from '../types/grail';
import { getGrailItemId } from '../utils/grailItemUtils';

/**
 * Reads the Chronicle, the record of discovered set items, uniques and runewords that Reign of the
 * Warlock keeps in the last sector of a v105+ shared stash (.d2i), and maps its entries to grail
 * items. Each stash file (softcore or hardcore) holds the Chronicle of its own game mode.
 *
 * Layout of the sector payload (little endian):
 * - 20-byte header: magic `C0 ED EA C0`, u16 version (1), u16 set count, u16 unique count,
 *   u16 runeword count, 8 reserved bytes.
 * - One 10-byte record per entry, sets first, then uniques, then runewords: u32 id, u16 of unknown
 *   meaning, u32 minutes since the Unix epoch (UTC) when the entry was recorded.
 * - A 64-byte block of unknown meaning, which is not read.
 * The game reorders the records of a list between saves, so their order carries no meaning.
 */

const CHRONICLE_MAGIC = 0xc0eaedc0;
const CHRONICLE_VERSION = 1;
const CHRONICLE_HEADER_SIZE = 20;
const CHRONICLE_RECORD_SIZE = 10;
const MS_PER_MINUTE = 60_000;
/** A runeword id holds its runes.txt row in the low 12 bits; the high 4 bits are always 5. */
const RUNEWORD_INDEX_MASK = 0xfff;

/** Header fields holding the entry count of each list, in the order the lists follow. */
const CHRONICLE_LISTS: ReadonlyArray<{ category: ChronicleCategory; countOffset: number }> = [
  { category: 'set', countOffset: 6 },
  { category: 'unique', countOffset: 8 },
  { category: 'runeword', countOffset: 10 },
];

/**
 * Reads the entries of a Chronicle sector payload.
 * @param payload - Payload of the stash sector that starts with the Chronicle magic
 * @returns Every recorded entry, sets first, then uniques, then runewords
 * @throws When the payload is no Chronicle of a known version or is shorter than its header says
 */
export function readChronicle(payload: Uint8Array): ChronicleEntry[] {
  const buffer = Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
  if (buffer.length < CHRONICLE_HEADER_SIZE || buffer.readUInt32LE(0) !== CHRONICLE_MAGIC) {
    throw new Error('Invalid Chronicle: missing Chronicle header');
  }

  const version = buffer.readUInt16LE(4);
  if (version !== CHRONICLE_VERSION) {
    throw new Error(`Unsupported Chronicle version ${version}`);
  }

  const lists = CHRONICLE_LISTS.map(({ category, countOffset }) => ({
    category,
    count: buffer.readUInt16LE(countOffset),
  }));
  const recordCount = lists.reduce((total, { count }) => total + count, 0);
  const recordsEnd = CHRONICLE_HEADER_SIZE + recordCount * CHRONICLE_RECORD_SIZE;
  if (recordsEnd > buffer.length) {
    throw new Error(
      `Invalid Chronicle: ${recordCount} entries need ${recordsEnd} bytes, payload has ${buffer.length}`,
    );
  }

  const entries: ChronicleEntry[] = [];
  let offset = CHRONICLE_HEADER_SIZE;
  for (const { category, count } of lists) {
    for (let i = 0; i < count; i += 1) {
      const id = buffer.readUInt32LE(offset);
      entries.push({
        category,
        index: category === 'runeword' ? id & RUNEWORD_INDEX_MASK : id,
        foundAt: new Date(buffer.readUInt32LE(offset + 6) * MS_PER_MINUTE),
      });
      offset += CHRONICLE_RECORD_SIZE;
    }
  }
  return entries;
}

/**
 * Grail item ids of the uniqueitems.txt rows of the Rainbow Facets: the eight rows share one name
 * and are told apart by their skill, which a Chronicle entry does not hold.
 */
const rainbowFacetIdsByIndex: Readonly<Record<number, string>> = {
  392: 'rainbowfacetlightningdeath',
  393: 'rainbowfacetcolddeath',
  394: 'rainbowfacetfiredeath',
  395: 'rainbowfacetpoisondeath',
  396: 'rainbowfacetlightninglevelup',
  397: 'rainbowfacetcoldlevelup',
  398: 'rainbowfacetfirelevelup',
  399: 'rainbowfacetpoisonlevelup',
};

/**
 * In-game names of the runes.txt rows the parser data still calls Hustle: Reign of the Warlock
 * renamed the body armor row to Hysteria and the weapon row to Mania.
 */
const hustleSuccessorsByIndex: Readonly<Record<number, string>> = {
  196: 'Hysteria',
  197: 'Mania',
};

/**
 * Finds the grail item of a Chronicle entry by the name its game data row has, the same way items
 * parsed from save files are matched.
 * @param entry - The Chronicle entry
 * @returns The grail item id, or null when the row is unknown or not part of the grail
 */
export function resolveChronicleGrailItemId(entry: ChronicleEntry): string | null {
  switch (entry.category) {
    case 'set':
      return getGrailItemId({ set_name: constants105.set_items[entry.index]?.n });
    case 'unique':
      return (
        rainbowFacetIdsByIndex[entry.index] ??
        getGrailItemId({ unique_name: constants105.unq_items[entry.index]?.n })
      );
    case 'runeword':
      return getGrailItemId({
        runeword_name:
          hustleSuccessorsByIndex[entry.index] ?? constants105.runewords[entry.index]?.n,
      });
  }
}
