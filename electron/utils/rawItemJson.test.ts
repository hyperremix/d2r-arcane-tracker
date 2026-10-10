import { describe, expect, it } from 'vitest';
import { parseRawItemJson } from './rawItemJson';

interface RawItemShape {
  code?: unknown;
}

describe('When parseRawItemJson is called', () => {
  describe('If the JSON holds an object', () => {
    it('Then the parsed object is returned', () => {
      // Arrange
      const rawItemJson = '{"code":"r01"}';

      // Act
      const result = parseRawItemJson<RawItemShape>(rawItemJson);

      // Assert
      expect(result).toEqual({ code: 'r01' });
    });
  });

  describe.each([
    ['malformed JSON', '{"code":'],
    ['a JSON string', '"r01"'],
    ['a JSON number', '42'],
    ['JSON null', 'null'],
    ['an empty string', ''],
  ])('If the input is %s', (_label, rawItemJson) => {
    it('Then undefined is returned', () => {
      // Arrange / Act
      const result = parseRawItemJson<RawItemShape>(rawItemJson);

      // Assert
      expect(result).toBeUndefined();
    });
  });
});
