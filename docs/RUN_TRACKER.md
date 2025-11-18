# Run Tracker Guide

Comprehensive instructions for the D2R Arcane Tracker **Run Tracker**, which records every farming session, individual runs, and loot history. Use this guide alongside the [Holy Grail Guide](./HOLY_GRAIL_GUIDE.md) for the full tracking experience.

---

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Interface Tour](#interface-tour)
  - [Session Card](#session-card)
  - [Session Controls](#session-controls)
  - [Sessions List](#sessions-list)
  - [Session Detail View](#session-detail-view)
- [Tracking Modes](#tracking-modes)
  - [Automatic Mode (Memory Reading)](#automatic-mode-memory-reading)
  - [Manual Mode (Keyboard Shortcuts)](#manual-mode-keyboard-shortcuts)
- [Recording Run Items](#recording-run-items)
- [Exporting Session Data](#exporting-session-data)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Overview

The Run Tracker keeps a structured history of your farming activity:

- **Sessions** represent a play segment that you start and end manually.
- **Runs** are individual game instances inside a session.
- Every run tracks **start/end timestamps, duration, and loot**.
- Automatic signals from the Diablo II memory reader or manual shortcuts ensure accurate timing.
- Data persists locally in SQLite, so you can free up in-game inventory immediately after each run.

The Run Tracker powers future analytics features and complements Holy Grail progress by showing not just *what* you found but *when* and *during which run* you found it.

---

## Prerequisites

| Feature | Requirement |
| --- | --- |
| Run Tracker tab | Latest desktop build (Windows/macOS/Linux) |
| Auto Mode | Windows 10+, memory reader offsets configured via Settings |
| Manual Shortcuts | Any platform, set in `Settings → Run Tracker` |
| Item Logging | Either automatic item detection (save monitoring) or manual entry in the Run Tracker |

Ensure your save file path is configured and characters appear in the app before starting sessions.

---

## Interface Tour

Open `Run Tracker` from the top navigation bar to see a three-column layout.

### Session Card

- Shows the **active session** (or prompts you to start one).
- Displays timers for total session time and run time.
- Includes quick stats (runs completed, average duration, items logged) and notes.

### Session Controls

Central control panel for session and run actions:

- `Start Session` / `End Session`
- `Start Run`, `Pause/Resume Run`, `End Run`
- Manual item entry
- Status badges highlighting auto-mode/pause state

### Sessions List

- Timeline of recent and archived sessions.
- Selecting a session opens the **Session Detail View**.
- Indicators for open/archived status, total runs, total time, and notes.

### Session Detail View

When you select a session:

- **Runs Table**: ordered runs with number, duration, and completion state.
- **Run Items**: expand a run to see items detected or manually logged.
- **Export Controls**: open the export dialog to share data (CSV/JSON/Text).
- **Stats Summary**: average duration, total loot, characters used.

---

## Tracking Modes

### Automatic Mode (Memory Reading)

- Windows-only feature using the memory reader service defined in `electron/services/runTracker.ts`.
- Enable **Auto Mode** in `Settings → Run Tracker`.
- Configure the polling interval (100–5000 ms). Lower values detect run boundaries faster but use more CPU.
- Requirements:
  - D2R.exe running with valid offsets (shipped in `electron/config/d2rPatterns.ts`).
  - An active Run Tracker session.
- Behavior:
  - When you enter a game, the memory reader emits `game-entered`, starting a run.
  - Leaving the game emits `game-exited`, ending the run and recording duration automatically.
  - Auto mode pauses if you pause the run manually or disable auto mode in settings.

### Manual Mode (Keyboard Shortcuts)

Available on all platforms:

- Configure shortcuts under `Settings → Run Tracker`.
- Default mappings (can be customized):
  - `Ctrl+R` – Start Run
  - `Ctrl+Space` – Pause/Resume Run
  - `Ctrl+E` – End Run
  - `Ctrl+Shift+E` – End Session
- Manual mode is always available even when auto mode is active. Use it for retroactive adjustments or when offsets temporarily fail.

---

## Recording Run Items

The Run Tracker listens for `run-tracker:run-item-added` IPC events and refreshes the run’s loot table automatically. Items appear when:

1. The save-file monitor detects a new Holy Grail item in any character or stash.
2. You add a manual run item via the Run Tracker UI (useful for console/self-reported drops).

Each item stores:

- Item ID and name (if available)
- Associated run and session
- Timestamp (`foundTime`)
- Grail progress linkage to show whether it contributed to overall completion

---

## Exporting Session Data

Use the **Export Session** button in the Session Detail View:

- **CSV** – Spreadsheet-friendly summary of session metadata, runs, and optional items.
- **JSON** – Machine-readable export for scripts or external dashboards.
- **Text Summary** – Concise run log; choose **Basic** or **Detailed**.
- Optional toggle to include per-run loot.
- Save to file or copy to clipboard.

Exports include timestamps, durations, run numbers, archive flags, and notes, making it easy to share results in community posts or with friends.

---

## Best Practices

- **Start a session** before entering a game to ensure runs are captured.
- **Refresh active run** via the Run Tracker page if you launch the app mid-session—this re-syncs with the backend store.
- **Use notes** to annotate goals (“TZ farming”, “Key runs”) for future reference.
- **Archive sessions** once reviewed—archived sessions stay searchable but won’t clutter active lists.
- **Combine with Holy Grail tracking**: Run history plus grail progress offers a complete picture of efficiency.

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Run Tracker stuck on “Loading…” | Ensure the Run Tracker service initialized: open the app logs or restart the app. |
| Auto mode does nothing | Verify you are on Windows, offsets are up to date, and auto mode is enabled in settings. Restart the app after toggling. |
| Manual shortcut not working | Shortcuts may conflict with system/global bindings. Choose unique combinations (e.g., `Ctrl+Alt+R`). |
| Items missing from runs | Confirm the Grail tracker is detecting items (check main dashboard). Use manual entry in Run Tracker to log out-of-band drops. |
| Export dialog empty | Selected session must contain at least one run. If you disabled “Include items,” loot will not appear in exports. |

---

## FAQ

**Do I need to keep items in-game once they’re logged?**  
No. As soon as a run item is recorded, it lives in the SQLite database. You can delete or trade the in-game item.

**Can I run auto mode on macOS/Linux?**  
Memory reading is Windows-only today. You can still use manual shortcuts everywhere.

**What happens if the app crashes during a session?**  
On startup the Run Tracker service cleans up stale sessions (closing anything left open) so the database remains consistent. Start a new session and continue.

**Does the Run Tracker work without the Grail tracker?**  
Yes. Run Tracker operates independently, but when used together you get end-to-end visibility: grail completion + run-by-run provenance.

---

Happy farming, and may your runs be efficient! 🏆

