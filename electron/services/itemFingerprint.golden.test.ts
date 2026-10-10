import { describe, expect, it } from 'vitest';
import { D2SItemBuilder } from '@/fixtures';
import type { D2SItem } from '../types/grail';
import {
  type NormalizeInventoryItemParams,
  normalizeInventoryItem,
  normalizeItemsWithSocketedItems,
} from './itemNormalizer';

/**
 * Vault rows are keyed by item fingerprints, so a changed fingerprint orphans stored rows. The
 * expected strings below were captured from the implementation before the fingerprint inputs were
 * moved out of the renderer-facing item, and must never be updated to follow a code change.
 *
 * Fingerprint layout: source file type | character | location | item code | quality | ethereal |
 * socket count | stash tab | grid x | grid y | grid width | grid height | equipped slot | icon
 * file name | socketed item | item name. The icon file name is the one the d2s parser reports
 * (`inv_file`), not the resolved icon the UI shows (`cap_hat.png` for the helm below).
 */

const helm = (extra: Record<string, unknown> = {}): D2SItem =>
  ({
    ...D2SItemBuilder.new().withId(1).asUniqueHelm().withUniqueName('Harlequin Crest').build(),
    ...extra,
  }) as D2SItem;

const rune = (extra: Record<string, unknown> = {}): D2SItem =>
  ({
    ...D2SItemBuilder.new().withId(2).asRune('r30').withCode('r30').withName('Ber Rune').build(),
    ...extra,
  }) as D2SItem;

const params = (
  item: D2SItem,
  overrides: Partial<NormalizeInventoryItemParams> = {},
): NormalizeInventoryItemParams => ({
  filePath: '/test/TestChar.d2s',
  saveName: 'TestChar',
  sourceFileType: 'd2s',
  fallbackLocation: 'inventory',
  item,
  ...overrides,
});

interface FingerprintCase {
  scenario: string;
  item: D2SItem;
  overrides?: Partial<NormalizeInventoryItemParams>;
  fingerprint: string;
}

const cases: FingerprintCase[] = [
  {
    scenario: 'the parser icon name differs from the resolved icon',
    item: helm({ inv_file: 'invhlm' }),
    fingerprint:
      'd2s|TestChar|inventory|armo|unique|false|0|||||||invhlm.png|false|Harlequin Crest',
  },
  {
    scenario: 'the parser icon name has a different case',
    item: helm({ inv_file: 'Invhlm' }),
    fingerprint:
      'd2s|TestChar|inventory|armo|unique|false|0|||||||invhlm.png|false|Harlequin Crest',
  },
  {
    scenario: 'the parser icon name is undefined',
    item: helm({ inv_file: undefined }),
    fingerprint:
      'd2s|TestChar|inventory|armo|unique|false|0|||||||cap_hat.png|false|Harlequin Crest',
  },
  {
    scenario: 'the parser icon name is empty',
    item: helm({ inv_file: '' }),
    fingerprint:
      'd2s|TestChar|inventory|armo|unique|false|0|||||||cap_hat.png|false|Harlequin Crest',
  },
  {
    scenario: 'the parser icon name is a path',
    item: helm({ inv_file: 'C:\\x\\..\\Inv_Foo.PNG' }),
    // The icon name keeps only the last path segment on every platform, as `node:path` basename
    // always did on Windows, where the app runs; so recorded fingerprints are unchanged.
    fingerprint:
      'd2s|TestChar|inventory|armo|unique|false|0|||||||inv_foo.png|false|Harlequin Crest',
  },
  {
    scenario: 'the parser icon name is a number',
    item: helm({ inv_file: 12 }),
    fingerprint: 'd2s|TestChar|inventory|armo|unique|false|0|||||||12.png|false|Harlequin Crest',
  },
  {
    scenario: 'an ethereal socketed helm lies in a shared stash tab',
    item: helm({
      inv_file: 'invhlm',
      ethereal: 1,
      socket_count: 2,
      gems: undefined,
      position_x: 3,
      position_y: 4,
      inv_width: 2,
      inv_height: 2,
      location_id: 0,
      alt_position_id: 5,
    }),
    overrides: { sourceFileType: 'd2i', fallbackLocation: 'stash', stashTab: 2, stackCount: 7 },
    fingerprint:
      'd2i|TestChar|stash|armo|unique|true|2|2|3|4|2|2||invhlm.png|false|Harlequin Crest',
  },
  {
    scenario: 'a helm is equipped',
    item: helm({ inv_file: 'invhlm', location_id: 1, equipped_id: 1, inv_width: 2, inv_height: 2 }),
    overrides: { fallbackLocation: 'equipped' },
    fingerprint:
      'd2s|TestChar|equipped|armo|unique|false|0||||2|2|1|invhlm.png|false|Harlequin Crest',
  },
  {
    scenario: 'a rune lies at a grid position',
    item: rune({ inv_file: 'invr30', position_x: 0, position_y: 1, inv_width: 1, inv_height: 1 }),
    fingerprint: 'd2s|TestChar|inventory|r30|crafted|false|0||0|1|1|1||invr30.png|false|Ber Rune',
  },
  {
    scenario: 'the item has neither name, type nor code',
    item: D2SItemBuilder.new()
      .withId(3)
      .withName('')
      .withoutTypeName()
      .withoutType()
      .withoutCode()
      .build(),
    fingerprint: 'd2s|TestChar|inventory||normal|false|0|||||||unknown.png|false|unknown',
  },
];

describe('When an item is normalized', () => {
  it.each(cases)('If $scenario, Then the fingerprint keeps its recorded value', ({
    item,
    overrides,
    fingerprint,
  }) => {
    // Arrange
    const normalizeParams = params(item, overrides);

    // Act
    const parsed = normalizeInventoryItem(normalizeParams);

    // Assert
    expect(parsed.fingerprint).toBe(fingerprint);
  });

  it('If the item has socketed items, Then each socketed item has its own recorded fingerprint', () => {
    // Arrange
    const parent = helm({
      inv_file: 'invhlm',
      socketed: 1,
      socketed_items: [rune({ inv_file: 'invr30' })],
    });

    // Act
    const parsed = normalizeItemsWithSocketedItems([parent], {
      filePath: '/test/TestChar.d2s',
      saveName: 'TestChar',
      sourceFileType: 'd2s',
      fallbackLocation: 'inventory',
    });

    // Assert
    expect(parsed.map((item) => item.fingerprint)).toEqual([
      'd2s|TestChar|inventory|armo|unique|false|0|||||||invhlm.png|false|Harlequin Crest',
      'd2s|TestChar|inventory|r30|crafted|false|0|||||||invr30.png|true|Ber Rune',
    ]);
  });
});
