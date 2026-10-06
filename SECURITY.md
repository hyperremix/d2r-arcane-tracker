# Security Policy

## Reporting a vulnerability

**Don't open public issues for security problems.** Report them privately through [GitHub Security Advisories](https://github.com/hyperremix/d2r-arcane-tracker/security/advisories/new).

Please include:

- The type of issue and its impact.
- The affected files, version or commit.
- Steps to reproduce, and a proof of concept if you have one.

You'll get an acknowledgment within 48 hours. Most fixes should ship within 90 days, depending on complexity. Fixes are released as patch versions and announced in a security advisory and the release notes. With your permission, you'll be credited.

Only the [latest release](https://github.com/hyperremix/d2r-arcane-tracker/releases/latest) receives security fixes.

## Scope

**In scope:** the Electron main and renderer processes, IPC and the preload API, save file parsing and other filesystem access (including writes to D2R files for terror zones), the SQLite database, the auto-updater, and bundled dependencies.

**Out of scope:** issues that need physical access or malware already on the machine, problems in Diablo II: Resurrected itself, social engineering, and local denial of service.

## What the app accesses

- **Reads** your D2R save files. With auto mode on, it also reads D2R's process memory and never writes to it.
- **Writes** its own database and data folder. It writes `desecratedzones.json` in the D2R folder only when you use [Terror Zone Configuration](docs/TERROR_ZONE_CONFIGURATION.md).
- **Network**: it checks GitHub Releases for updates on startup. It doesn't collect or send any personal or save data.

Only download the app from the official [Releases page](https://github.com/hyperremix/d2r-arcane-tracker/releases).
