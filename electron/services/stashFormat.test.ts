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
});
