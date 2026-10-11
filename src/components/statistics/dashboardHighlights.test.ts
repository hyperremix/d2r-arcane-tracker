import type { Item } from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import { GrailProgressBuilder, HolyGrailItemBuilder } from '@/fixtures';
import { findLastTrackedFind, summarizeRunes, summarizeSets } from './dashboardHighlights';

const NORMAL_ONLY = { grailNormal: true, grailEthereal: false };
const ETHEREAL_ONLY = { grailNormal: false, grailEthereal: true };
const BOTH_VERSIONS = { grailNormal: true, grailEthereal: true };

function buildSetItem(id: string, setName: string): Item {
  return HolyGrailItemBuilder.new().withId(id).withType('set').withSetName(setName).build();
}

function buildRune(id: string, name: string, code: string): Item {
  return {
    ...HolyGrailItemBuilder.new()
      .withId(id)
      .withName(name)
      .withType('rune')
      .withCategory('runes')
      .withoutSetName()
      .build(),
    code,
  };
}

function buildFind(itemId: string, foundDate = new Date(2026, 0, 1)) {
  return GrailProgressBuilder.new()
    .withId(`find-${itemId}-${foundDate.getTime()}`)
    .withItemId(itemId)
    .withFoundDate(foundDate)
    .build();
}

describe('When summarizing the item sets', () => {
  it('If sets are partly found, Then the closest set has the largest share found', () => {
    // Arrange
    const items = [
      ...['a1', 'a2', 'a3', 'a4'].map((id) => buildSetItem(id, "Arcanna's Tricks")),
      ...['b1', 'b2'].map((id) => buildSetItem(id, 'Angelic Raiment')),
      HolyGrailItemBuilder.new().withId('unique').withoutSetName().build(),
    ];
    const progress = ['a1', 'a2', 'a3', 'b1', 'unique'].map((itemId) => buildFind(itemId));

    // Act
    const summary = summarizeSets(items, progress, NORMAL_ONLY);

    // Assert
    expect(summary).toEqual({
      closest: { setName: "Arcanna's Tricks", found: 3, total: 4 },
      setCount: 2,
    });
  });

  it('If two sets have the same share found, Then the one with fewer items missing is closest', () => {
    // Arrange
    const items = [
      ...['a1', 'a2', 'a3', 'a4'].map((id) => buildSetItem(id, 'Arctic Gear')),
      ...['b1', 'b2'].map((id) => buildSetItem(id, 'Angelic Raiment')),
    ];
    const progress = ['a1', 'a2', 'b1'].map((itemId) => buildFind(itemId));

    // Act
    const summary = summarizeSets(items, progress, NORMAL_ONLY);

    // Assert
    expect(summary?.closest).toEqual({ setName: 'Angelic Raiment', found: 1, total: 2 });
  });

  it('If every set is complete, Then there is no closest set', () => {
    // Arrange
    const items = ['a1', 'a2'].map((id) => buildSetItem(id, 'Angelic Raiment'));
    const progress = ['a1', 'a2'].map((itemId) => buildFind(itemId));

    // Act
    const summary = summarizeSets(items, progress, NORMAL_ONLY);

    // Assert
    expect(summary).toEqual({ closest: undefined, setCount: 1 });
  });

  it('If only an untracked version of a set item was found, Then it does not count', () => {
    // Arrange
    const items = ['a1', 'a2'].map((id) => buildSetItem(id, 'Angelic Raiment'));
    const progress = [
      GrailProgressBuilder.new()
        .withItemId('a1')
        .withFoundDate(new Date(2026, 0, 1))
        .asEthereal()
        .build(),
    ];

    // Act
    const summary = summarizeSets(items, progress, NORMAL_ONLY);

    // Assert
    expect(summary?.closest?.found).toBe(0);
  });

  it('If only ethereal items are tracked, Then sets that cannot be ethereal are not summarized', () => {
    // Arrange
    const items = ['a1', 'a2'].map((id) => buildSetItem(id, 'Angelic Raiment'));
    const progress = [buildFind('a1')];

    // Act
    const summary = summarizeSets(items, progress, ETHEREAL_ONLY);

    // Assert
    expect(summary).toBeUndefined();
  });

  it('If only ethereal items are tracked, Then only sets with an ethereal version are summarized', () => {
    // Arrange
    const items = [
      buildSetItem('a1', 'Angelic Raiment'),
      HolyGrailItemBuilder.new()
        .withId('b1')
        .withType('set')
        .withSetName('Arctic Gear')
        .withEtherealType('optional')
        .build(),
    ];
    const progress = [
      GrailProgressBuilder.new()
        .withId('b1-ethereal')
        .withItemId('b1')
        .withFoundDate(new Date(2026, 0, 1))
        .asEthereal()
        .build(),
    ];

    // Act
    const summary = summarizeSets(items, progress, ETHEREAL_ONLY);

    // Assert
    expect(summary).toEqual({ closest: undefined, setCount: 1 });
  });

  it('If both versions are tracked, Then an ethereal record of an item that cannot be ethereal does not count', () => {
    // Arrange
    const items = ['a1', 'a2'].map((id) => buildSetItem(id, 'Angelic Raiment'));
    const progress = [
      GrailProgressBuilder.new()
        .withItemId('a1')
        .withFoundDate(new Date(2026, 0, 1))
        .asEthereal()
        .build(),
    ];

    // Act
    const summary = summarizeSets(items, progress, BOTH_VERSIONS);

    // Assert
    expect(summary?.closest?.found).toBe(0);
  });

  it('If no set is tracked, Then there is no summary', () => {
    // Arrange
    const items = [HolyGrailItemBuilder.new().withoutSetName().build()];

    // Act
    const summary = summarizeSets(items, [], NORMAL_ONLY);

    // Assert
    expect(summary).toBeUndefined();
  });
});

