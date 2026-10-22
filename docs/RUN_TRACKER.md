# Run Tracker Guide

The Run Tracker records farming sessions, the runs in each session, and what you found in each run. It uses the same item detection as the [Holy Grail tracker](HOLY_GRAIL_GUIDE.md#how-item-detection-works).

## Concepts

- **Session**: a block of play time. You always start and end sessions yourself.
- **Run**: one game inside a session, with start and end time, duration and loot.
- **Run item**: a grail item found during a run, either detected from save files or added by hand.

Data is stored locally. Closing or crashing the app ends any open session, and you start a new one the next time.

## The Run Tracker page

Open the Run Tracker from **Runs** in the title bar. The page is built to be read at a glance between runs:

- **Live session**: a large timer for the current run and a status badge (**Running**, **Paused**, **Idle** or **No session**). Without a session, the timer is hidden and a short line invites you to start one, with **Start new session** right below it. With a session, one main button sits next to the timer and changes with the state: **Start run** between runs and **End run** during a run. In manual mode, **End session** sits beside **Start run** between runs, and **Pause**/**Resume** and **End session** sit beside **End run** during a run. With [auto mode](#auto-mode-windows-only) on, the run buttons are replaced and only **End session** remains. **End run** on the page (the button or its in-app shortcut) ends the run right away and shows a short confirmation message; runs ended by a [global hotkey](#global-hotkeys) or by auto mode show no message. Only **End session** asks you to confirm first. Each button with a [keyboard shortcut](#manual-controls-and-shortcuts) shows it as a key chip, for example `⌘R` on **Start run** on macOS or `Ctrl+R` on Windows. Below are **Auto mode** (Windows only) and **Add item manually**.
- **Active session**: a compact row of session time, run count, average and fastest run, efficiency, items found and new grail items, then **Recent runs** and the session actions. Recent runs lists the last five finished runs, newest first, with each run's duration and the items found in it. **View all runs** opens the full run history of the active session. **Session notes** are collapsed by default; select the toggle to open them. Notes are saved with the session when you leave the field, and you can also edit them from a session's detail view. Notes can be up to 10,000 characters long. Archive and export are at the bottom. **Archive session** is unavailable while a run of the session is in progress (paused included), both here and in the session's detail view; end the run first. The app refuses to archive such a session even if the request doesn't come from the button.
- **Previous sessions**: a table of past sessions, with **Show archived** to switch to archived sessions. Sessions from the last week show a relative day (**Today**, **Yesterday**, *3 days ago*), older ones a short date. Click a row, or focus it with Tab and press Enter or Space, to see its runs, the items in each run, and summary stats. The stats start with what you found (items found and new grail items), then your pace (run count, average and fastest run, efficiency), then the start, end and total time of the session.

Efficiency is the share of the session spent in runs. While a session is running, it updates live and counts the run in progress, both on the page and in the session's detail view, so it is correct before your first run ends.

### Pausing a run

**Pause** stops the clock of the current run, for example while you step away. The timer (on the Run Tracker page and in the [widget](HOLY_GRAIL_GUIDE.md#widget)) stays frozen and turns to the paused color, and the status badge shows **Paused**. **Resume** continues the clock where it stopped. Paused time is not part of the run's duration, so it doesn't count towards the session's run time, efficiency, or average and fastest run. Session time still counts the whole session. If you end a run while it's paused, its duration is the time it was running, not counting paused time.

**Pause** is one of the manual run controls, so it isn't offered while auto mode tracks your runs. If a run is paused when auto mode starts tracking your runs, the run resumes. That happens when you turn on auto mode while memory reading is available, or, if memory reading wasn't available at that point (so the manual controls stayed visible), at the next game you join or leave once it is.

## Tracking runs

### Auto mode (Windows only)

Auto mode reads D2R's memory to tell whether you're in a game. It starts a run when you join a game and ends it when you leave.

1. Start a session. Auto mode never starts one for you.
2. Turn on **Auto mode** in the live session card.
3. Optional: change the polling interval in **Settings → Run tracker settings** (100–5000 ms, default 500). Lower values react faster and use more CPU.

The app remembers whether auto mode is on or off between launches, so turning it off stays off after you restart.

While auto mode is on, the run buttons are replaced by a *Runs are tracked automatically* notice and the Start run, Pause/Resume and End run shortcuts are disabled. **End session** and its shortcut stay available, so you can still stop a tracked session. If auto mode is on but memory reading isn't available for your D2R version, a warning appears in the live session area, the notice is hidden and the run buttons and shortcuts come back so you can track runs manually.

Auto mode only reads memory and never writes to the game process. Each D2R patch needs a verified memory offset. After a patch that isn't supported yet, auto mode does nothing until an app update adds it. See [Troubleshooting](#troubleshooting).

If you start D2R through D2RLoader with the [Arcane Tracker plugin](D2RLOADER.md) connected, auto mode follows the plugin instead of memory reading: a run starts when you first leave town in a game, so time in town before the run isn't counted, and ends when you leave the game. This also works when memory reading doesn't support your D2R version.

### Manual controls and shortcuts

Turn auto mode off to use the buttons, or use these shortcuts. You can change the shortcuts in **Settings → Run tracker settings**.

| Action | Default (Windows, Linux) | Default (macOS) |
| --- | --- | --- |
| Start run | `Ctrl+R` | `⌘R` |
| Pause / resume run | `Ctrl+Space` | `⌘Space` |
| End run | `Ctrl+E` | `⌘E` |
| End session | `Ctrl+Shift+E` | `⇧⌘E` |

On macOS the shortcuts use the Command key instead of Ctrl, both in the app and as [global hotkeys](#global-hotkeys), and the app shows them with the macOS key symbols.

By default, shortcuts only work while the app window is focused on the Run Tracker page. They are ignored while you're typing in a text field.

### Global hotkeys

Turn on **Global hotkeys** in **Settings → Run tracker settings** to use the shortcuts while D2R (or any other app) is focused, so you don't have to alt-tab between runs. It is off by default.

- From another app, the shortcuts work no matter which page the tracker shows, even when its window is minimized. **Global hotkeys active** appears next to the status badge of the live session once they're set up.
- When you press the End session shortcut from another app, the session ends right away, without the confirmation dialog.
- While the app window itself is focused, the shortcuts behave as described above, so each press only triggers once.
- While the app is in the background, other apps (including D2R) don't receive these key combinations. Pick combinations you don't need elsewhere.
- Global shortcuts must use `Ctrl` or `Alt` (`Cmd` or `Option` on macOS), unless the key is a function key (`F1`–`F24`). This keeps plain typing working in other apps.
- If a shortcut is already taken by another app, or two actions share the same shortcut, the settings show which one couldn't be registered. Choose a different shortcut.
- On Linux, global hotkeys rely on X11. In a Wayland session they may not work, depending on your desktop.

## Run items

Grail items detected while a run is active are added to that run automatically. Because D2R only saves when you leave a game, they appear once you exit. **New grail items** (on the active session card and in a session's details) counts the items found in the session's runs that weren't in your grail before. Repeat finds and items added manually by name don't count, and neither do versions you don't track (for example an ethereal find while ethereal tracking is off). When both normal and ethereal items are tracked, the two versions of an item are separate entries, so finding the ethereal version of an item you already have as normal counts as new. Use **Add item manually** in the live session card for anything the app didn't detect.

## Exporting

Use the export button on the active session card or in a session's detail view:

- **CSV**: for spreadsheets.
- **JSON**: for scripts and other tools.
- **Text**: a summary, basic or detailed.

You can include or leave out per-run items, and either save to a file or copy to the clipboard. The **Statistics** page shows analytics across all sessions that aren't archived. Average, fastest and slowest run only count completed runs, so a run in progress doesn't skew them. The **Run durations by session** chart shows, for each of your 12 most recent sessions that have completed runs, the median run (connected across sessions, so you can see whether you're getting faster) and a bar spanning the middle half of the runs (the shorter the bar, the more consistent your runs). Until at least 2 sessions have completed runs there is nothing to compare, so the chart is replaced by a one-line note. Until you've tracked a run, the page shows an empty state instead, with **Open run tracker** to start one.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Auto mode does nothing | Make sure you're on Windows, D2R is running, and a session is active. If the settings show *Auto mode temporarily unavailable*, or the log says `Unknown D2R build`, your D2R version isn't supported yet. Use manual controls, or the [D2RLoader plugin](D2RLOADER.md), and [open an issue](https://github.com/hyperremix/d2r-arcane-tracker/issues) with your D2R version. With the plugin connected, runs start when you leave town, not when you join a game. |
| Shortcut doesn't fire | Focus the app on the Run Tracker page and make sure you're not typing in a text field, or turn on [global hotkeys](#global-hotkeys). Choose a combination that doesn't clash with other software. In auto mode only End session works. |
| Items missing from a run | Check that the item shows as found in the grail view. Leave the game so D2R writes the save file. Add the item manually if needed. |
| Export has no loot | Turn on the option to include items, and make sure the session has runs with items. |
| An action failed (error banner at the top of the page) | Select **Retry** to run the failed action again, for example ending the session. Errors caused by your input or the current state, such as an empty item name or adding an item before any run, have no Retry button; fix the cause and try again. A failed save of session notes has no Retry button either: the saved notes are shown again, so enter your changes again and leave the field to save them. The same goes for a failed refresh of the displayed data: the banner has no Retry button, and the data refreshes again the next time it is loaded. |

Developers adding support for a new D2R build: see [Memory Reading](MEMORY_READING.md#adding-a-new-d2r-build).
