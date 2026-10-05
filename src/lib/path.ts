/**
 * Returns the last segment of a file path, supporting both POSIX (`/`) and
 * Windows (`\`) separators.
 * @param {string} filePath - The full file path
 * @returns {string} The file name, or the original input if it has no separators
 */
export function getFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}
