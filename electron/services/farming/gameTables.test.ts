import { describe, expect, it } from 'vitest';
import { parseGameStrings, parseGameTable } from './gameTables';

describe('When a game data table is parsed', () => {
  it('Then each line becomes a row keyed by the headers, with missing cells empty', () => {
    // Arrange
    const text = '﻿Name\tLevel\tCode\r\nCap\t1\tcap\r\n\r\nSkull Cap\t5\n';

    // Act
    const rows = parseGameTable(text);

    // Assert
    expect(rows).toEqual([
      { Name: 'Cap', Level: '1', Code: 'cap' },
      { Name: 'Skull Cap', Level: '5', Code: '' },
    ]);
  });
});

describe('When a game string file is parsed', () => {
  it('Then the English text of every entry is kept by its key', () => {
    // Arrange
    const text = JSON.stringify([
      { id: 1, Key: 'Hell1', enUS: 'Abaddon', deDE: 'Abaddon' },
      { id: 2, Key: 'Broken' },
    ]);

    // Act
    const strings = parseGameStrings(text);

    // Assert
    expect([...strings]).toEqual([['Hell1', 'Abaddon']]);
  });

  it('If the file is not a list, Then it has no strings', () => {
    // Arrange
    const text = '{"Hell1": "Abaddon"}';

    // Act
    const strings = parseGameStrings(text);

    // Assert
    expect(strings.size).toBe(0);
  });
});
