import type { EtherealType, Settings } from 'electron/types/grail';
import { GameMode, GameVersion } from 'electron/types/grail';
import { describe, expect, it } from 'vitest';
import { HolyGrailItemBuilder } from '@/fixtures';
import {
  canItemBeEthereal,
  canItemBeNormal,
  getEtherealTypeDescription,
  isEtherealOnly,
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
