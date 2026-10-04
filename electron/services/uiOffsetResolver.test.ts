import { describe, expect, it } from 'vitest';
import { resolveUiOffset } from './uiOffsetResolver';

const UI_PATTERN_BYTES = [0x40, 0x84, 0xed, 0x0f, 0x94, 0x05];
const IMAGE_SIZE = 0x1000;

/**
 * Writes the UI instruction (`test bpl, bpl; setz [rip+disp32]`) at `patternRva` so that it
 * resolves to `uiOffset`, and sets the in-game flag byte (at uiOffset - 0xA) to `flagValue`.
 */
function writeUiInstruction(
  image: Buffer,
  patternRva: number,
  uiOffset: number,
  flagValue: number,
): void {
  Buffer.from(UI_PATTERN_BYTES).copy(image, patternRva);
  image.writeInt32LE(uiOffset - (patternRva + 10), patternRva + 6);
  if (uiOffset - 0xa >= 0 && uiOffset - 0xa < image.length) {
    image[uiOffset - 0xa] = flagValue;
  }
}

describe('When resolveUiOffset is called', () => {
  describe('If the pattern resolves to a later address', () => {
    it('Then should return pattern + 10 + displacement', () => {
      // Arrange
      const image = Buffer.alloc(IMAGE_SIZE);
      writeUiInstruction(image, 0x100, 0x800, 1);

      // Act
      const result = resolveUiOffset(image);

      // Assert
      expect(result).toBe(0x800);
    });
  });

  describe('If the displacement is negative', () => {
    it('Then should treat it as signed', () => {
      // Arrange
      const image = Buffer.alloc(IMAGE_SIZE);
      writeUiInstruction(image, 0x800, 0x200, 0);

      // Act
      const result = resolveUiOffset(image);

      // Assert
      expect(result).toBe(0x200);
    });
  });

  describe('If the pattern is not present', () => {
    it('Then should return undefined', () => {
      // Arrange
      const image = Buffer.alloc(IMAGE_SIZE);

      // Act
      const result = resolveUiOffset(image);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('If the first match points outside the module image', () => {
    it('Then should use the next valid match', () => {
      // Arrange
      const image = Buffer.alloc(IMAGE_SIZE);
      writeUiInstruction(image, 0x100, 0x100000, 1);
      writeUiInstruction(image, 0x300, 0x900, 1);

      // Act
      const result = resolveUiOffset(image);

      // Assert
      expect(result).toBe(0x900);
    });
  });

  describe('If an earlier match has an unexpected flag value', () => {
    it('Then should prefer a later match whose flag reads as lobby or in-game', () => {
      // Arrange
      const image = Buffer.alloc(IMAGE_SIZE);
      writeUiInstruction(image, 0x100, 0x700, 0x7f);
      writeUiInstruction(image, 0x300, 0x900, 0);

      // Act
      const result = resolveUiOffset(image);

      // Assert
      expect(result).toBe(0x900);
    });
  });

  describe('If no match has a lobby or in-game flag value', () => {
    it('Then should fall back to the first in-range match', () => {
      // Arrange
      const image = Buffer.alloc(IMAGE_SIZE);
      writeUiInstruction(image, 0x100, 0x700, 0x7f);
      writeUiInstruction(image, 0x300, 0x900, 0x55);

      // Act
      const result = resolveUiOffset(image);

      // Assert
      expect(result).toBe(0x700);
    });
  });

  describe('If the pattern is truncated at the end of the image', () => {
    it('Then should ignore it', () => {
      // Arrange
      const image = Buffer.alloc(IMAGE_SIZE);
      Buffer.from(UI_PATTERN_BYTES).copy(image, IMAGE_SIZE - UI_PATTERN_BYTES.length);

      // Act
      const result = resolveUiOffset(image);

      // Assert
      expect(result).toBeUndefined();
    });
  });
});
