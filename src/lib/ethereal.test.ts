import type { EtherealType, Settings } from 'electron/types/grail';
import { GameMode, GameVersion } from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import { GrailProgressBuilder, HolyGrailItemBuilder } from '@/fixtures';
import {
  canItemBeEthereal,
  canItemBeNormal,
  canItemHaveVersion,
  filterItemsByTrackedVersions,
  getEtherealTypeDescription,
  getVersionFindStatuses,
  isEtherealOnly,
  isTrackedFind,
  shouldShowEtherealStatus,
  shouldShowNormalStatus,
} from './ethereal';

// Default settings for testing
const defaultSettings: Settings = {
  saveDir: '',
  lang: 'en',
  gameMode: GameMode.Both,
  grailNormal: true,
  grailEthereal: true,
  grailRunes: false,
  grailRunewords: false,
  gameVersion: GameVersion.Resurrected,
  enableSounds: true,
  notificationVolume: 0.5,
  inAppNotifications: true,
  nativeNotifications: true,
  needsSeeding: true,
  theme: 'system',
  showItemIcons: true,
};

describe('When canItemBeEthereal is called', () => {
  describe('If item etherealType is "none"', () => {
    it('Then should return false', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('none').build();

      // Act
      const result = canItemBeEthereal(item);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If item etherealType is "optional"', () => {
    it('Then should return true', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('optional').build();

      // Act
      const result = canItemBeEthereal(item);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If item etherealType is "only"', () => {
    it('Then should return true', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('only').build();

      // Act
      const result = canItemBeEthereal(item);

      // Assert
      expect(result).toBe(true);
    });
  });
});

describe('When isEtherealOnly is called', () => {
  describe('If item etherealType is "none"', () => {
    it('Then should return false', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('none').build();

      // Act
      const result = isEtherealOnly(item);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If item etherealType is "optional"', () => {
    it('Then should return false', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('optional').build();

      // Act
      const result = isEtherealOnly(item);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If item etherealType is "only"', () => {
    it('Then should return true', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('only').build();

      // Act
      const result = isEtherealOnly(item);

      // Assert
      expect(result).toBe(true);
    });
  });
});

describe('When canItemBeNormal is called', () => {
  describe('If item etherealType is "none"', () => {
    it('Then should return true', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('none').build();

      // Act
      const result = canItemBeNormal(item);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If item etherealType is "optional"', () => {
    it('Then should return true', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('optional').build();

      // Act
      const result = canItemBeNormal(item);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If item etherealType is "only"', () => {
    it('Then should return false', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('only').build();

      // Act
      const result = canItemBeNormal(item);

      // Assert
      expect(result).toBe(false);
    });
  });
});

describe('When getEtherealTypeDescription is called', () => {
  describe('If etherealType is "none"', () => {
    it('Then should return "Cannot be ethereal"', () => {
      // Arrange
      const etherealType: EtherealType = 'none';

      // Act
      const result = getEtherealTypeDescription(etherealType);

      // Assert
      expect(result).toBe('Cannot be ethereal');
    });
  });

  describe('If etherealType is "optional"', () => {
    it('Then should return "Can be normal or ethereal"', () => {
      // Arrange
      const etherealType: EtherealType = 'optional';

      // Act
      const result = getEtherealTypeDescription(etherealType);

      // Assert
      expect(result).toBe('Can be normal or ethereal');
    });
  });

  describe('If etherealType is "only"', () => {
    it('Then should return "Always ethereal"', () => {
      // Arrange
      const etherealType: EtherealType = 'only';

      // Act
      const result = getEtherealTypeDescription(etherealType);

      // Assert
      expect(result).toBe('Always ethereal');
    });
  });

  describe('If etherealType is invalid', () => {
    it('Then should return "Unknown"', () => {
      // Arrange
      const etherealType = 'invalid' as EtherealType;

      // Act
      const result = getEtherealTypeDescription(etherealType);

      // Assert
      expect(result).toBe('Unknown');
    });
  });
});

describe('When shouldShowEtherealStatus is called', () => {
  describe('If item can be ethereal', () => {
    it('Then should return true', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('optional').build();

      // Act
      const result = shouldShowEtherealStatus(item, defaultSettings);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If item cannot be ethereal', () => {
    it('Then should return false', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('none').build();

      // Act
      const result = shouldShowEtherealStatus(item, defaultSettings);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If item is ethereal only', () => {
    it('Then should return true', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('only').build();

      // Act
      const result = shouldShowEtherealStatus(item, defaultSettings);

      // Assert
      expect(result).toBe(true);
    });
  });
});

describe('When shouldShowNormalStatus is called', () => {
  describe('If item can be normal', () => {
    it('Then should return true', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('optional').build();

      // Act
      const result = shouldShowNormalStatus(item, defaultSettings);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If item cannot be normal', () => {
    it('Then should return false', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('only').build();

      // Act
      const result = shouldShowNormalStatus(item, defaultSettings);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If item is normal only', () => {
    it('Then should return true', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('none').build();

      // Act
      const result = shouldShowNormalStatus(item, defaultSettings);

      // Assert
      expect(result).toBe(true);
    });
  });
});

// Integration tests to verify function relationships
describe('When testing function relationships', () => {
  describe('If item etherealType is "optional"', () => {
    it('Then canItemBeEthereal and canItemBeNormal should both return true', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('optional').build();

      // Act
      const canBeEthereal = canItemBeEthereal(item);
      const canBeNormal = canItemBeNormal(item);

      // Assert
      expect(canBeEthereal).toBe(true);
      expect(canBeNormal).toBe(true);
    });

    it('Then isEtherealOnly should return false', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('optional').build();

      // Act
      const result = isEtherealOnly(item);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If item etherealType is "only"', () => {
    it('Then canItemBeEthereal should return true and canItemBeNormal should return false', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('only').build();

      // Act
      const canBeEthereal = canItemBeEthereal(item);
      const canBeNormal = canItemBeNormal(item);

      // Assert
      expect(canBeEthereal).toBe(true);
      expect(canBeNormal).toBe(false);
    });

    it('Then isEtherealOnly should return true', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('only').build();

      // Act
      const result = isEtherealOnly(item);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If item etherealType is "none"', () => {
    it('Then canItemBeEthereal should return false and canItemBeNormal should return true', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('none').build();

      // Act
      const canBeEthereal = canItemBeEthereal(item);
      const canBeNormal = canItemBeNormal(item);

      // Assert
      expect(canBeEthereal).toBe(false);
      expect(canBeNormal).toBe(true);
    });

    it('Then isEtherealOnly should return false', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType('none').build();

      // Act
      const result = isEtherealOnly(item);

      // Assert
      expect(result).toBe(false);
    });
  });
});

describe('When filterItemsByTrackedVersions is called', () => {
  const normalOnly = HolyGrailItemBuilder.new().withId('n').withEtherealType('none').build();
  const optional = HolyGrailItemBuilder.new().withId('o').withEtherealType('optional').build();
  const etherealOnly = HolyGrailItemBuilder.new().withId('e').withEtherealType('only').build();
  const items = [normalOnly, optional, etherealOnly];

  describe.each([
    ['both normal and ethereal are tracked', true, true, ['n', 'o', 'e']],
    ['only normal is tracked', true, false, ['n', 'o']],
    ['only ethereal is tracked', false, true, ['o', 'e']],
    ['neither is tracked', false, false, []],
  ])('If %s', (_label, grailNormal, grailEthereal, expectedIds) => {
    it('Then keeps only the items with a tracked version', () => {
      // Arrange & Act
      const result = filterItemsByTrackedVersions(items, { grailNormal, grailEthereal });

      // Assert
      expect(result.map((item) => item.id)).toEqual(expectedIds);
    });
  });
});

describe('When isTrackedFind is called', () => {
  const optional = HolyGrailItemBuilder.new().withId('o').withEtherealType('optional').build();
  const etherealFind = GrailProgressBuilder.new()
    .withItemId('o')
    .withFoundDate(new Date('2026-01-31'))
    .asEthereal()
    .build();
  const normalFind = GrailProgressBuilder.new()
    .withItemId('o')
    .withFoundDate(new Date('2026-01-31'))
    .asNormal()
    .build();

  describe.each([
    ['an ethereal find while ethereal tracking is off', etherealFind, true, false, false],
    ['an ethereal find while ethereal tracking is on', etherealFind, false, true, true],
    ['a normal find while normal tracking is on', normalFind, true, false, true],
    ['a normal find while normal tracking is off', normalFind, false, true, false],
  ])('If it gets %s', (_label, progress, grailNormal, grailEthereal, expected) => {
    it(`Then returns ${expected}`, () => {
      // Arrange & Act
      const result = isTrackedFind(optional, progress, { grailNormal, grailEthereal });

      // Assert
      expect(result).toBe(expected);
    });
  });

  describe('If the record has no found date', () => {
    it('Then returns false', () => {
      // Arrange
      const progress = { ...normalFind, foundDate: undefined };

      // Act
      const result = isTrackedFind(optional, progress, { grailNormal: true, grailEthereal: true });

      // Assert
      expect(result).toBe(false);
    });
  });
});

describe('When canItemHaveVersion is called', () => {
  describe.each([
    ['none', 'normal', true],
    ['none', 'ethereal', false],
    ['optional', 'normal', true],
    ['optional', 'ethereal', true],
    ['only', 'normal', false],
    ['only', 'ethereal', true],
  ] as const)('If the ethereal type is %s', (etherealType, version, expected) => {
    it(`Then the ${version} version ${expected ? 'exists' : 'does not exist'}`, () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withEtherealType(etherealType).build();

      // Act
      const result = canItemHaveVersion(item, version);

      // Assert
      expect(result).toBe(expected);
    });
  });
});

describe('When getVersionFindStatuses is called', () => {
  const optional = HolyGrailItemBuilder.new().withId('o').withEtherealType('optional').build();
  const etherealFind = GrailProgressBuilder.new()
    .withItemId('o')
    .withFoundDate(new Date('2026-01-31'))
    .asEthereal()
    .build();

  describe('If ethereal tracking is off and only the ethereal version was found', () => {
    it('Then lists the missing normal version and the untracked ethereal find', () => {
      // Arrange & Act
      const result = getVersionFindStatuses(optional, [etherealFind], {
        grailNormal: true,
        grailEthereal: false,
      });

      // Assert
      expect(result).toEqual([
        { version: 'normal', tracked: true, found: false },
        { version: 'ethereal', tracked: false, found: true },
      ]);
    });
  });

  describe('If ethereal tracking is off and nothing was found', () => {
    it('Then lists only the tracked normal version', () => {
      // Arrange & Act
      const result = getVersionFindStatuses(optional, [], {
        grailNormal: true,
        grailEthereal: false,
      });

      // Assert
      expect(result).toEqual([{ version: 'normal', tracked: true, found: false }]);
    });
  });

  describe('If the item cannot be ethereal', () => {
    it('Then never lists an ethereal version', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('n').withEtherealType('none').build();

      // Act
      const result = getVersionFindStatuses(item, [], { grailNormal: true, grailEthereal: true });

      // Assert
      expect(result).toEqual([{ version: 'normal', tracked: true, found: false }]);
    });
  });

  describe('If a find is of a version the item cannot have', () => {
    it('Then the find is not listed', () => {
      // Arrange
      const item = HolyGrailItemBuilder.new().withId('n').withEtherealType('none').build();
      const strayFind = GrailProgressBuilder.new()
        .withItemId('n')
        .withFoundDate(new Date('2026-01-31'))
        .asEthereal()
        .build();

      // Act
      const result = getVersionFindStatuses(item, [strayFind], {
        grailNormal: true,
        grailEthereal: true,
      });

      // Assert
      expect(result).toEqual([{ version: 'normal', tracked: true, found: false }]);
    });
  });
});
