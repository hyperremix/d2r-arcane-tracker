import { describe, expect, it } from 'vitest';
import {
  findKnownBuild,
  KNOWN_D2R_BUILDS,
  PE_HEADER_READ_SIZE,
  parsePeIdentity,
} from './d2rBuilds';

const PE_OFFSET = 0x150;

/** Builds a minimal PE header with the given identity (as found at the start of D2R.exe). */
function createPeHeader(timeDateStamp: number, sizeOfImage: number): Buffer {
  const header = Buffer.alloc(PE_HEADER_READ_SIZE);
  header.writeUInt32LE(PE_OFFSET, 0x3c); // e_lfanew
  header.writeUInt32LE(0x00004550, PE_OFFSET); // "PE\0\0"
  header.writeUInt32LE(timeDateStamp, PE_OFFSET + 8);
  header.writeUInt32LE(sizeOfImage, PE_OFFSET + 24 + 56);
  return header;
}

describe('When parsePeIdentity is called', () => {
  describe('If the buffer is a valid PE header', () => {
    it('Then should return the timestamp and image size', () => {
      // Arrange
      const header = createPeHeader(1785435812, 41455616);

      // Act
      const result = parsePeIdentity(header);

      // Assert
      expect(result).toEqual({ timeDateStamp: 1785435812, sizeOfImage: 41455616 });
    });
  });

  describe('If the PE signature is missing', () => {
    it('Then should return undefined', () => {
      // Arrange
      const header = createPeHeader(1, 2);
      header.writeUInt32LE(0, PE_OFFSET);

      // Act
      const result = parsePeIdentity(header);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('If e_lfanew points outside the buffer', () => {
    it('Then should return undefined', () => {
      // Arrange
      const header = createPeHeader(1, 2);
      header.writeUInt32LE(0xffff0000, 0x3c);

      // Act
      const result = parsePeIdentity(header);

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('If the buffer is too short', () => {
    it('Then should return undefined', () => {
      // Arrange
      const header = Buffer.alloc(8);

      // Act
      const result = parsePeIdentity(header);

      // Assert
      expect(result).toBeUndefined();
    });
  });
});

describe('When findKnownBuild is called', () => {
  describe('If the identity matches a known build', () => {
    it('Then should return that build', () => {
      // Arrange
      const [known] = KNOWN_D2R_BUILDS;

      // Act
      const result = findKnownBuild({
        timeDateStamp: known.timeDateStamp,
        sizeOfImage: known.sizeOfImage,
      });

      // Assert
      expect(result).toBe(known);
    });
  });

  describe('If only the timestamp matches', () => {
    it('Then should not match', () => {
      // Arrange
      const [known] = KNOWN_D2R_BUILDS;

      // Act
      const result = findKnownBuild({
        timeDateStamp: known.timeDateStamp,
        sizeOfImage: known.sizeOfImage + 4096,
      });

      // Assert
      expect(result).toBeUndefined();
    });
  });
});
