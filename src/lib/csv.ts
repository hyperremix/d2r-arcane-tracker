/**
 * Escapes a single CSV cell, quoting it when it contains a comma, double quote, newline or
 * carriage return and doubling any embedded double quotes.
 * @param {string | number} value - The cell value
 * @returns {string} The escaped cell value
 */
export function escapeCsvCell(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
