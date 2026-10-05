# Releasing

Releases ship as a Windows NSIS installer on [GitHub Releases](https://github.com/hyperremix/d2r-arcane-tracker/releases). Installed apps use `electron-updater` to update themselves from there. CI (`.github/workflows/ci.yml`) runs checks and deploys the website from `docs/`. It doesn't build releases.

## Steps

1. **Check `main`**: CI is green, and the [manual checks](#manual-checks) pass on Windows.
2. **Bump the version** (updates `package.json`, commits, tags `vX.Y.Z` and pushes):

   ```bash
   bun run version:patch   # or version:minor / version:major
   ```

3. **Build** from the tagged commit. Windows is the safest machine to build on, because native modules must match the target platform:

   ```bash
   bun run build   # typecheck → vite build → electron-builder --win
   ```

   This writes to `release/<version>/`.
4. **Publish**: create a GitHub release for the tag with generated notes, and upload:
   - `D2R-Arcane-Tracker-Windows-<version>-Setup.exe`
   - `latest.yml`. Auto-update needs this file. Without it, installed apps won't see the release.

## Build configuration

`electron-builder.json5` defines a per-user x64 NSIS installer that lets the user change the install folder and keeps app data on uninstall. `better-sqlite3` and `@dschu012/d2s` are unpacked from the ASAR (`asarUnpack`) so their files can be loaded at runtime. The icon is `build/logo.ico`.

Builds aren't code-signed, so Windows SmartScreen warns on first run. The [README](../README.md#install) tells users how to get past it.

If a build fails with `NODE_MODULE_VERSION` or `Cannot find module 'better-sqlite3'`, run `bun run rebuild` and make sure the module is still listed in `asarUnpack`.

## Manual checks

On a clean Windows machine with D2R installed:

- [ ] The installer runs. The app starts from the Start Menu and shows its icon in the taskbar.
- [ ] The setup wizard finds the save folder. Characters and items appear.
- [ ] A new grail item is detected after leaving a game, and a notification appears.
- [ ] Run Tracker auto mode starts and ends runs on entering and leaving a game ([memory reading](MEMORY_READING.md)), and manual shortcuts work with auto mode off.
- [ ] Session export saves CSV, JSON and text files, and copies to the clipboard.
- [ ] Database backup and restore work.
- [ ] Updating from the previous release works through **Settings → Application Updates**.
