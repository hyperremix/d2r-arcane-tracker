import { describe, expect, it } from 'vitest';
import { escapeCsvCell, parseCsv } from './csv';

describe('When CSV text is parsed', () => {
  it('Then quoted cells keep commas, quotes and line breaks', () => {
    // Arrange
    const text = '﻿item,note\r\n"Tal Rasha\'s, set","say ""hi""\nagain"\r\n';

    // Act
    const rows = parseCsv(text);

    // Assert
    expect(rows).toEqual([
      ['item', 'note'],
      ["Tal Rasha's, set", 'say "hi"\nagain'],
    ]);
  });

  it('If rows are blank, Then they are left out', () => {
    // Arrange
    const text = 'Annihilus\n\n , \nBer\n';

    // Act
    const rows = parseCsv(text);

    // Assert
    expect(rows).toEqual([['Annihilus'], ['Ber']]);
  });

  it('If an escaped cell is parsed again, Then the original value comes back', () => {
    // Arrange
    const value = 'a "quoted", value';

    // Act
    const rows = parseCsv(escapeCsvCell(value));

    // Assert
    expect(rows).toEqual([[value]]);
  });
});
