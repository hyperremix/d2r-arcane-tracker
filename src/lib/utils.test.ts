import { describe, expect, it } from 'vitest';
import { cn } from './utils';

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
