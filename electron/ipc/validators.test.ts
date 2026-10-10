import { describe, expect, it } from 'vitest';
import { MAX_SESSION_NOTES_LENGTH } from '../utils/sessionNotes';
import type { InvokeChannel } from './contract';
import { IpcValidationError } from './validation';
import { invokeArgValidators, isRendererWritableSetting } from './validators';

function validate(channel: InvokeChannel, ...rawArgs: unknown[]): unknown[] {
  return invokeArgValidators[channel](rawArgs);
}

function captureError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('When renderer arguments are validated against the IPC contract', () => {
  it.each<[InvokeChannel, unknown[], string]>([
    ['grail:getProgressByItem', [''], 'Invalid item ID'],
    ['grail:getProgressByItem', [42], 'Invalid item ID'],
    ['grail:getProgress', [{}], 'Invalid character ID'],
    ['grail:deleteProgress', ['   '], 'Invalid progress ID'],
    ['grail:updateSettings', [null], 'Invalid settings: expected an object'],
    ['grail:updateSettings', [[]], 'Invalid settings: expected an object'],
    ['grail:backup', [''], 'Invalid backup path'],
    ['saveFile:inspectDirectory', [undefined], 'Invalid save directory: expected a string'],
    ['run-tracker:archive-session', [''], 'Invalid session ID'],
    ['run-tracker:update-session-notes', ['', 'Cows'], 'Invalid session ID'],
    ['run-tracker:update-session-notes', ['session-1', 42], 'Invalid session notes'],
    [
      'run-tracker:update-session-notes',
      ['session-1', 'x'.repeat(MAX_SESSION_NOTES_LENGTH + 1)],
      'Invalid session notes: longer than',
    ],
    ['run-tracker:get-session-by-id', [{ id: 'x' }], 'Invalid session ID'],
    ['run-tracker:get-runs-by-session', [undefined], 'Invalid session ID'],
    ['run-tracker:get-session-items', [7], 'Invalid session ID'],
    ['run-tracker:get-run-items', [''], 'Invalid run ID'],
    ['run-tracker:start-run', [''], 'Invalid character ID'],
    ['run-tracker:get-all-sessions', ['yes'], 'Invalid includeArchived flag'],
    ['run-tracker:add-run-item', [{ name: 'Shako' }], 'Invalid run ID'],
    [
      'run-tracker:add-run-item',
      [{ runId: 'run-1' }],
      'Either name or grailProgressId must be provided',
    ],
    [
      'run-tracker:add-run-item',
      [{ runId: 'run-1', name: 'Shako', foundTime: 'yesterday' }],
      'Invalid found time',
    ],
    ['terrorZone:updateConfig', [{ 'zone-1': 'on' }], 'Invalid terror zone config'],
    ['widget:toggle', ['true', {}], 'Invalid widget enabled state'],
    ['widget:update-opacity', [Number.NaN], 'Invalid widget opacity'],
    ['update-titlebar-overlay', [{ backgroundColor: '#000' }], 'Invalid title bar overlay colors'],
    [
      'dialog:showOpenDialog',
      [{ properties: ['openFile', 'dontAddToRecent'] }],
      'Invalid dialog properties',
    ],
    ['dialog:showSaveDialog', [{ filters: [{ name: 'DB' }] }], 'Invalid dialog filters'],
    ['dialog:showSaveDialog', ['options'], 'Invalid dialog options: expected an object'],
    ['icon:getByFilename', ['../../secrets.png'], 'Invalid icon filename'],
    ['icon:getByFilename', ['icons\\..\\..\\secrets.png'], 'Invalid icon filename'],
    [
      'shell:openExternal',
      ['file:///C:/Windows/System32/calc.exe'],
      'Only http(s) URLs can be opened',
    ],
    ['shell:openExternal', ['javascript:alert(1)'], 'Only http(s) URLs can be opened'],
    ['shell:openExternal', ['not a url'], 'Invalid URL'],
    ['grail:updateProgress', [{ id: 'p-1' }], 'Invalid grail progress payload'],
    [
      'grail:updateSettings',
      [{ runTrackerGlobalHotkeys: 'yes' }],
      'Invalid runTrackerGlobalHotkeys setting',
    ],
    ['grail:updateSettings', [{ runTrackerShortcuts: {} }], 'Invalid runTrackerShortcuts setting'],
    ['saveFile:updateSaveDirectory', ['saves'], 'expected a non-empty absolute path'],
    ['dialog:writeFile', ['export.csv', 'data'], 'Invalid file path'],
    ['dialog:writeFile', ['/tmp/export.csv', 42], 'Invalid file content'],
    ['vault:removeItem', [''], 'itemId is required'],
    ['vault:unvaultItem', ['row-1', undefined, 1.5], 'withdrawCount must be a positive integer'],
    ['inventory:searchAll', [{ vaultedState: 'gone' }], 'vaultedState must be one of'],
    ['inventory:moveItem', [null], 'Move input is required'],
    ['inventory:splitStack', [{}], 'sourceFilePath is required'],
    ['inventory:openSnapshotWindow', [{ sourceFilePath: ' ' }], 'sourceFilePath is required'],
  ])('If %s receives %j, Then it is rejected with "%s"', (channel, rawArgs, message) => {
    // Arrange
    const run = () => validate(channel, ...rawArgs);

    // Act
    const error = captureError(run);

    // Assert
    expect(error).toBeInstanceOf(IpcValidationError);
    expect((error as IpcValidationError).message).toContain(message);
  });

  it('If the session notes have exactly the maximum length, Then they are accepted', () => {
    // Arrange
    const notes = 'x'.repeat(MAX_SESSION_NOTES_LENGTH);

    // Act
    const result = validate('run-tracker:update-session-notes', 'session-1', notes);

    // Assert
    expect(result).toEqual(['session-1', notes]);
  });

  it('Then valid arguments are returned in contract order and extra arguments are dropped', () => {
    // Arrange
    const runItem = { runId: 'run-1', name: 'Shako', foundTime: new Date('2024-01-01') };

    // Act
    const results = [
      validate('run-tracker:add-run-item', runItem, 'extra'),
      validate('grail:getProgress'),
      validate('shell:openExternal', 'https://github.com/hyperremix/d2r-arcane-tracker/issues'),
      validate('icon:getByFilename', 'misc/rune/r19.png'),
      validate('dialog:showOpenDialog', { title: 'Pick', properties: ['openDirectory'] }),
    ];

    // Assert
    expect(results).toEqual([
      [{ runId: 'run-1', name: 'Shako', grailProgressId: undefined, foundTime: runItem.foundTime }],
      [undefined],
      ['https://github.com/hyperremix/d2r-arcane-tracker/issues'],
      ['misc/rune/r19.png'],
      [
        {
          title: 'Pick',
          defaultPath: undefined,
          filters: undefined,
          properties: ['openDirectory'],
        },
      ],
    ]);
  });
});

