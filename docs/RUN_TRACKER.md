# Run Tracker Guide

The Run Tracker records farming sessions, the runs in each session, and what you found in each run. It uses the same item detection as the [Holy Grail tracker](HOLY_GRAIL_GUIDE.md#how-item-detection-works).

## Concepts

- **Session**: a block of play time. You always start and end sessions yourself.
- **Run**: one game inside a session, with start and end time, duration and loot.
- **Run item**: a grail item found during a run, either detected from save files or added by hand.

Data is stored locally. Closing or crashing the app ends any open session, and you start a new one the next time.

## The Run Tracker page

Open the Run Tracker from the title bar (the **Run Counter** button):

- **Session card**: the active session with session and run timers, quick stats and notes.
- **Session controls**: start or end the session, start, pause, resume or end runs, add items by hand, and toggle **Auto Mode**.
- **Sessions list**: past sessions. Select one to see its runs, the items in each run, and summary stats.

## Tracking runs

### Auto mode (Windows only)

Auto mode reads D2R's memory to tell whether you're in a game. It starts a run when you join a game and ends it when you leave.

1. Start a session. Auto mode never starts one for you.
2. Turn on **Auto Mode** in the session controls.
3. Optional: change the polling interval in **Settings → Run Tracker Settings** (100–5000 ms, default 500). Lower values react faster and use more CPU.

While auto mode is on, the manual run and end-session controls (buttons and shortcuts) are disabled.

Auto mode only reads memory and never writes to the game process. Each D2R patch needs a verified memory offset. After a patch that isn't supported yet, auto mode does nothing until an app update adds it. See [Troubleshooting](#troubleshooting).

### Manual controls and shortcuts

With auto mode off, use the buttons or these shortcuts. You can change them in **Settings → Run Tracker Settings**.

| Action | Default |
| --- | --- |
| Start run | `Ctrl+R` |
| Pause / resume run | `Ctrl+Space` |
| End run | `Ctrl+E` |
| End session | `Ctrl+Shift+E` |

Shortcuts only work while the app window is focused on the Run Tracker page. They are ignored while you're typing in a text field.

## Run items

Grail items detected while a run is active are added to that run automatically. Because D2R only saves when you leave a game, they appear once you exit. Use **Add Item Manually** in the session controls for anything the app didn't detect.

## Exporting

Use the export button on the session card or in a session's detail view:

- **CSV**: for spreadsheets.
- **JSON**: for scripts and other tools.
- **Text**: a summary, basic or detailed.

You can include or leave out per-run items, and either save to a file or copy to the clipboard. The **Statistics** page shows analytics across all sessions.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Auto mode does nothing | Make sure you're on Windows, D2R is running, and a session is active. If the settings show *Auto mode temporarily unavailable*, or the log says `Unknown D2R build`, your D2R version isn't supported yet. Use manual controls and [open an issue](https://github.com/hyperremix/d2r-arcane-tracker/issues) with your D2R version. |
| Shortcut doesn't fire | Focus the app on the Run Tracker page and turn auto mode off. Choose a combination that doesn't clash with other software. |
| Items missing from a run | Check that the item shows as found in the grail view. Leave the game so D2R writes the save file. Add the item manually if needed. |
| Export has no loot | Turn on the option to include items, and make sure the session has runs with items. |

Developers adding support for a new D2R build: see [Memory Reading](MEMORY_READING.md#adding-a-new-d2r-build).
