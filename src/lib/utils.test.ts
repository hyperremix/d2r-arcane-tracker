import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cn, isRecentFind } from './utils';

describe('When cn function is called', () => {
  describe('If no arguments are provided', () => {
    it('Then should return empty string', () => {
      // Arrange
      const inputs: string[] = [];

      // Act
      const result = cn(...inputs);

      // Assert
      expect(result).toBe('');
    });
  });

  describe('If single string argument is provided', () => {
    it('Then should return the string', () => {
      // Arrange
      const className = 'test-class';

      // Act
      const result = cn(className);

      // Assert
      expect(result).toBe('test-class');
    });
  });

  describe('If multiple string arguments are provided', () => {
    it('Then should merge the classes', () => {
      // Arrange
      const class1 = 'class1';
      const class2 = 'class2';
      const class3 = 'class3';

      // Act
      const result = cn(class1, class2, class3);

      // Assert
      expect(result).toBe('class1 class2 class3');
    });
  });

  describe('If conflicting Tailwind classes are provided', () => {
    it('Then should resolve conflicts using tailwind-merge', () => {
      // Arrange
      const conflictingClasses = 'p-4 p-8';

      // Act
      const result = cn(conflictingClasses);

      // Assert
      expect(result).toBe('p-8');
    });
  });

  describe('If conditional classes are provided', () => {
    it('Then should include only truthy values', () => {
      // Arrange
      const condition = true;
      const falseCondition = false;

      // Act
      const result = cn(
        'base-class',
        condition && 'conditional-class',
        falseCondition && 'false-class',
      );

      // Assert
      expect(result).toBe('base-class conditional-class');
    });
  });

  describe('If object with boolean values is provided', () => {
    it('Then should include only truthy properties', () => {
      // Arrange
      const classObject = {
        'active-class': true,
        'inactive-class': false,
        'another-class': true,
      };

      // Act
      const result = cn(classObject);

      // Assert
      expect(result).toBe('active-class another-class');
    });
  });

  describe('If array of classes is provided', () => {
    it('Then should flatten and merge the array', () => {
      // Arrange
      const classArray = ['class1', 'class2', 'class3'];

      // Act
      const result = cn(classArray);

      // Assert
      expect(result).toBe('class1 class2 class3');
    });
  });

  describe('If mixed types are provided', () => {
    it('Then should handle all types correctly', () => {
      // Arrange
      const stringClass = 'string-class';
      const conditionalClass = true && 'conditional-class';
      const objectClass = { 'object-class': true, 'false-class': false };
      const arrayClass = ['array-class1', 'array-class2'];

      // Act
      const result = cn(stringClass, conditionalClass, objectClass, arrayClass);

      // Assert
      expect(result).toBe('string-class conditional-class object-class array-class1 array-class2');
    });
  });
});

describe('When isRecentFind function is called', () => {
  beforeEach(() => {
    // Mock system time for Day.js
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('If foundDate is undefined', () => {
    it('Then should return false', () => {
      // Arrange
      const foundDate = undefined;

      // Act
      const result = isRecentFind(foundDate);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If foundDate is null', () => {
    it('Then should return false', () => {
      // Arrange
      const foundDate = null as unknown as Date;

      // Act
      const result = isRecentFind(foundDate);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If foundDate is within default threshold (7 days)', () => {
    it('Then should return true', () => {
      // Arrange
      const foundDate = new Date('2024-01-10T12:00:00Z'); // 5 days ago

      // Act
      const result = isRecentFind(foundDate);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If foundDate is exactly at default threshold (7 days)', () => {
    it('Then should return false', () => {
      // Arrange
      const foundDate = new Date('2024-01-08T12:00:00Z'); // Exactly 7 days ago

      // Act
      const result = isRecentFind(foundDate);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If foundDate is beyond default threshold (7 days)', () => {
    it('Then should return false', () => {
      // Arrange
      const foundDate = new Date('2024-01-07T12:00:00Z'); // 8 days ago

      // Act
      const result = isRecentFind(foundDate);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If foundDate is in the future', () => {
    it('Then should return true', () => {
      // Arrange
      const foundDate = new Date('2024-01-20T12:00:00Z'); // 5 days in the future

      // Act
      const result = isRecentFind(foundDate);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If custom threshold is provided', () => {
    it('Then should use custom threshold instead of default', () => {
      // Arrange
      const foundDate = new Date('2024-01-05T12:00:00Z'); // 10 days ago
      const customThreshold = 15; // 15 days

      // Act
      const result = isRecentFind(foundDate, customThreshold);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If custom threshold is smaller than default', () => {
    it('Then should use custom threshold', () => {
      // Arrange
      const foundDate = new Date('2024-01-10T12:00:00Z'); // 5 days ago
      const customThreshold = 3; // 3 days

      // Act
      const result = isRecentFind(foundDate, customThreshold);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If custom threshold is zero', () => {
    it('Then should return false for any past date', () => {
      // Arrange
      const foundDate = new Date('2024-01-15T11:59:59Z'); // 1 second ago
      const customThreshold = 0;

      // Act
      const result = isRecentFind(foundDate, customThreshold);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If custom threshold is negative', () => {
    it('Then should return false for any past date', () => {
      // Arrange
      const foundDate = new Date('2024-01-15T11:59:59Z'); // 1 second ago
      const customThreshold = -1;

      // Act
      const result = isRecentFind(foundDate, customThreshold);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If foundDate is exactly at custom threshold', () => {
    it('Then should return false', () => {
      // Arrange
      const foundDate = new Date('2024-01-10T12:00:00Z'); // 5 days ago
      const customThreshold = 5;

      // Act
      const result = isRecentFind(foundDate, customThreshold);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If foundDate is just beyond custom threshold', () => {
    it('Then should return false', () => {
      // Arrange
      const foundDate = new Date('2024-01-09T12:00:00Z'); // 6 days ago
      const customThreshold = 5;

      // Act
      const result = isRecentFind(foundDate, customThreshold);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If foundDate is very recent (within 1 day)', () => {
    it('Then should return true', () => {
      // Arrange
      const foundDate = new Date('2024-01-14T12:00:00Z'); // 1 day ago

      // Act
      const result = isRecentFind(foundDate);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('If foundDate is very old (months ago)', () => {
    it('Then should return false', () => {
      // Arrange
      const foundDate = new Date('2023-01-15T12:00:00Z'); // 1 year ago

      // Act
      const result = isRecentFind(foundDate);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('If foundDate is at the exact current time', () => {
    it('Then should return true', () => {
      // Arrange
      const foundDate = new Date('2024-01-15T12:00:00Z'); // Exact current time

      // Act
      const result = isRecentFind(foundDate);

      // Assert
      expect(result).toBe(true);
    });
  });
});
