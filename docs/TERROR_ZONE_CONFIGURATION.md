# Terror Zone Configuration

Terror zones are areas that rotate on a schedule, with monsters scaled up and better loot. This feature lets you choose which of the 36 zones the game rotates through. You could use it to farm only the zones you care about, or to make the schedule predictable for a stream.

> **Warning:** this modifies a file in your D2R installation. The app backs up the original first, but you're responsible for changes you make to game files.

## Requirements

1. All game files [extracted](EXTRACTING_GAME_FILES.md), and D2R started with `-direct -txt` ([how](EXTRACTING_GAME_FILES.md#making-d2r-use-the-extracted-files)). Without the flags, D2R ignores your changes.
2. **Settings → D2R Installation** pointing at your D2R folder.
3. Write access to the D2R folder.
4. D2R closed while you make changes.

## Usage

Open **Terror Zone Configuration** with the skull icon (**Terror zones**) next to the settings icon on the right of the title bar. The page checks your installation path and the game file. When it can read the game file, it lists every zone with a switch, grouped by act. A warning at the top explains that the page edits your game files, lists the launch flags and links back to this guide.

Until the zones can be read, the page shows one of these instead of the zone list:

- **No D2R installation folder is set yet:** the page only asks you to set it, with an **Open D2R Installation settings** button.
- **The folder is set but the game file can't be used:** the page shows what went wrong. A missing folder gets a button to the D2R installation setting, and a missing game file gets the extraction steps.
- **Reading the zones failed:** the page shows *Failed to load terror zone data* with a **Retry** button.

The zone list, search, counter and bulk actions appear once the problem is fixed. Open the page again, or click **Retry** if it is shown, to check again.

- Toggle zones one at a time, or use **Enable All** or **Disable All**. **Disable All** asks for confirmation first, because it saves a game file with no terror zones.
- Search zones by name. The counter shows how many are enabled.
- **Restore Original** puts back the original game file and clears your selection. It is only shown while the zone list is, so not while the page reports a problem with the installation or the game file.

Each change is written to the game file right away. The switch you toggled shows a spinner until the write finishes, while the other switches stay usable. A *Terror zones saved* notification confirms each save. If a save fails, the switch goes back to its previous state and an error is shown. The error clears after the next successful save.

Changes don't reach a running game. Restart D2R with `-direct -txt` for them to take effect. After you save a change or restore the original file, *Restart D2R to apply your changes* is shown next to the counter until you close the app.

## How it works

- The game file is `<D2R folder>/Data/hd/global/excel/desecratedzones.json`. The app writes only the zones you enabled to it.
- The first time it reads the file, the app copies the untouched original to `desecratedzones.json.original` in its data folder. This copy is never changed. Restore uses it.
- Your selection is stored in the app's database and kept across restarts.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| *Set your D2R installation folder* | Click **Open D2R Installation settings** and set **Settings → D2R Installation** to the main D2R folder, not a subfolder. |
| *Failed to load terror zone data* | The app couldn't read the zones. Click **Retry**, or reopen the page. |
| *D2R installation directory does not exist* | Click **Open D2R Installation settings** and choose the main D2R folder again. |
| *Game Files Must Be Extracted*, or *desecratedzones.json file not found in D2R installation* | [Extract all game files](EXTRACTING_GAME_FILES.md) and check that `Data/hd/global/excel/desecratedzones.json` exists. |
| *Invalid desecratedzones.json file structure*, or *desecratedzones.json file is corrupted or invalid* | The game file can't be read as a terror zone file, and **Restore Original** isn't offered while this is shown. [Extract the game files](EXTRACTING_GAME_FILES.md) again so a fresh `desecratedzones.json` replaces it, or repair D2R through Battle.net, then reopen the page. |
| *Unable to validate the D2R installation* | Check that the D2R folder exists and the app can read it, then reopen the page. |
| *Failed to update terror zone configuration*, *Failed to enable all zones*, *Failed to disable all zones* or *Failed to restore original file* | The change wasn't made, and any switches you changed go back to their previous state. Close D2R, check that the app has write access to the D2R folder (see [Requirements](#requirements)) and try again. |
| Changes have no effect in game | Start D2R with `-direct -txt` and restart it after each change. |
| D2R won't start after you changed zones | If the zone list is shown, click **Restore Original**. If the page shows a problem with the game file instead, follow the fix for that message above. If it still fails, repair D2R through Battle.net and extract the files again. |
| Zones are wrong after a D2R patch | The backup is from the old version. Extract the game files again, delete `desecratedzones.json.original` from the app's data folder, reopen the page so the app backs up the new file, then set your zones again. |
