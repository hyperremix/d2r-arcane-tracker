/**
 * Escapes a single CSV cell, quoting it when it contains a comma, double quote, newline or
 * carriage return and doubling any embedded double quotes.
 * @param value - The cell value
 * @returns The escaped cell value
 */
export function escapeCsvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function isCellEnd(char: string | undefined): boolean {
  return char === undefined || char === ',' || char === '\n' || char === '\r';
}

/**
 * Reads one cell starting at `start`.
 * @returns The cell value and the index of the character that ends it (a separator or the end)
 */
function readCell(source: string, start: number): { value: string; end: number } {
  let value = '';
  let index = start;
  if (source[index] === '"') {
    index += 1;
    while (index < source.length) {
      if (source[index] === '"' && source[index + 1] === '"') {
        value += '"';
        index += 2;
      } else if (source[index] === '"') {
        index += 1;
        break;
      } else {
        value += source[index];
        index += 1;
      }
    }
  }
  while (!isCellEnd(source[index])) {
    value += source[index];
    index += 1;
  }
  return { value, end: index };
}

/**
 * Splits CSV text into rows of cells. Quoted cells may contain commas, line breaks and doubled
 * quotes. A leading byte order mark is ignored, and rows without any content are left out.
 * @param text - The CSV text
 * @returns The rows, each a list of cells
 */
export function parseCsv(text: string): string[][] {
  const source = text.startsWith('﻿') ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let index = 0;

  while (index <= source.length) {
    const { value, end } = readCell(source, index);
    row.push(value);
    if (source[end] === ',') {
      index = end + 1;
      continue;
    }

    if (row.some((cell) => cell.trim() !== '')) {
      rows.push(row);
    }
    row = [];
    index = end + (source[end] === '\r' && source[end + 1] === '\n' ? 2 : 1);
  }

  return rows;
}
