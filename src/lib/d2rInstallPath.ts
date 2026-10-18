/**
 * Returns the default D2R installation directory for the current platform (the Battle.net
 * default on Windows, the Steam release's folder on Linux). Used as the input placeholder and the
 * browse dialog's start folder.
 * The Windows and macOS values are kept in sync with WINDOWS_DEFAULT_D2R_INSTALL_PATH /
 * MAC_DEFAULT_D2R_INSTALL_PATH in electron/services/iconService.ts; the renderer cannot import
 * main-process modules, and this value is needed synchronously even when the main process finds no
 * existing installation. The Linux value is only a hint with a literal `~` (the install folder is
 * found in the Steam libraries and Wine prefixes by the main process); a dialog is expected to
 * ignore a start folder that doesn't exist and open in its own default folder instead.
 * @returns {string} Platform-specific default installation path
 */
export function getDefaultD2RPath(): string {
  const platform = window.electronAPI?.platform;
  if (platform === 'win32') {
    return 'C:\\Program Files (x86)\\Diablo II Resurrected';
  }
  if (platform === 'linux') {
    return '~/.local/share/Steam/steamapps/common/Diablo II Resurrected';
  }
  return '/Applications/Diablo II Resurrected.app';
}
