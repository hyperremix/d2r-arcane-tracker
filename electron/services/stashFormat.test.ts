import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readD2iMetadata } from './stashFormat';

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
