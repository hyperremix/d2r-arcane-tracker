import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { GrailProgressBuilder, HolyGrailItemBuilder } from '@/fixtures';
import i18n from '@/i18n';
import {
  getCardStatusLabel,
  getItemSubtitle,
  getRecentFindDate,
  getTrackedVersionStatuses,
} from './cardState';

const t = i18n.t.bind(i18n) as TFunction;

function buildSettings(grailNormal: boolean, grailEthereal: boolean) {
  return { grailNormal, grailEthereal } as Parameters<typeof getTrackedVersionStatuses>[1];
}

describe('When getTrackedVersionStatuses is called', () => {
  const normal = [GrailProgressBuilder.new().asNormal().build()];
  const ethereal = [GrailProgressBuilder.new().asEthereal().build()];

  it('If ethereal tracking is off, Then no version statuses are returned', () => {
    // Arrange
    const item = HolyGrailItemBuilder.new().withEtherealType('optional').build();

    // Act
    const statuses = getTrackedVersionStatuses(item, buildSettings(true, false), normal, []);

    // Assert
    expect(statuses).toEqual([]);
  });

  it('If the item cannot be ethereal, Then no version statuses are returned', () => {
    // Arrange
    const item = HolyGrailItemBuilder.new().withEtherealType('none').build();

    // Act
    const statuses = getTrackedVersionStatuses(item, buildSettings(true, true), normal, []);

    // Assert
    expect(statuses).toEqual([]);
  });

  it('If both versions are tracked and only normal is found, Then ethereal is reported missing', () => {
    // Arrange
    const item = HolyGrailItemBuilder.new().withEtherealType('optional').build();

    // Act
    const statuses = getTrackedVersionStatuses(item, buildSettings(true, true), normal, []);

    // Assert
    expect(statuses).toEqual([
      { version: 'normal', isFound: true },
      { version: 'ethereal', isFound: false },
    ]);
  });

  it('If the item is ethereal only, Then only the ethereal version is reported', () => {
    // Arrange
    const item = HolyGrailItemBuilder.new().withEtherealType('only').build();

    // Act
    const statuses = getTrackedVersionStatuses(item, buildSettings(true, true), [], ethereal);

    // Assert
    expect(statuses).toEqual([{ version: 'ethereal', isFound: true }]);
  });

  it('If only ethereal items are tracked, Then only the ethereal version is reported', () => {
    // Arrange
    const item = HolyGrailItemBuilder.new().withEtherealType('optional').build();

    // Act
    const statuses = getTrackedVersionStatuses(item, buildSettings(false, true), normal, []);

    // Assert
    expect(statuses).toEqual([{ version: 'ethereal', isFound: false }]);
  });
});

describe('When getRecentFindDate is called', () => {
  it('If the latest find is from today and not from the initial scan, Then its date is returned', () => {
    // Arrange
    const foundDate = new Date();
    const progress = GrailProgressBuilder.new().withFoundDate(foundDate).build();

    // Act
    const result = getRecentFindDate(progress);

    // Assert
    expect(result).toBe(foundDate);
  });

  it('If the latest find comes from the initial scan, Then undefined is returned', () => {
    // Arrange
    const progress = GrailProgressBuilder.new()
      .withFoundDate(new Date())
      .asFromInitialScan()
      .build();

    // Act
    const result = getRecentFindDate(progress);

    // Assert
    expect(result).toBeUndefined();
  });

  it('If the latest find is older than 7 days, Then undefined is returned', () => {
    // Arrange
    const progress = GrailProgressBuilder.new().withFoundDate(new Date('2020-01-01')).build();

    // Act
    const result = getRecentFindDate(progress);

    // Assert
    expect(result).toBeUndefined();
  });

  it('If there is no find, Then undefined is returned', () => {
    // Arrange
    const progress = undefined;

    // Act
    const result = getRecentFindDate(progress);

    // Assert
    expect(result).toBeUndefined();
  });
});

describe('When getCardStatusLabel is called', () => {
  it('If no versions are tracked separately, Then it reports Found or Not Found', () => {
    // Arrange
    const versionStatuses: [] = [];

    // Act
    const found = getCardStatusLabel(true, versionStatuses, false, t);
    const missing = getCardStatusLabel(false, versionStatuses, false, t);

    // Assert
    expect(found).toBe('Found');
    expect(missing).toBe('Not Found');
  });

  it('If versions are tracked, Then it reports each version and a recent find', () => {
    // Arrange
    const versionStatuses = [
      { version: 'normal', isFound: true },
      { version: 'ethereal', isFound: false },
    ] as const;

    // Act
    const label = getCardStatusLabel(true, [...versionStatuses], true, t);

    // Assert
    expect(label).toBe('Normal found, Ethereal missing, Recently Found!');
  });
});

describe('When getItemSubtitle is called', () => {
  it('If a unique item has a base, Then the base item is returned', () => {
    // Arrange
    const item = HolyGrailItemBuilder.new().withType('unique').withItemBase('Shako').build();

    // Act
    const subtitle = getItemSubtitle(item);

    // Assert
    expect(subtitle).toBe('Shako');
  });

  it('If the item is a rune, Then no subtitle is returned', () => {
    // Arrange
    const item = HolyGrailItemBuilder.new().withType('rune').withItemBase('El Rune').build();

    // Act
    const subtitle = getItemSubtitle(item);

    // Assert
    expect(subtitle).toBeUndefined();
  });
});
