import { describe, expect, it } from 'vitest';
import {
  findPattern,
  findPatternString,
  parsePattern,
  readBytesFromBuffer,
} from './patternScanner';

describe('When parsePattern is called', () => {
  describe('If valid hex pattern is provided', () => {
    it('Then should parse simple pattern correctly', () => {
      // Arrange
      const pattern = '\\x44\\x88\\x25';

      // Act
      const result = parsePattern(pattern);

      // Assert
      expect(result).toEqual(Buffer.from([0x44, 0x88, 0x25]));
    });
  });

  describe('If pattern with mixed case hex is provided', () => {
    it('Then should parse correctly', () => {
      // Arrange
      const pattern = '\\xFF\\xAa\\x00';

      // Act
      const result = parsePattern(pattern);

      // Assert
      expect(result).toEqual(Buffer.from([0xff, 0xaa, 0x00]));
    });
  });

  describe('If invalid pattern is provided', () => {
    it('Then should throw error', () => {
      // Arrange
      const invalidPattern = 'not a pattern';

      // Act
      const act = () => parsePattern(invalidPattern);

      // Assert
      expect(act).toThrow('Invalid pattern format');
    });
  });

  describe('If GameData pattern from d2go is provided', () => {
    it('Then should parse full pattern correctly', () => {
      // Arrange
      const pattern = '\\x44\\x88\\x25\\x00\\x00\\x00\\x00\\x66\\x44\\x89\\x25\\x00\\x00\\x00\\x00';

      // Act
      const result = parsePattern(pattern);

      // Assert
      expect(result.length).toBe(15);
      expect(result[0]).toBe(0x44);
      expect(result[1]).toBe(0x88);
      expect(result[2]).toBe(0x25);
    });
  });
});

