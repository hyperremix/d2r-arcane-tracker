# Terror Zone Configuration

Terror zones are areas that rotate on a schedule, with monsters scaled up and better loot. This feature shows the schedule of your offline game, and lets you choose which of the 34 zones the game rotates through. You could use it to farm only the zones you care about, or to make the schedule predictable for a stream.

> **Warning:** this modifies a file in your D2R installation. The app backs up the original first, but you're responsible for changes you make to game files.

## Requirements

1. All game files [extracted](EXTRACTING_GAME_FILES.md), and D2R started with `-direct -txt` ([how](EXTRACTING_GAME_FILES.md#making-d2r-use-the-extracted-files)). Without the flags, D2R ignores your changes.
2. **Settings → D2R installation** pointing at your D2R folder.
3. Write access to the D2R folder.
4. D2R closed while you make changes.

## Schedule

Open **Terror zone schedule** with **Terror zones** in the title bar (in the **More** menu when the window is too narrow to show every page). It shows the offline (single-player) rotation in your local time:

- **Current terror zone**, with the time left in its window, such as *Ends in 12 min* or *Ends in 1 hr 20 min*. The last minute counts down in seconds.
- **Next terror zone**, with the time until it starts.
- **Upcoming terror zones** for roughly the next 12 hours: a compact list of start times and zones, grouped under *Today*, *Tomorrow* or the weekday. Next to the current and next cards on wide windows, below them on narrower ones.

When the [farming advisor](FARMING_ADVISOR.md) can read your game files, each zone also shows how many of your missing grail items its terrorized monsters can drop in any difficulty, for example *12 missing items can drop here*. The count follows the character level set on the farming advisor page. Without the farming data, nothing extra is shown.

The app calculates the schedule itself, with the same algorithm as the game ([how it works](TERROR_ZONE_FINDINGS_2026.md)), so it needs no internet connection. It reads `desecratedzones.json` in your D2R folder, so the schedule follows the zones you turned off on the configuration page: it is recalculated every time you open the page, and the page reloads it when a zone's window ends.

When the schedule falls back to the retail default, the page checks your D2R folder with the same validation as the configuration page, which backs up `desecratedzones.json` the first time it finds the file.

- If no D2R folder is set, the page shows the retail schedule with a prompt to set the folder and an **Open D2R installation settings** button. The farming advisor, the **Where to farm** section of the item details and the configuration page show the same prompt.
- If a D2R folder is set but the page can't use its game file, it shows the retail schedule with a warning that says why: the folder doesn't exist or `desecratedzones.json` isn't in it (both with a button to the D2R installation setting), or the file can't be read. [Extract the game files](EXTRACTING_GAME_FILES.md) to fix the last two, then reopen the page.
- If the check of the folder fails or gives no reason, the retail schedule is shown without an explanation.
- If the game file is from an older version of D2R (before patch 3.x), D2R can't run a rotation from it. The page says so and shows the retail schedule. [Extract the game files](EXTRACTING_GAME_FILES.md) again, delete `desecratedzones.json.original` from the app's data folder and reopen the configuration page, so the app backs up the current file. **Restore original** puts back the backup, so an outdated backup brings the outdated file back.
- If the game file has no zones, the page says that no terror zone is scheduled.
- D2R only uses the game file when started with `-direct -txt`. Without the flags your game follows the retail schedule, which differs from the page whenever the file has been changed.
- The game reads the file when it starts. A change you saved shows in the schedule at once, but a running game keeps its old zones until you restart it.

To keep an eye on the terror zone while you play, set **Settings → Widget settings → Display mode** to **Terror zone**. The [widget](HOLY_GRAIL_GUIDE.md#widget) then shows the current zone with a countdown and the next three zones.

Use **Configure zones** on the schedule page to open the configuration page, and **View schedule** there to come back.

## Usage

Open **Terror Zone Configuration** with **Configure zones** on the schedule page. The page checks your installation path and the game file. When it can read the game file, it lists every zone with a switch, grouped by act. A warning at the top explains that the page edits your game files, lists the launch flags and links back to this guide.

Until the zones can be read, the page shows one of these instead of the zone list:

- **No D2R installation folder is set yet:** the page only asks you to set it, with an **Open D2R installation settings** button. It is the same prompt the schedule and the farming advisor show.
- **The folder is set but the game file can't be used:** the page shows what went wrong. A missing folder gets a button to the D2R installation setting, and a missing game file gets the extraction steps.
- **Reading the zones failed:** the page shows *Failed to load terror zone data* with a **Retry** button.

The zone list, search, counter and bulk actions appear once the problem is fixed. Open the page again, or click **Retry** if it is shown, to check again.

- Toggle zones one at a time, or use **Enable all** or **Disable all**. **Disable all** asks for confirmation first, because it saves a game file with no terror zones.
- Search zones by name. The counter shows how many are enabled.
- **Restore original** puts back the original game file and clears your selection. It is only shown while the zone list is, so not while the page reports a problem with the installation or the game file.

Each change is written to the game file right away. The switch you toggled shows a spinner until the write finishes, while the other switches stay usable. A *Terror zones saved* notification confirms each save. If a save fails, the switch goes back to its previous state and an error is shown. The error clears after the next successful save.

Changes don't reach a running game. Restart D2R with `-direct -txt` for them to take effect. After you save a change or restore the original file, *Restart D2R to apply your changes* is shown next to the counter until you close the app.

## How it works

- The game file is `<D2R folder>/Data/hd/global/excel/desecratedzones.json`. The app writes only the zones you enabled to it. The rotation depends on the exact zone list, so every zone you turn off changes which zone runs when.
- The first time it reads the file, the app copies the untouched original to `desecratedzones.json.original` in its data folder. This copy is never changed. Restore uses it.
- Your selection is stored in the app's database and kept across restarts.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| *Set your D2R installation folder* | Click **Open D2R installation settings** and set **Settings → D2R installation** to the main D2R folder, not a subfolder. |
| *Failed to load terror zone data* | The app couldn't read the zones. Click **Retry**, or reopen the page. |
| *D2R installation directory does not exist* | Click **Open D2R installation settings** and choose the main D2R folder again. |
| *Game Files Must Be Extracted*, or *desecratedzones.json file not found in D2R installation* | [Extract all game files](EXTRACTING_GAME_FILES.md) and check that `Data/hd/global/excel/desecratedzones.json` exists. |
| *Invalid desecratedzones.json file structure*, or *desecratedzones.json file is corrupted or invalid* | The game file can't be read as a terror zone file, and **Restore original** isn't offered while this is shown. [Extract the game files](EXTRACTING_GAME_FILES.md) again so a fresh `desecratedzones.json` replaces it, or repair D2R through Battle.net, then reopen the page. |
| *Unable to validate the D2R installation* | Check that the D2R folder exists and the app can read it, then reopen the page. |
| *Failed to update terror zone configuration*, *Failed to enable all zones*, *Failed to disable all zones* or *Failed to restore original file* | The change wasn't made, and any switches you changed go back to their previous state. Close D2R, check that the app has write access to the D2R folder (see [Requirements](#requirements)) and try again. |
| Changes have no effect in game | Start D2R with `-direct -txt` and restart it after each change. |
| D2R won't start after you changed zones | If the zone list is shown, click **Restore original**. If the page shows a problem with the game file instead, follow the fix for that message above. If it still fails, repair D2R through Battle.net and extract the files again. |
| *The D2R installation folder set in Settings doesn't exist* (schedule page) | Click **Open D2R installation settings** and choose the main D2R folder again. |
| *desecratedzones.json isn't in your D2R folder* or *desecratedzones.json in your D2R folder can't be read* (schedule page) | [Extract the game files](EXTRACTING_GAME_FILES.md) again and reopen the page. |
| The schedule page doesn't match the zone shown in game | Check that D2R was started with `-direct -txt` and restarted after the last change. A game started without the flags follows the retail schedule. |
| Zones are wrong after a D2R patch | The backup is from the old version. Extract the game files again, delete `desecratedzones.json.original` from the app's data folder, reopen the page so the app backs up the new file, then set your zones again. |
