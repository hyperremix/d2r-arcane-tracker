import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '../types/settings';
import { buildCopyFileName, parseSaveFileSnapshotId } from './saveFileBackup';
import {
  SaveFileSnapshotService,
  type SaveFileSnapshotServiceDependencies,
} from './saveFileSnapshots';

/** A character save that is large enough for its header to be read, with the given level. */
function characterSave(level: number, marker = 0): Buffer {
  const buffer = Buffer.alloc(800);
  buffer.writeUInt8(level, 43);
  buffer.writeUInt8(marker, 799);
  return buffer;
}

describe('When using the save file snapshot service', () => {
  let root: string;
  let saveDirectory: string;
  let snapshotDirectory: string;
  let backupDirectory: string;
  let settings: Pick<Settings, 'saveSnapshotsEnabled' | 'saveSnapshotsPerFile'>;
  let deps: SaveFileSnapshotServiceDependencies;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'save-snapshots-'));
    saveDirectory = join(root, 'saves');
    snapshotDirectory = join(root, 'snapshots');
    backupDirectory = join(root, 'backups');
    await mkdir(saveDirectory);
    settings = {};
    deps = {
      snapshotDirectory,
      backupDirectory,
      getSettings: () => settings,
      getSaveDirectory: () => saveDirectory,
      assertGameNotRunning: vi.fn().mockResolvedValue(undefined),
      writeSaveFile: vi.fn(async (filePath: string, content: Buffer) => {
        await writeFile(filePath, content);
      }),
      rescan: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe('When a save file is read', () => {
    it('Then a byte-identical snapshot is stored', async () => {
      // Arrange
      const service = new SaveFileSnapshotService(deps);
      const filePath = join(saveDirectory, 'Hero.d2s');

      // Act
      const stored = await service.capture(filePath, Buffer.from([1, 2, 3]));

      // Assert
      const names = await readdir(snapshotDirectory);
      expect(stored).toBe(true);
      expect(names).toHaveLength(1);
      expect([...(await readFile(join(snapshotDirectory, names[0])))]).toEqual([1, 2, 3]);
    });

    it('If the content equals the newest snapshot, Then no snapshot is added', async () => {
      // Arrange
      const filePath = join(saveDirectory, 'Hero.d2s');
      await new SaveFileSnapshotService(deps).capture(filePath, Buffer.from('same'));
      // A new service (app restart) has to compare with the snapshot on disk
      const service = new SaveFileSnapshotService(deps);

      // Act
      const stored = await service.capture(filePath, Buffer.from('same'));

      // Assert
      expect(stored).toBe(false);
      expect(await readdir(snapshotDirectory)).toHaveLength(1);
    });

    it('If the content changed back to an older state, Then a snapshot is added', async () => {
      // Arrange
      const service = new SaveFileSnapshotService(deps);
      const filePath = join(saveDirectory, 'Hero.d2s');
      await service.capture(filePath, Buffer.from('a'));
      await service.capture(filePath, Buffer.from('b'));

      // Act
      const stored = await service.capture(filePath, Buffer.from('a'));

      // Assert
      expect(stored).toBe(true);
      expect(await readdir(snapshotDirectory)).toHaveLength(3);
    });

    it('If snapshots are turned off, Then nothing is stored', async () => {
      // Arrange
      settings.saveSnapshotsEnabled = false;
      const service = new SaveFileSnapshotService(deps);

      // Act
      const stored = await service.capture(join(saveDirectory, 'Hero.d2s'), Buffer.from('x'));

      // Assert
      expect(stored).toBe(false);
      await expect(readdir(snapshotDirectory)).rejects.toThrow();
    });

    it('Then only the configured number of snapshots per file is kept', async () => {
      // Arrange
      settings.saveSnapshotsPerFile = 3;
      const service = new SaveFileSnapshotService(deps);
      const filePath = join(saveDirectory, 'Hero.d2s');
      const otherFilePath = join(saveDirectory, 'Other.d2s');
      await service.capture(otherFilePath, Buffer.from('other'));

      // Act
      for (let index = 0; index < 5; index += 1) {
        await service.capture(filePath, Buffer.from(`content ${index}`));
      }

      // Assert
      const names = await readdir(snapshotDirectory);
      expect(names.filter((name) => name.includes('-Hero.d2s.'))).toHaveLength(3);
      expect(names.filter((name) => name.includes('-Other.d2s.'))).toHaveLength(1);
      const kept = await Promise.all(
        names
          .filter((name) => name.includes('-Hero.d2s.'))
          .map(async (name) => (await readFile(join(snapshotDirectory, name))).toString()),
      );
      expect(kept.sort()).toEqual(['content 2', 'content 3', 'content 4']);
    });
  });

  describe('When the snapshots are listed', () => {
    it('Then snapshots and pre-change copies are grouped per save file, newest first', async () => {
      // Arrange
      const service = new SaveFileSnapshotService(deps);
      const heroPath = join(saveDirectory, 'Hero.d2s');
      await writeFile(heroPath, characterSave(80));
      await service.capture(heroPath, characterSave(42));
      await service.capture(join(saveDirectory, 'SharedStashSoftCoreV2.d2i'), Buffer.from('st'));
      await mkdir(backupDirectory);
      await new Promise((resolve) => setTimeout(resolve, 5));
      await writeFile(
        join(backupDirectory, buildCopyFileName(heroPath, '.bak')),
        characterSave(43),
      );

      // Act
      const groups = await service.list();

      // Assert
      expect(groups.map((group) => group.fileName)).toEqual([
        'Hero.d2s',
        'SharedStashSoftCoreV2.d2i',
      ]);
      const [hero, stash] = groups;
      expect(hero.fileExists).toBe(true);
      expect(hero.snapshots.map((snapshot) => [snapshot.kind, snapshot.characterLevel])).toEqual([
        ['backup', 43],
        ['snapshot', 42],
      ]);
      expect(hero.snapshots[0].sizeBytes).toBe(800);
      expect(stash.fileExists).toBe(false);
      expect(stash.snapshots[0].characterLevel).toBeUndefined();
    });

    it('If a snapshot belongs to a file of another save folder, Then it is left out', async () => {
      // Arrange
      const service = new SaveFileSnapshotService(deps);
      await service.capture(join(root, 'other-folder', 'Hero.d2s'), Buffer.from('x'));

      // Act
      const groups = await service.list();

      // Assert
      expect(groups).toEqual([]);
    });

    it('If no copies were taken yet, Then the list is empty', async () => {
      // Arrange
      const service = new SaveFileSnapshotService(deps);

      // Act
      const groups = await service.list();

      // Assert
      expect(groups).toEqual([]);
    });
  });

  describe('When a save file is restored from a snapshot', () => {
    async function captureAndList(service: SaveFileSnapshotService, content: Buffer) {
      await service.capture(join(saveDirectory, 'Hero.d2s'), content);
      const [group] = await service.list();
      return group.snapshots[0].id;
    }

    it('Then the snapshot content is written to the save file and the saves are rescanned', async () => {
      // Arrange
      const service = new SaveFileSnapshotService(deps);
      const snapshotId = await captureAndList(service, Buffer.from('old'));
      await writeFile(join(saveDirectory, 'Hero.d2s'), 'new');

      // Act
      await service.restore(snapshotId);

      // Assert
      expect(deps.writeSaveFile).toHaveBeenCalledWith(
        join(saveDirectory, 'Hero.d2s'),
        Buffer.from('old'),
      );
      expect((await readFile(join(saveDirectory, 'Hero.d2s'))).toString()).toBe('old');
      expect(deps.rescan).toHaveBeenCalledTimes(1);
    });

    it('If the game is running, Then nothing is written', async () => {
      // Arrange
      const service = new SaveFileSnapshotService(deps);
      const snapshotId = await captureAndList(service, Buffer.from('old'));
      vi.mocked(deps.assertGameNotRunning).mockRejectedValue(new Error('GAME_RUNNING'));

      // Act
      const restore = service.restore(snapshotId);

      // Assert
      await expect(restore).rejects.toThrow('GAME_RUNNING');
      expect(deps.writeSaveFile).not.toHaveBeenCalled();
    });

    it('If the snapshot belongs to another save folder, Then the restore is refused', async () => {
      // Arrange
      const service = new SaveFileSnapshotService(deps);
      const otherFile = join(root, 'other-folder', 'Hero.d2s');
      await service.capture(otherFile, Buffer.from('x'));
      const [copyFileName] = await readdir(snapshotDirectory);

      // Act
      const restore = service.restore(`snapshot:${copyFileName}`);

      // Assert
      await expect(restore).rejects.toThrow('configured save folder');
      expect(deps.writeSaveFile).not.toHaveBeenCalled();
    });

    it('If the rescan fails, Then the restore still succeeds', async () => {
      // Arrange
      const service = new SaveFileSnapshotService(deps);
      const snapshotId = await captureAndList(service, Buffer.from('old'));
      vi.mocked(deps.rescan).mockRejectedValue(new Error('Save file monitoring is not active'));
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      // Act
      const restore = service.restore(snapshotId);

      // Assert
      await expect(restore).resolves.toBeUndefined();
      expect(deps.writeSaveFile).toHaveBeenCalledTimes(1);
    });

    it('If the save file was deleted, Then it is written again', async () => {
      // Arrange
      const service = new SaveFileSnapshotService(deps);
      const snapshotId = await captureAndList(service, Buffer.from('old'));

      // Act
      await service.restore(snapshotId);

      // Assert
      expect((await readFile(join(saveDirectory, 'Hero.d2s'))).toString()).toBe('old');
    });
  });
});

describe('When parsing a save file snapshot ID', () => {
  const copyFileName = buildCopyFileName('/saves/Hero.d2s', '.snap');

  it('When the ID names a snapshot, Then its parts are returned', () => {
    // Arrange
    const id = `snapshot:${copyFileName}`;

    // Act
    const parsed = parseSaveFileSnapshotId(id);

    // Assert
    expect(parsed).toMatchObject({ kind: 'snapshot', saveFileName: 'Hero.d2s', copyFileName });
  });

  it.each([
    ['a path', `snapshot:../${copyFileName}`],
    ['a Windows path', `snapshot:..\\${copyFileName}`],
    ['the wrong kind for the extension', `backup:${copyFileName}`],
    ['an unknown kind', `other:${copyFileName}`],
    ['no kind', copyFileName],
    ['a non-save file', `snapshot:${buildCopyFileName('/saves/notes.txt', '.snap')}`],
    ['a non-string', 42],
  ])('If the ID is %s, Then it is rejected', (_, id) => {
    // Arrange (the table above)

    // Act
    const parsed = parseSaveFileSnapshotId(id);

    // Assert
    expect(parsed).toBeUndefined();
  });
});
