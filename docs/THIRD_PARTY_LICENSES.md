# Third-Party Licenses and Legal

D2R Arcane Tracker is released under the [MIT License](../LICENSE). Those terms are binding. This page is for information only.

## Trademarks

Diablo II: Resurrected is a trademark of Blizzard Entertainment, Inc. This project isn't affiliated with, endorsed by or sponsored by Blizzard. Game content such as item names, descriptions and icons belongs to Blizzard. The app doesn't ship game assets. Item icons are converted locally from your own installation.

## Game data and use

The app reads your save files and, with Run Tracker auto mode on, reads (never writes) D2R's process memory. The optional Terror Zone feature modifies a game data file. You're responsible for making sure your use follows Blizzard's Terms of Service and EULA. The authors aren't responsible for consequences of using the software. See also [SECURITY.md](../SECURITY.md#what-the-app-accesses).

## Privacy

All processing happens locally, and data is stored in a local SQLite database. The only network access is checking GitHub Releases for updates. The app has no telemetry, collects no usage data, and uploads no save data.

## Dependencies

Each dependency keeps its own license. For the full list and versions, see [`package.json`](../package.json). The main runtime dependencies:

| Package | License |
| --- | --- |
| [@dschu012/d2s](https://github.com/dschu012/d2s) (save file parser) | ISC |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | MIT |
| [drizzle-orm](https://github.com/drizzle-team/drizzle-orm) | Apache-2.0 |
| [Electron](https://github.com/electron/electron) and [electron-updater](https://github.com/electron-userland/electron-builder) | MIT |
| [React](https://github.com/facebook/react), [react-router](https://github.com/remix-run/react-router), [Zustand](https://github.com/pmndrs/zustand) | MIT |
| [Base UI](https://github.com/mui/base-ui), [shadcn/ui](https://github.com/shadcn-ui/ui), [lucide-react](https://github.com/lucide-icons/lucide) | MIT / ISC (lucide) |
| [i18next](https://github.com/i18next/i18next), [react-i18next](https://github.com/i18next/react-i18next) | MIT |
| [chokidar](https://github.com/paulmillr/chokidar), [win32-api](https://github.com/waitingsong/node-win32-api), [recharts](https://github.com/recharts/recharts) | MIT |
| [Inter](https://github.com/rsms/inter) and [Cinzel](https://github.com/NDISCOVER/Cinzel) fonts, bundled via [Fontsource](https://github.com/fontsource/fontsource) | OFL-1.1 |

Memory-reading research builds on [d2go](https://github.com/hectorgimenez/d2go) (see [MEMORY_READING.md](MEMORY_READING.md)).
