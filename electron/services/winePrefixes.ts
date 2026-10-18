import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { CHARACTER_SAVE_EXTENSION, D2R_SAVE_FOLDER_NAME } from './saveDirectoryInspector';

/**
 * Finds Diablo II: Resurrected save and install folders inside the Wine prefixes Linux players run
 * the game in: Steam's Proton prefixes (the Steam release and Battle.net added as a non-Steam
 * game), Lutris, Heroic, Bottles and plain Wine. Well-known locations and `$WINEPREFIX` are
 * checked, one folder level of prefixes deep, and unreadable folders are skipped.
 */

/** Steam app ID of the Steam release of Diablo II: Resurrected. */
const D2R_STEAM_APP_ID = '2536520';

/** Only the first this many entries (by name) of a folder that holds prefixes are used. */
const MAX_FOLDER_ENTRIES = 500;

/** Steam installation folders, relative to the home folder (native, Debian package, Flatpak). */
const STEAM_ROOTS = [
  '.local/share/Steam',
  '.steam/steam',
  '.steam/root',
  '.steam/debian-installation',
  '.var/app/com.valvesoftware.Steam/.local/share/Steam',
  '.var/app/com.valvesoftware.Steam/data/Steam',
];

/**
 * Folders whose subfolders are Wine prefixes, relative to the home folder: Lutris installs into
 * `~/Games/<game>` (Battle.net in `~/Games/battlenet`), Heroic into `~/Games/Heroic/Prefixes/<game>`
 * or, in its default prefix folder, `~/Games/Heroic/Prefixes/default/<game>`, and Bottles into
 * `bottles/bottles/<bottle>` (native and Flatpak).
 */
const PREFIX_PARENTS = [
  'Games',
  'Games/Heroic/Prefixes',
  'Games/Heroic/Prefixes/default',
  '.local/share/bottles/bottles',
  '.var/app/com.usebottles.bottles/data/bottles/bottles',
];

/** The D2R install folder relative to a prefix's `drive_c`, as Battle.net installs it. */
const PREFIX_INSTALL_FOLDERS = [
  'Program Files (x86)/Diablo II Resurrected',
  'Program Files/Diablo II Resurrected',
];

/**
 * Lists the subfolder names of a folder, sorted so the result does not depend on the file system.
 * @returns The names (at most {@link MAX_FOLDER_ENTRIES}), or none if the folder can't be read
 */
function listFolderNames(folder: string): string[] {
  try {
    return readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name)
      .sort()
      .slice(0, MAX_FOLDER_ENTRIES);
  } catch {
    return [];
  }
}

/**
 * Keeps the existing folders, each once: symlinked locations (`~/.steam/steam`, the `steamuser`
 * profile Lutris links to the user's) are compared by their resolved path, which is returned.
 */
function uniqueExistingFolders(folders: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const folder of folders) {
    let resolved: string;
    try {
      resolved = realpathSync(folder);
    } catch {
      continue;
    }
    if (!seen.has(resolved)) {
      seen.add(resolved);
      result.push(resolved);
    }
  }
  return result;
}

/**
 * Reads the library folders of a Steam installation: the installation itself and the extra
 * libraries in `steamapps/libraryfolders.vdf` (e.g. on an SD card).
 */
function readSteamLibraries(steamRoot: string): string[] {
  const libraries = [steamRoot];
  try {
    const vdf = readFileSync(path.join(steamRoot, 'steamapps', 'libraryfolders.vdf'), 'utf8');
    for (const match of vdf.matchAll(/"path"\s+"((?:[^"\\]|\\.)*)"/g)) {
      libraries.push(match[1].replace(/\\(.)/g, '$1'));
    }
  } catch {
    // No library list: only the installation itself is a library
  }
  return libraries;
}

/** Lists the Steam library folders of every Steam installation in the home folder. */
function findSteamLibraries(home: string): string[] {
  const roots = uniqueExistingFolders(STEAM_ROOTS.map((root) => path.join(home, root)));
  return uniqueExistingFolders(roots.flatMap(readSteamLibraries));
}