describe('When summarizing the runes', () => {
  it('If some runes are missing, Then the highest missing rune follows the rune order', () => {
    // Arrange
    const items = [
      buildRune('zod', 'Zod', 'r33'),
      buildRune('el', 'El', 'r01'),
      buildRune('ber', 'Ber', 'r30'),
      buildRune('jah', 'Jah', 'r31'),
    ];
    const progress = [buildFind('el'), buildFind('zod')];

    // Act
    const summary = summarizeRunes(items, progress, NORMAL_ONLY);

    // Assert
    expect(summary?.total).toBe(4);
    expect(summary?.missing).toBe(2);
    expect(summary?.highestMissing?.name).toBe('Jah');
  });

  it('If every rune is found, Then nothing is missing', () => {
    // Arrange
    const items = [buildRune('el', 'El', 'r01')];

    // Act
    const summary = summarizeRunes(items, [buildFind('el')], NORMAL_ONLY);

    // Assert
    expect(summary).toEqual({ total: 1, missing: 0, highestMissing: undefined });
  });

  it('If only ethereal items are tracked, Then runes that cannot be ethereal are not summarized', () => {
    // Arrange
    const items = [buildRune('el', 'El', 'r01'), buildRune('zod', 'Zod', 'r33')];
    const progress = [buildFind('el')];

    // Act
    const summary = summarizeRunes(items, progress, ETHEREAL_ONLY);

    // Assert
    expect(summary).toBeUndefined();
  });

  it('If runes are not tracked, Then there is no summary', () => {
    // Arrange
    const items = [HolyGrailItemBuilder.new().build()];

    // Act
    const summary = summarizeRunes(items, [], NORMAL_ONLY);

    // Assert
    expect(summary).toBeUndefined();
  });
});

describe('When finding the last find made while tracking', () => {
  it('If later finds came from the initial scan, Then the latest tracked find is returned', () => {
    // Arrange
    const items = ['a', 'b'].map((id) =>
      HolyGrailItemBuilder.new().withId(id).withName(id).build(),
    );
    const progress = [
      buildFind('a', new Date(2026, 0, 5)),
      GrailProgressBuilder.new()
        .withId('scan')
        .withItemId('b')
        .withFoundDate(new Date(2026, 0, 9))
        .asFromInitialScan()
        .build(),
    ];

    // Act
    const lastFind = findLastTrackedFind(items, progress, NORMAL_ONLY);

    // Assert
    expect(lastFind?.item.id).toBe('a');
    expect(lastFind?.foundDate).toEqual(new Date(2026, 0, 5));
  });

  it('If the latest find is not a tracked item, Then it is skipped', () => {
    // Arrange
    const items = [HolyGrailItemBuilder.new().withId('a').build()];
    const progress = [
      buildFind('a', new Date(2026, 0, 5)),
      buildFind('gone', new Date(2026, 0, 9)),
    ];

    // Act
    const lastFind = findLastTrackedFind(items, progress, NORMAL_ONLY);

    // Assert
    expect(lastFind?.item.id).toBe('a');
  });

  it('If everything came from the initial scan, Then there is no last find', () => {
    // Arrange
    const items = [HolyGrailItemBuilder.new().withId('a').build()];
    const progress = [GrailProgressBuilder.new().withItemId('a').asFromInitialScan().build()];

    // Act
    const lastFind = findLastTrackedFind(items, progress, NORMAL_ONLY);

    // Assert
    expect(lastFind).toBeUndefined();
  });
});

describe('When the last find respects the tracked item versions', () => {
  it('If the latest find is a version that is not tracked, Then the latest tracked version is returned', () => {
    // Arrange
    const items = [
      HolyGrailItemBuilder.new().withId('a').withName('a').withEtherealType('optional').build(),
      HolyGrailItemBuilder.new().withId('b').withName('b').withEtherealType('optional').build(),
    ];
    const progress = [
      buildFind('a', new Date(2026, 0, 5)),
      GrailProgressBuilder.new()
        .withId('b-ethereal')
        .withItemId('b')
        .withFoundDate(new Date(2026, 0, 9))
        .asEthereal()
        .build(),
    ];

    // Act
    const lastFind = findLastTrackedFind(items, progress, NORMAL_ONLY);

    // Assert
    expect(lastFind?.item.id).toBe('a');
  });

  it('If only ethereal items are tracked, Then a later find of an item that cannot be ethereal is skipped', () => {
    // Arrange
    const items = [
      HolyGrailItemBuilder.new().withId('ethereal').withEtherealType('optional').build(),
      buildSetItem('set-item', 'Angelic Raiment'),
    ];
    const progress = [
      GrailProgressBuilder.new()
        .withId('ethereal-find')
        .withItemId('ethereal')
        .withFoundDate(new Date(2026, 0, 5))
        .asEthereal()
        .build(),
      buildFind('set-item', new Date(2026, 0, 9)),
    ];

    // Act
    const lastFind = findLastTrackedFind(items, progress, ETHEREAL_ONLY);

    // Assert
    expect(lastFind?.item.id).toBe('ethereal');
  });

  it('If both versions are tracked, Then an ethereal record of an item that cannot be ethereal is skipped', () => {
    // Arrange
    const items = [buildSetItem('set-item', 'Angelic Raiment')];
    const progress = [
      GrailProgressBuilder.new()
        .withItemId('set-item')
        .withFoundDate(new Date(2026, 0, 9))
        .asEthereal()
        .build(),
    ];

    // Act
    const lastFind = findLastTrackedFind(items, progress, BOTH_VERSIONS);

    // Assert
    expect(lastFind).toBeUndefined();
  });
});
