import { describe, expect, it } from 'vitest';
import { escapeCsvCell } from './csv';

describe('When escaping CSV cells', () => {
  it.each([
    ['plain text', 'Total Runs', 'Total Runs'],
    ['a number', 42, '42'],
    ['a comma', 'Runs, total', '"Runs, total"'],
    ['a double quote', 'The "best" run', '"The ""best"" run"'],
    ['a newline', 'line one\nline two', '"line one\nline two"'],
    ['a carriage return', 'line one\r\nline two', '"line one\r\nline two"'],
    ['a lone carriage return', 'line one\rline two', '"line one\rline two"'],
    ['a comma and a quote together', 'a,"b"', '"a,""b"""'],
  ])('If the cell contains %s, Then it is escaped for CSV', (_scenario, value, expected) => {
    // Arrange
    // (value and expected come from the scenario table)

    // Act
    const result = escapeCsvCell(value);

    // Assert
    expect(result).toBe(expected);
  });
});
