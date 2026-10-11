/**
 * Returns the default D2R installation directory for the current platform (the Battle.net
 * default on Windows). Used as the input placeholder and the browse dialog's start folder.
 * Kept in sync with WINDOWS_DEFAULT_D2R_INSTALL_PATH / MAC_DEFAULT_D2R_INSTALL_PATH in
 * electron/services/iconService.ts; the renderer cannot import main-process modules, and this
 * value is needed synchronously even when the main process finds no existing installation.
 * @returns {string} Platform-specific default installation path
 */
export function getDefaultD2RPath(): string {
  return window.electronAPI?.platform === 'win32'
    ? 'C:\\Program Files (x86)\\Diablo II Resurrected'
    : '/Applications/Diablo II Resurrected.app';
}
