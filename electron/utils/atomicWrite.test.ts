import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFileAtomic } from './atomicWrite';

describe('writeFileAtomic', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'atomic-write-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  describe('When the target file already exists', () => {
    it('Then it replaces the content and leaves no temp file behind', async () => {
      // Arrange
      const target = join(directory, 'Hero.d2s');
      await writeFile(target, Buffer.from('old'));

      // Act
      await writeFileAtomic(target, Buffer.from('new content'));

      // Assert
      expect((await readFile(target)).toString()).toBe('new content');
      expect(await readdir(directory)).toEqual(['Hero.d2s']);
    });
  });

  describe('If the rename step fails', () => {
    it('Then the original file is untouched and the temp file is cleaned up', async () => {
      // Arrange: a directory at the target path makes the rename fail
      const target = join(directory, 'Hero.d2s');
      await mkdir(target);
      await writeFile(join(target, 'keep'), 'keep');

      // Act
      const act = writeFileAtomic(target, Buffer.from('new'));

      // Assert
      await expect(act).rejects.toThrow();
      expect((await readFile(join(target, 'keep'))).toString()).toBe('keep');
      expect(await readdir(directory)).toEqual(['Hero.d2s']);
    });
  });
});
