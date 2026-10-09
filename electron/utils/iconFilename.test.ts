import { describe, expect, it } from 'vitest';
import {
  getPathBasename,
  normalizeIconFilename,
  stripKnownImageExtension,
  toSnakeCaseIconFilename,
} from './iconFilename';

describe('When getPathBasename is called', () => {
  describe.each([
    ['a POSIX path', 'items/armor/invhlm.png', 'invhlm.png'],
    ['a Windows path', 'C:\\items\\invhlm.dc6', 'invhlm.dc6'],
    ['a bare filename', 'invhlm', 'invhlm'],
    ['a path with a trailing POSIX separator', 'dir/file.png/', 'file.png'],
    ['a path with a trailing Windows separator', 'items\\armor\\', 'armor'],
    ['a name with several trailing separators', 'a//', 'a'],
    ['a single trailing separator', 'a/', 'a'],
    ['only a separator', '/', ''],
    ['an empty string', '', ''],
  ])('If the input is %s', (_label, input, expected) => {
    it('Then the last path segment is returned', () => {
      // Arrange / Act
      const result = getPathBasename(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});

describe('When stripKnownImageExtension is called', () => {
  describe('If the filename has a known image extension', () => {
    it('Then the extension is removed case-insensitively', () => {
      // Arrange / Act
      const results = [
        stripKnownImageExtension('invhlm.PNG'),
        stripKnownImageExtension('invhlm.sprite'),
      ];

      // Assert
      expect(results).toEqual(['invhlm', 'invhlm']);
    });
  });

  describe('If the filename has another extension', () => {
    it('Then the filename is kept as is', () => {
      // Arrange / Act
      const result = stripKnownImageExtension('invhlm.txt');

      // Assert
      expect(result).toBe('invhlm.txt');
    });
  });
});

describe('When normalizeIconFilename is called', () => {
  describe.each([
    ['a numeric inv_file', 17, '17.png'],
    ['a filename with an image extension', ' InvHlm.DC6 ', 'invhlm.png'],
    ['a Windows path', 'data\\global\\items\\invhlm.sprite', 'invhlm.png'],
    ['a filename without an extension', 'invhlm', 'invhlm.png'],
  ])('If the value is %s', (_label, value, expected) => {
    it('Then a lower-case png filename is returned', () => {
      // Arrange / Act
      const result = normalizeIconFilename(value);

      // Assert
      expect(result).toBe(expected);
    });
  });

  describe.each([
    ['a blank string', '   '],
    ['only an extension', '.png'],
    ['a non-finite number', Number.NaN],
    ['an object', {}],
  ])('If the value is %s', (_label, value) => {
    it('Then undefined is returned', () => {
      // Arrange / Act
      const result = normalizeIconFilename(value);

      // Assert
      expect(result).toBeUndefined();
    });
  });
});

describe('When toSnakeCaseIconFilename is called', () => {
  describe('If the value is an item name', () => {
    it('Then a snake_case png filename is returned', () => {
      // Arrange / Act
      const result = toSnakeCaseIconFilename("Tal Rasha's Guardianship");

      // Assert
      expect(result).toBe('tal_rashas_guardianship.png');
    });
  });

  describe.each([
    ['only separators', ' - '],
    ['not a string', 42],
  ])('If the value is %s', (_label, value) => {
    it('Then undefined is returned', () => {
      // Arrange / Act
      const result = toSnakeCaseIconFilename(value);

      // Assert
      expect(result).toBeUndefined();
    });
  });
});