describe('When the renderer sends a grail progress record, save directory or export path', () => {
  it('If the progress record has unknown fields, Then only the record fields are passed on', () => {
    // Arrange
    const foundDate = new Date('2024-05-01');
    const record = {
      id: 'p-1',
      characterId: 'c-1',
      itemId: 'shako',
      foundDate,
      foundBy: 'me',
      manuallyAdded: true,
      difficulty: 'hell',
      notes: 'drop',
      isEthereal: false,
      fromInitialScan: false,
      injected: 'value',
    };

    // Act
    const [validated] = validate('grail:updateProgress', record);

    // Assert
    expect(validated).toEqual({
      id: 'p-1',
      characterId: 'c-1',
      itemId: 'shako',
      foundDate,
      foundBy: 'me',
      manuallyAdded: true,
      difficulty: 'hell',
      notes: 'drop',
      isEthereal: false,
      fromInitialScan: false,
    });
    expect(validated).not.toHaveProperty('injected');
  });

  it('If the progress record has only the required fields, Then the optional fields stay undefined', () => {
    // Arrange
    const record = {
      id: 'p-1',
      characterId: 'c-1',
      itemId: 'shako',
      manuallyAdded: false,
      isEthereal: true,
    };

    // Act
    const [validated] = validate('grail:updateProgress', record);

    // Assert
    expect(validated).toEqual({ ...record });
    expect(validated).toMatchObject({
      foundDate: undefined,
      foundBy: undefined,
      difficulty: undefined,
      notes: undefined,
      fromInitialScan: undefined,
    });
  });

  it('If the save directory has surrounding whitespace, Then the trimmed absolute path is passed on', () => {
    // Arrange
    const directory = '  /Users/hero/Saved Games/Diablo II Resurrected  ';

    // Act
    const [validated] = validate('saveFile:updateSaveDirectory', directory);

    // Assert
    expect(validated).toBe('/Users/hero/Saved Games/Diablo II Resurrected');
  });

  it('If the export path is absolute, Then the path and the content are passed on unchanged', () => {
    // Arrange
    const filePath = '/tmp/export.csv';
    const content = 'a,b\n1,2';

    // Act
    const validated = validate('dialog:writeFile', filePath, content);

    // Assert
    expect(validated).toEqual([filePath, content]);
  });
});

describe('When the renderer updates settings', () => {
  it.each([
    'saveDir',
    'd2rInstallPath',
    'terrorZoneConfig',
    'terrorZoneBackupCreated',
    'iconConversionStatus',
    'iconConversionProgress',
    'mainWindowBounds',
    'needsSeeding',
  ])('If the update contains %s, Then it is rejected because it has a dedicated flow', (key) => {
    // Arrange
    const run = () => validate('grail:updateSettings', { [key]: 'value' });

    // Act
    const error = captureError(run);
    const writable = isRendererWritableSetting(key);

    // Assert
    expect((error as Error).message).toContain(
      `Setting cannot be changed through grail:updateSettings: ${key}`,
    );
    expect(writable).toBe(false);
  });

  it('If the update contains a key that is not a setting, Then it is rejected', () => {
    // Arrange
    const run = () => validate('grail:updateSettings', { theme: 'dark', toString: 'x' });

    // Act
    const error = captureError(run);

    // Assert
    expect((error as Error).message).toContain(
      'Setting cannot be changed through grail:updateSettings: toString',
    );
  });

  it('Then settings the settings pages write are accepted unchanged', () => {
    // Arrange
    const update = {
      theme: 'dark',
      gameMode: 'manual',
      widgetPosition: { x: 1, y: 2 },
      widgetSizeRunOnly: { width: 300, height: 200 },
      wizardCompleted: true,
      runTrackerGlobalHotkeys: true,
    };

    // Act
    const [validated] = validate('grail:updateSettings', update);

    // Assert
    expect(validated).toBe(update);
  });
});
