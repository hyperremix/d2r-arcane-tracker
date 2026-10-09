import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IPC_INVOKE_CHANNELS } from './validators';

const electronDir = resolve(__dirname, '..');

/**
 * Collects the invoke channels registered with `handle('…', …)` in the main-process sources.
 * Handler registration goes through the typed registry, so a literal channel name is required.
 */
function collectRegisteredChannels(): Set<string> {
  const handlerDir = join(electronDir, 'ipc-handlers');
  const sources = [
    ...readdirSync(handlerDir)
      .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
      .map((file) => join(handlerDir, file)),
    join(electronDir, 'main.ts'),
  ];

  const channels = new Set<string>();
  for (const source of sources) {
    const text = readFileSync(source, 'utf-8');
    for (const match of text.matchAll(/\bhandle\(\s*'([^']+)'/g)) {
      channels.add(match[1]);
    }
  }
  return channels;
}

describe('When the main-process handlers are compared with the IPC contract', () => {
  it('Then every contract channel has a handler and every handler is in the contract', () => {
    // Arrange
    const contractChannels = [...IPC_INVOKE_CHANNELS].sort();

    // Act
    const registeredChannels = [...collectRegisteredChannels()].sort();

    // Assert
    expect(registeredChannels).toEqual(contractChannels);
  });
});
