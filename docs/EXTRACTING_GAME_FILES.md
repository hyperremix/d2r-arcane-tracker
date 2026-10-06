# Extracting Game Files

D2R keeps its data in CASC archives that other programs can't read directly. Two features need the data extracted to plain files:

- **Item icons**: read from `Data/hd/global/ui/items`. See [item icons](HOLY_GRAIL_GUIDE.md#item-icons).
- **Terror Zone Configuration**: edits `Data/hd/global/excel/desecratedzones.json`. See the [Terror Zone guide](TERROR_ZONE_CONFIGURATION.md).

The rest of the app works without this step.

## Steps

1. Download [Ladik's CASC Viewer](https://www.hiveworkshop.com/threads/ladiks-casc-viewer.331540/) and open the x64 version.
2. Click **Open Storage** and select your D2R folder, for example `C:\Program Files (x86)\Diablo II Resurrected`.
3. In the left panel, click **data**, then **data** again, then **Extract**.
4. Wait for it to finish. It extracts about 40 GB (`global`, `hd`, `local`) into a `work` folder next to `CascView.exe`.
5. Move the three folders into the top-level `Data` folder of your D2R install, for example `C:\Program Files (x86)\Diablo II Resurrected\Data`. There is another `data` folder inside it. Don't use that one.
6. In the app, set **Settings → D2R Installation** to your D2R folder.

Extraction doesn't modify the game. Repeat it after a patch if you need new item icons or the patch changed terror zones.

## Making D2R use the extracted files

Item icons only need the files on disk. Terror zone changes also require D2R to load the extracted files instead of the archives:

1. Create a shortcut to `D2R.exe`.
2. In **Properties → Target**, add `-direct -txt` after the path, for example `"C:\Program Files (x86)\Diablo II Resurrected\D2R.exe" -direct -txt`.
3. Always start D2R with this shortcut.

Without these flags D2R ignores the extracted files. [This Reddit post](https://www.reddit.com/r/Diablo/comments/qey05y/d2r_single_player_tips_to_improve_your_load_times/) has more background on `-direct -txt`.
