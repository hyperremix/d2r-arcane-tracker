# Releasing

Releases ship as a Windows NSIS installer and a Linux AppImage on [GitHub Releases](https://github.com/hyperremix/d2r-arcane-tracker/releases). Installed apps use `electron-updater` to update themselves from there. CI (`.github/workflows/ci.yml`) runs checks, smoke-builds both packages, and builds and deploys the website from `website/`. The release workflow (`.github/workflows/release.yml`) builds the release packages.

## Steps

1. **Check `main`**: CI is green, and the [manual checks](#manual-checks) pass on Windows and, if you can, on Linux or a Steam Deck.
2. **Bump the version** (updates `package.json`, commits, tags `vX.Y.Z` and pushes):

   ```bash
   bun run version:patch   # or version:minor / version:major
   ```

3. **Build**: the pushed tag starts the release workflow. It creates a draft release for the tag with generated notes, then builds on Windows and on Linux and uploads to the draft:
   - `D2R-Arcane-Tracker-Windows-<version>-Setup.exe` and `latest.yml`
   - `D2R-Arcane-Tracker-Linux.AppImage` and `latest-linux.yml`

   Auto-update needs the two `latest*.yml` files. Without them, installed apps won't see the release. The AppImage has no version in its name, so an update replaces the file in place and shortcuts to it keep working.
4. **Publish**: once both builds are uploaded, check the draft and publish it.

To build locally instead, run `bun run build` (Windows installer) or `bun run build:linux` (AppImage). Both write to `release/<version>/`.

## Build configuration

`electron-builder.json5` defines a per-user x64 NSIS installer that lets the user change the install folder and keeps app data on uninstall, and an x64 AppImage for Linux. `better-sqlite3` and `@dschu012/d2s` are unpacked from the ASAR (`asarUnpack`) so their files can be loaded at runtime. The `files` patterns ship only the x64 prebuild of `better-sqlite3` for the platform being built (`win32-x64` or `linux-x64`) and leave out its other platforms' prebuilds and its SQLite and C++ sources. The native modules (`better-sqlite3`, `koffi`) ship Node-API prebuilds that work with any Electron version, so `npmRebuild` is off and no C++ toolchain is needed to package. The icons are `build/logo.ico` (Windows) and `build/logo.png` (Linux).

Builds aren't code-signed, so Windows SmartScreen warns on first run. The [README](../README.md#install) tells users how to get past it, and how to make the AppImage executable.

If the packaged app fails with `Cannot find module 'better-sqlite3'` or cannot load its `.node` file, make sure the module is still listed in the platform's `asarUnpack`, that `node_modules/better-sqlite3/prebuilds/win32-x64.node` (or `linux-x64.node`) exists, and that the `files` exclusions don't drop it.

## Manual checks

On a clean Windows machine with D2R installed:

- [ ] The installer runs. The app starts from the Start Menu and shows its icon in the taskbar.
- [ ] The setup wizard finds the save folder. Characters and items appear.
- [ ] A new grail item is detected after leaving a game, and a notification appears.
- [ ] Run Tracker auto mode starts and ends runs on entering and leaving a game ([memory reading](MEMORY_READING.md)), and manual shortcuts work with auto mode off.
- [ ] Session export saves CSV, JSON and text files, and copies to the clipboard.
- [ ] Database backup and restore work.
- [ ] Updating from the previous release works through **Settings → Application updates**.

On Linux or a Steam Deck (Desktop Mode) with D2R running through Proton or Wine:

- [ ] The AppImage starts after `chmod +x`.
- [ ] The setup wizard fills in the save folder from the game's prefix. Characters and items appear.
- [ ] Moving an item in the Inventory Browser is refused while D2R runs.
- [ ] Updating from the previous release replaces the AppImage.