/**
 * Lists the Proton prefixes of a Steam library, the Steam release of D2R first. That one is added
 * directly, so the cap on the listed entries can't cut it; prefixes that don't exist are dropped
 * later.
 */
function listProtonPrefixes(library: string): string[] {
  const compatdata = path.join(library, 'steamapps', 'compatdata');
  const appIds = listFolderNames(compatdata).filter((appId) => appId !== D2R_STEAM_APP_ID);
  return [D2R_STEAM_APP_ID, ...appIds].map((appId) => path.join(compatdata, appId, 'pfx'));
}

/**
 * Lists the Wine prefixes (folders with a `drive_c`) in the home folder, in a fixed order:
 * `$WINEPREFIX`, Steam's Proton prefixes, Lutris, Heroic, Bottles, then `~/.wine`.
 * @param home - The home folder
 * @param winePrefix - The `WINEPREFIX` environment variable, if set
 */
function findWinePrefixes(home: string, winePrefix: string | undefined): string[] {
  const candidates = [
    ...(winePrefix && path.isAbsolute(winePrefix) ? [winePrefix] : []),
    ...findSteamLibraries(home).flatMap(listProtonPrefixes),
    ...PREFIX_PARENTS.flatMap((parent) => {
      const folder = path.join(home, parent);
      return listFolderNames(folder).map((name) => path.join(folder, name));
    }),
    path.join(home, '.wine'),
  ];
  return uniqueExistingFolders(candidates).filter((prefix) =>
    existsSync(path.join(prefix, 'drive_c')),
  );
}

/** Checks whether a folder directly contains a `.d2s` character save file. */
function hasCharacterSaveFiles(folder: string): boolean {
  try {
    return readdirSync(folder).some(
      (name) => path.extname(name).toLowerCase() === CHARACTER_SAVE_EXTENSION,
    );
  } catch {
    return false;
  }
}

/**
 * Finds the D2R save folders (`drive_c/users/<user>/Saved Games/Diablo II Resurrected`) inside the
 * Wine and Proton prefixes in the home folder. Folders with character files come first; otherwise
 * the order is fixed (see {@link findWinePrefixes}), so the first entry stays the same between
 * calls as long as the folders don't change.
 * @param home - The home folder
 * @param env - Environment to read `WINEPREFIX` from
 * @returns The existing save folders, resolved and without duplicates
 */
export function findWineSaveDirectories(
  home: string,
  env: Record<string, string | undefined> = process.env,
): string[] {
  const candidates = findWinePrefixes(home, env.WINEPREFIX).flatMap((prefix) => {
    const users = path.join(prefix, 'drive_c', 'users');
    return listFolderNames(users)
      .filter((user) => user !== 'Public')
      .map((user) => path.join(users, user, 'Saved Games', D2R_SAVE_FOLDER_NAME));
  });
  const folders = uniqueExistingFolders(candidates);
  const withCharacters = folders.filter(hasCharacterSaveFiles);
  return [...withCharacters, ...folders.filter((folder) => !withCharacters.includes(folder))];
}

/**
 * Finds D2R install folders: the Steam release in the Steam libraries
 * (`steamapps/common/Diablo II Resurrected`), then Battle.net installs inside the Wine and Proton
 * prefixes (`drive_c/Program Files (x86)/Diablo II Resurrected`).
 * @param home - The home folder
 * @param env - Environment to read `WINEPREFIX` from
 * @returns The existing install folders, resolved and without duplicates
 */
export function findWineD2RInstallations(
  home: string,
  env: Record<string, string | undefined> = process.env,
): string[] {
  return uniqueExistingFolders([
    ...findSteamLibraries(home).map((library) =>
      path.join(library, 'steamapps', 'common', 'Diablo II Resurrected'),
    ),
    ...findWinePrefixes(home, env.WINEPREFIX).flatMap((prefix) =>
      PREFIX_INSTALL_FOLDERS.map((folder) => path.join(prefix, 'drive_c', folder)),
    ),
  ]);
}
