import { readFileSync } from 'node:fs';
import path from 'node:path';
import JSON5 from 'json5';
import { describe, expect, it } from 'vitest';

interface PlatformConfig {
  files?: string[];
}

interface ElectronBuilderConfig {
  files?: unknown;
  win: PlatformConfig;
  linux: PlatformConfig;
}

const config: ElectronBuilderConfig = JSON5.parse(
  readFileSync(path.resolve(__dirname, '../electron-builder.json5'), 'utf8'),
);

describe('electron-builder config', () => {
  it('When platform files lists are used, then there is no top-level files list', () => {
    // Arrange / Act
    const topLevelFiles = config.files;

    // Assert
    expect(topLevelFiles).toBeUndefined();
  });

  it.each([
    ['win', 'win32-x64'],
    ['linux', 'linux-x64'],
  ] as const)('When packaging for %s, then only the app output and its %s prebuild are included', (platform, prebuild) => {
    // Arrange / Act
    const files = config[platform].files ?? [];

    // Assert
    // A list of only `!` exclusions makes electron-builder package the whole project directory
    expect(files.filter((pattern) => !pattern.startsWith('!'))).toEqual(['dist', 'dist-electron']);
    expect(files).toContain(`!**/node_modules/better-sqlite3/prebuilds/!(${prebuild}).node`);
  });
});
