# Terror Zone Configuration

Terror zones are areas that rotate on a schedule, with monsters scaled up and better loot. This feature lets you choose which of the 36 zones the game rotates through. You could use it to farm only the zones you care about, or to make the schedule predictable for a stream.

> **Warning:** this modifies a file in your D2R installation. The app backs up the original first, but you're responsible for changes you make to game files.

## Requirements

1. All game files [extracted](EXTRACTING_GAME_FILES.md), and D2R started with `-direct -txt` ([how](EXTRACTING_GAME_FILES.md#making-d2r-use-the-extracted-files)). Without the flags, D2R ignores your changes.
2. **Settings → D2R Installation** pointing at your D2R folder.
3. Write access to the D2R folder.
4. D2R closed while you make changes.

## Usage

Open **Terror Zone Configuration** from the title bar. The page checks your installation path and the game file, then lists every zone with a switch.

- Toggle zones one at a time, or use **Enable All** or **Disable All**.
- Search zones by name. The counter shows how many are enabled.
- **Restore Original** puts back the original game file and clears your selection.

Changes are written to the game file immediately. Restart D2R with `-direct -txt` for them to take effect.

## How it works

- The game file is `<D2R folder>/Data/hd/global/excel/desecratedzones.json`. The app writes only the zones you enabled to it.
- The first time it reads the file, the app copies the untouched original to `desecratedzones.json.original` in its data folder. This copy is never changed. Restore uses it.
- Your selection is stored in the app's database and kept across restarts.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| *D2R installation path is not configured* | Set **Settings → D2R Installation** to the main D2R folder, not a subfolder. |
| *Game files must be extracted* or file not found | [Extract all game files](EXTRACTING_GAME_FILES.md) and check that `Data/hd/global/excel/desecratedzones.json` exists. |
| Changes have no effect in game | Start D2R with `-direct -txt` and restart it after each change. |
| Invalid file structure, or D2R won't start | Click **Restore Original**. If that fails, repair D2R through Battle.net and extract the files again. |
| Zones are wrong after a D2R patch | The backup is from the old version. Extract the game files again, delete `desecratedzones.json.original` from the app's data folder, reopen the page so the app backs up the new file, then set your zones again. |
