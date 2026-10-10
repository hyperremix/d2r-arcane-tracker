# Memory Reading (Run Tracker Auto Mode)

This is developer documentation for how [auto mode](RUN_TRACKER.md#auto-mode-windows-only) detects when you enter and leave a game, and how to support a new D2R build. It applies to Windows only.

## Overview

```text
ProcessMonitor   polls `tasklist` every 2 s for D2R.exe → emits d2r-started / d2r-stopped
      ↓
MemoryReader     opens the process (PROCESS_VM_READ | PROCESS_QUERY_INFORMATION),
                 resolves the in-game flag offset, then polls one byte
                 (runTrackerMemoryPollingInterval, 100–5000 ms, default 500)
      ↓          emits game-entered (0 → 1) / game-exited (1 → 0)
RunTracker       starts/ends runs in the active session
```

| File | Role |
| --- | --- |
| `electron/services/processMonitor.ts` | Detects D2R.exe |
| `electron/services/memoryReader.ts` | Offset resolution, polling |
| `electron/services/win32/processMemory.ts` | Windows API calls through `win32-api`, loaded on Windows only |
| `electron/config/d2rBuilds.ts` | `KNOWN_D2R_BUILDS`: verified offsets per build |
| `electron/config/d2rPatterns.ts` | d2go UI signature for the fallback scan |
| `electron/services/uiOffsetResolver.ts` | Validates signature matches |
| `electron/services/runTracker.ts` | Turns events into runs |
| `scripts/d2r-find-ingame-flag.py` | Finds the flag for a new build |

The app only reads memory. It never writes to the game process. Save file monitoring is separate and handles item detection only. It's never used to detect runs.

## The in-game flag

Run detection reads **one byte** at `D2R.exe base + RVA`. The byte is `0` in the lobby and `1` in a game. `MemoryReader.resolveInGameFlagOffset()` finds the RVA:

1. **Known build.** The build is identified from the PE header (`TimeDateStamp` + `SizeOfImage`), which can always be read, and looked up in `KNOWN_D2R_BUILDS`. If the flag byte doesn't read as 0 or 1 yet because D2R is still starting, the app retries the verified offset instead of scanning.
2. **Unknown build.** The log shows `Unknown D2R build (PE timestamp …, image size …)`. The app falls back to the [d2go](https://github.com/hectorgimenez/d2go) UI signature `40 84 ed 0f 94 05`. This is **unverified**: in D2R 3.x it no longer lands on the flag, so an unknown build usually means auto mode doesn't work until the build is added.

Resolution is retried every 5 seconds, for up to 10 minutes, until it succeeds or D2R exits.

### Why a table instead of a signature scan

In D2R 3.3 the code is obfuscated. About a quarter of the image is `PAGE_NOACCESS` at any moment, so the page holding a signature may be unreadable. The d2go signature now matches two instructions that write other fields, and the flag isn't at a stable distance from either of them across versions.

The fallback scan is still written to be safe:

- The module image is read into a buffer where buffer index equals RVA. Unreadable pages are left zero-filled, not skipped, so later offsets don't shift.
- The read is limited to the module's real `ModuleMemorySize`.
- The RIP-relative displacement is read as signed 32-bit.
- Every match is checked against the live process, and its flag byte must read 0 or 1. The zero-filled snapshot doesn't count as evidence, because it can't tell an unreadable page from a real zero.

## Adding a new D2R build

When a patch breaks auto mode and the log shows `Unknown D2R build`:

1. Start D2R, then run `python scripts/d2r-find-ingame-flag.py` on Windows. It has no dependencies.
2. While the script runs, sit in the lobby, enter a game, stay 10–20 seconds, then leave to the lobby.
3. The script prints the build identity and the bytes that behaved like the flag. Pick the one marked `<- 0->1->0 once` whose "longest 1" is about as long as you stayed in the game.
4. Add an entry to `KNOWN_D2R_BUILDS` with `fileVersion`, `timeDateStamp`, `sizeOfImage` and `inGameFlagRva`.
5. Check it in the app. The log should show `Known D2R build <version> - using verified in-game flag offset`, and runs should start and end as you enter and leave games.

D2R 3.3.93847 was the first build added this way, with the flag at RVA `0x1EBD158`.

## Troubleshooting

- **Nothing happens.** Check that auto mode is enabled, a session is active, and D2R.exe is running. The ProcessMonitor logs when it detects D2R.
- **`Unknown D2R build`.** Add the build as described above.
- **`flag byte is not readable as 0/1 yet`.** This is normal while D2R is loading, and it should resolve by the time you reach character select. If it never resolves, the `KNOWN_D2R_BUILDS` entry is wrong. Run the script again.
- **The process can't be opened.** Security software or Windows settings may block `OpenProcess`. Try running the app as administrator once to confirm.