describe('When findPattern is called', () => {
  describe('If pattern exists at start of buffer', () => {
    it('Then should return 0', () => {
      // Arrange
      const memory = Buffer.from([0x44, 0x88, 0x25, 0xff, 0xff]);
      const pattern = Buffer.from([0x44, 0x88, 0x25]);
      const mask = 'xxx';

      // Act
      const result = findPattern(memory, pattern, mask);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('If pattern exists in middle of buffer', () => {
    it('Then should return correct offset', () => {
      // Arrange
      const memory = Buffer.from([0x00, 0x00, 0x44, 0x88, 0x25, 0xff]);
      const pattern = Buffer.from([0x44, 0x88, 0x25]);
      const mask = 'xxx';

      // Act
      const result = findPattern(memory, pattern, mask);

      // Assert
      expect(result).toBe(2);
    });
  });

  describe('If pattern has wildcard bytes', () => {
    it('Then should match regardless of wildcard values', () => {
      // Arrange
      const memory = Buffer.from([0x44, 0x88, 0x25, 0xaa, 0xbb, 0xcc, 0xdd]);
      const pattern = Buffer.from([0x44, 0x88, 0x25, 0x00, 0x00, 0x00, 0x00]);
      const mask = 'xxx????';

      // Act
      const result = findPattern(memory, pattern, mask);

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('If pattern with wildcards exists in middle', () => {
    it('Then should find pattern at correct offset', () => {
      // Arrange
      const memory = Buffer.from([0xff, 0xff, 0x44, 0x88, 0x25, 0xaa, 0xbb, 0xcc, 0xdd]);
      const pattern = Buffer.from([0x44, 0x88, 0x25, 0x00, 0x00, 0x00, 0x00]);
      const mask = 'xxx????';

      // Act
      const result = findPattern(memory, pattern, mask);

      // Assert
      expect(result).toBe(2);
    });
  });

  describe('If pattern does not exist', () => {
    it('Then should return -1', () => {
      // Arrange
      const memory = Buffer.from([0x00, 0x11, 0x22, 0x33]);
      const pattern = Buffer.from([0x44, 0x55, 0x66]);
      const mask = 'xxx';

      // Act
      const result = findPattern(memory, pattern, mask);

      // Assert
      expect(result).toBe(-1);
    });
  });

  describe('If empty pattern is provided', () => {
    it('Then should return -1', () => {
      // Arrange
      const memory = Buffer.from([0x44, 0x88, 0x25]);
      const pattern = Buffer.from([]);
      const mask = '';

      // Act
      const result = findPattern(memory, pattern, mask);

      // Assert
      expect(result).toBe(-1);
    });
  });

  describe('If pattern and mask lengths do not match', () => {
    it('Then should throw error', () => {
      // Arrange
      const memory = Buffer.from([0x44, 0x88, 0x25]);
      const pattern = Buffer.from([0x44, 0x88, 0x25]);
      const mask = 'xx'; // Too short

      // Act
      const act = () => findPattern(memory, pattern, mask);

      // Assert
      expect(act).toThrow('Pattern length');
    });
  });

  describe('If pattern is longer than buffer', () => {
    it('Then should return -1', () => {
      // Arrange
      const memory = Buffer.from([0x44, 0x88]);
      const pattern = Buffer.from([0x44, 0x88, 0x25, 0xff]);
      const mask = 'xxxx';

      // Act
      const result = findPattern(memory, pattern, mask);

      // Assert
      expect(result).toBe(-1);
    });
  });

  describe('If GameData pattern from d2go is searched', () => {
    it('Then should find pattern with wildcards', () => {
      // Arrange
      // Simulate finding GameData pattern in memory
      const memory = Buffer.concat([
        Buffer.alloc(100, 0xff), // Padding before pattern
        Buffer.from([
          0x44,
          0x88,
          0x25, // Pattern start
          0x12,
          0x34,
          0x56,
          0x78, // Wildcard bytes (offset value)
          0x66,
          0x44,
          0x89,
          0x25, // Pattern continues
          0x9a,
          0xbc,
          0xde,
          0xf0, // More wildcards
        ]),
        Buffer.alloc(100, 0xff), // Padding after pattern
      ]);
      const pattern = Buffer.from([
        0x44, 0x88, 0x25, 0x00, 0x00, 0x00, 0x00, 0x66, 0x44, 0x89, 0x25, 0x00, 0x00, 0x00, 0x00,
      ]);
      const mask = 'xxx????xxxx????';

      // Act
      const result = findPattern(memory, pattern, mask);

      // Assert
      expect(result).toBe(100); // Found at offset 100 (after padding)
    });
  });
});

describe('When findPatternString is called', () => {
  describe('If valid hex string pattern is provided', () => {
    it('Then should parse and find pattern', () => {
      // Arrange
      const memory = Buffer.from([0xff, 0x44, 0x88, 0x25, 0xff]);
      const patternStr = '\\x44\\x88\\x25';
      const mask = 'xxx';

      // Act
      const result = findPatternString(memory, patternStr, mask);

      // Assert
      expect(result).toBe(1);
    });
  });

  describe('If pattern with wildcards is provided', () => {
    it('Then should parse and find pattern with wildcards', () => {
      // Arrange
      const memory = Buffer.from([0xff, 0x44, 0x88, 0x25, 0xaa, 0xbb, 0xcc, 0xdd]);
      const patternStr = '\\x44\\x88\\x25\\x00\\x00\\x00\\x00';
      const mask = 'xxx????';

      // Act
      const result = findPatternString(memory, patternStr, mask);

      // Assert
      expect(result).toBe(1);
    });
  });

  describe('If invalid pattern string is provided', () => {
    it('Then should throw error', () => {
      // Arrange
      const memory = Buffer.from([0x44, 0x88, 0x25]);
      const invalidPattern = 'not valid';
      const mask = 'xxx';

      // Act
      const act = () => findPatternString(memory, invalidPattern, mask);

      // Assert
      expect(act).toThrow('Invalid pattern format');
    });
  });
});

describe('When readBytesFromBuffer is called', () => {
  describe('If valid offset and length are provided', () => {
    it('Then should read bytes correctly', () => {
      // Arrange
      const buffer = Buffer.from([0x00, 0x11, 0x22, 0x33, 0x44, 0x55]);
      const offset = 2;
      const length = 3;

      // Act
      const result = readBytesFromBuffer(buffer, offset, length);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.length).toBe(3);
      expect(result?.[0]).toBe(0x22);
      expect(result?.[1]).toBe(0x33);
      expect(result?.[2]).toBe(0x44);
    });
  });

  describe('If offset is at buffer start', () => {
    it('Then should read from start', () => {
      // Arrange
      const buffer = Buffer.from([0xaa, 0xbb, 0xcc]);
      const offset = 0;
      const length = 2;

      // Act
      const result = readBytesFromBuffer(buffer, offset, length);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.length).toBe(2);
      expect(result?.[0]).toBe(0xaa);
      expect(result?.[1]).toBe(0xbb);
    });
  });

  describe('If offset is negative', () => {
    it('Then should return null', () => {
      // Arrange
      const buffer = Buffer.from([0xaa, 0xbb, 0xcc]);
      const offset = -1;
      const length = 2;

      // Act
      const result = readBytesFromBuffer(buffer, offset, length);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('If offset plus length exceeds buffer', () => {
    it('Then should return null', () => {
      // Arrange
      const buffer = Buffer.from([0xaa, 0xbb, 0xcc]);
      const offset = 2;
      const length = 5;

      // Act
      const result = readBytesFromBuffer(buffer, offset, length);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('If reading uint32 from pattern offset', () => {
    it('Then should read 4 bytes correctly', () => {
      // Arrange
      // Simulate GameData pattern with offset value
      const buffer = Buffer.from([
        0x44,
        0x88,
        0x25, // Pattern bytes
        0x12,
        0x34,
        0x56,
        0x78, // Offset value (little-endian)
      ]);
      const offset = 3; // Read from offset after pattern
      const length = 4; // Read 4 bytes (uint32)

      // Act
      const result = readBytesFromBuffer(buffer, offset, length);

      // Assert
      expect(result).not.toBeNull();
      expect(result?.length).toBe(4);
      // Verify little-endian uint32 value
      const uint32Value = result?.readUInt32LE(0);
      expect(uint32Value).toBe(0x78563412);
    });
  });
});
