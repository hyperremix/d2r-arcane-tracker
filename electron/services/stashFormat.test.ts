import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { D2I_SECTOR_HEADER_SIZE, readD2iHeaderVersion, readD2iMetadata } from './stashFormat';

const FIXTURE_PATH = resolve(
  process.cwd(),
  'electron/services/fixtures/ModernSharedStashSoftCoreV2.d2i',
);

describe('When readD2iMetadata parses modern stash files', () => {
  it('Then it returns version, hardcore, and sector descriptors', () => {
    // Arrange
    const buffer = readFileSync(FIXTURE_PATH);

    // Act
    const metadata = readD2iMetadata(buffer);

    // Assert
    expect(metadata.version).toBe(105);
    expect(metadata.hardcore).toBe(false);
    expect(metadata.sectors).toHaveLength(7);
    expect(metadata.sectors[0]?.payloadSignature).toBe('JM');
    expect(metadata.sectors[6]?.payloadSignature).not.toBe('JM');
  });

  it('Then a non-ASCII payload signature is reported as hex instead of a masked ASCII lookalike', () => {
    // Arrange
    const buffer = readFileSync(FIXTURE_PATH);

    // Act
    const metadata = readD2iMetadata(buffer);

    // Assert
    expect(metadata.sectors[6]?.payloadSignature).toBe('c0ed');
  });
});

describe('When readD2iMetadata reads a file whose sectors cover every byte', () => {
  it('Then no trailing bytes are reported, including for the non-JM final sector of a real file', () => {
    // Arrange
    const buffer = readFileSync(FIXTURE_PATH);

    // Act
    const metadata = readD2iMetadata(buffer);

    // Assert
    expect(metadata.trailingBytes).toBe(0);
  });
});

describe('When readD2iMetadata reads a file with bytes after the last sector', () => {
  it('Then a truncated tail shorter than a sector header is reported as trailing bytes', () => {
    // Arrange
    const buffer = Buffer.concat([readFileSync(FIXTURE_PATH), Buffer.alloc(10)]);

    // Act
    const metadata = readD2iMetadata(buffer);

    // Assert
    expect(metadata.sectors).toHaveLength(7);
    expect(metadata.trailingBytes).toBe(10);
  });

  it('Then a sector with a bad signature is reported as trailing bytes instead of being dropped silently', () => {
    // Arrange
    const garbageSector = Buffer.alloc(80, 0x11);
    const buffer = Buffer.concat([readFileSync(FIXTURE_PATH), garbageSector]);

    // Act
    const metadata = readD2iMetadata(buffer);

    // Assert
    expect(metadata.sectors).toHaveLength(7);
    expect(metadata.trailingBytes).toBe(80);
  });
});

describe('When readD2iHeaderVersion reads a damaged stash file', () => {
  it('Then it still returns the version of a file that is cut off inside a sector', () => {
    // Arrange
    const truncated = readFileSync(FIXTURE_PATH).subarray(0, 3000);

    // Act
    const version = readD2iHeaderVersion(truncated);

    // Assert
    expect(() => readD2iMetadata(truncated)).toThrow('exceeds file length');
    expect(version).toBe(105);
  });

  it('Then it returns undefined when the sector signature is missing', () => {
    // Arrange
    const buffer = Buffer.alloc(D2I_SECTOR_HEADER_SIZE);
    buffer.writeUInt32LE(105, 8);

    // Act
    const version = readD2iHeaderVersion(buffer);

    // Assert
    expect(version).toBeUndefined();
  });

  it('Then it returns undefined when the buffer is shorter than the version field', () => {
    // Arrange
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32LE(0xaa55aa55, 0);

    // Act
    const version = readD2iHeaderVersion(buffer);

    // Assert
    expect(version).toBeUndefined();
  });
});
