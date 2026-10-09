# Run Tracker Guide

The Run Tracker records farming sessions, the runs in each session, and what you found in each run. It uses the same item detection as the [Holy Grail tracker](HOLY_GRAIL_GUIDE.md#how-item-detection-works).

## Concepts

- **Session**: a block of play time. You always start and end sessions yourself.
- **Run**: one game inside a session, with start and end time, duration and loot.
- **Run item**: a grail item found during a run, either detected from save files or added by hand.

Data is stored locally. Closing or crashing the app ends any open session, and you start a new one the next time.

## The Run Tracker page

Open the Run Tracker from the title bar (the **Run Counter** button). The page is built to be read at a glance between runs:

- **Live session**: a large timer for the current run and a status badge (**Running**, **Paused**, **Idle** or **No Session**). Next to it is one main button that changes with the state: **Start New Session** when no session is active, **Start Run** between runs, and **End Run** during a run. In manual mode, **End Session** sits beside **Start Run** between runs, and **Pause**/**Resume** and **End Session** sit beside **End Run** during a run. With [auto mode](#auto-mode-windows-only) on, the run buttons are replaced and only **End Session** remains. Below are **Auto Mode** (Windows only), **Add Item Manually** and a reminder of your keyboard shortcuts.
- **Active session**: a compact row of session time, run count, average and fastest run, efficiency, items found and new grail items, then **Recent Runs** and the session actions. Recent Runs lists the last five finished runs, newest first, with each run's duration and the items found in it. **View all runs** opens the full run history of the active session. **Session Notes** are collapsed by default; select the toggle to open them. Archive and export are at the bottom.
- **Sessions list**: past sessions. Select one to see its runs, the items in each run, and summary stats.

Efficiency is the share of the session spent in runs. It updates live and counts the run in progress, so it is correct before your first run ends.

## Tracking runs

### Auto mode (Windows only)

Auto mode reads D2R's memory to tell whether you're in a game. It starts a run when you join a game and ends it when you leave.

1. Start a session. Auto mode never starts one for you.
2. Turn on **Auto Mode** in the live session card.
3. Optional: change the polling interval in **Settings → Run Tracker Settings** (100–5000 ms, default 500). Lower values react faster and use more CPU.

The app remembers whether auto mode is on or off between launches, so turning it off stays off after you restart.

While auto mode is on, the run buttons are replaced by a *Runs are tracked automatically* notice and the Start Run, Pause/Resume and End Run shortcuts are disabled. **End Session** and its shortcut stay available, so you can still stop a tracked session. If auto mode is on but memory reading isn't available for your D2R version, a warning appears in the live session area, the notice is hidden and the run buttons and shortcuts come back so you can track runs manually.

Auto mode only reads memory and never writes to the game process. Each D2R patch needs a verified memory offset. After a patch that isn't supported yet, auto mode does nothing until an app update adds it. See [Troubleshooting](#troubleshooting).

### Manual controls and shortcuts

Turn auto mode off to use the buttons, or use these shortcuts. You can change the shortcuts in **Settings → Run Tracker Settings**.

| Action | Default |
| --- | --- |
| Start run | `Ctrl+R` |
| Pause / resume run | `Ctrl+Space` |
| End run | `Ctrl+E` |
| End session | `Ctrl+Shift+E` |

By default, shortcuts only work while the app window is focused on the Run Tracker page. They are ignored while you're typing in a text field.

### Global hotkeys

Turn on **Global hotkeys** in **Settings → Run Tracker Settings** to use the shortcuts while D2R (or any other app) is focused, so you don't have to alt-tab between runs. It is off by default.

- From another app, the shortcuts work no matter which page the tracker shows, even when its window is minimized. **Global hotkeys active** appears next to the shortcut list in the session controls once they're set up.
- When you press a shortcut from another app, End Run and End Session act right away, without the confirmation dialog.
- While the app window itself is focused, the shortcuts behave as described above, so each press only triggers once.
- While the app is in the background, other apps (including D2R) don't receive these key combinations. Pick combinations you don't need elsewhere.
- Global shortcuts must use `Ctrl` or `Alt` (`Cmd` or `Option` on macOS), unless the key is a function key (`F1`–`F24`). This keeps plain typing working in other apps.
- If a shortcut is already taken by another app, or two actions share the same shortcut, the settings show which one couldn't be registered. Choose a different shortcut.
- If the run tracker service is unavailable, no global hotkeys are registered and the settings show a hint.

## Run items

Grail items detected while a run is active are added to that run automatically. Because D2R only saves when you leave a game, they appear once you exit. **New Grail Items** (on the active session card and in a session's details) counts the items found in the session's runs that weren't in your grail before. Repeat finds and items added manually by name don't count. Use **Add Item Manually** in the live session card for anything the app didn't detect.

## Exporting

Use the export button on the active session card or in a session's detail view:

- **CSV**: for spreadsheets.
- **JSON**: for scripts and other tools.
- **Text**: a summary, basic or detailed.

You can include or leave out per-run items, and either save to a file or copy to the clipboard. The **Statistics** page shows analytics across all sessions that aren't archived. Average, fastest and slowest run only count completed runs, so a run in progress doesn't skew them. Until you've tracked a run, the page shows an empty state instead.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Auto mode does nothing | Make sure you're on Windows, D2R is running, and a session is active. If the settings show *Auto mode temporarily unavailable*, or the log says `Unknown D2R build`, your D2R version isn't supported yet. Use manual controls and [open an issue](https://github.com/hyperremix/d2r-arcane-tracker/issues) with your D2R version. |
| Shortcut doesn't fire | Focus the app on the Run Tracker page and make sure you're not typing in a text field, or turn on [global hotkeys](#global-hotkeys). Choose a combination that doesn't clash with other software. In auto mode only End Session works. |
| Items missing from a run | Check that the item shows as found in the grail view. Leave the game so D2R writes the save file. Add the item manually if needed. |
| Export has no loot | Turn on the option to include items, and make sure the session has runs with items. |

Developers adding support for a new D2R build: see [Memory Reading](MEMORY_READING.md#adding-a-new-d2r-build).
