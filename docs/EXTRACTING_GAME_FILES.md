# Extracting Game Files

D2R keeps its data in CASC archives that other programs can't read directly. Three features need the data extracted to plain files:

- **Item icons**: read from `Data/hd/global/ui/items`. See [item icons](HOLY_GRAIL_GUIDE.md#item-icons).
- **Terror zone configuration**: edits `Data/hd/global/excel/desecratedzones.json`. See the [Terror Zone guide](TERROR_ZONE_CONFIGURATION.md).
- **Farming advisor**: reads the drop tables in `Data/global/excel`. See the [Farming Advisor guide](FARMING_ADVISOR.md).

The rest of the app works without this step.

## Steps

1. Download [Ladik's CASC Viewer](https://www.hiveworkshop.com/threads/ladiks-casc-viewer.331540/) and open the x64 version.
2. Click **Open Storage** and select your D2R folder, for example `C:\Program Files (x86)\Diablo II Resurrected`.
3. In the left panel, click **data**, then **data** again, then **Extract**.
4. Wait for it to finish. It extracts about 40 GB (`global`, `hd`, `local`) into a `work` folder next to `CascView.exe`.
5. Move the three folders into the top-level `Data` folder of your D2R install, for example `C:\Program Files (x86)\Diablo II Resurrected\Data`. There is another `data` folder inside it. Don't use that one.
6. In the app, set **Settings → D2R installation** to your D2R folder: type the path and press Enter or click away, or click **Browse**. The field only shows a path you saved; while it's empty, a notice says no installation path is saved. If the app finds D2R at the default location, the notice shows that folder with a **Use this folder** button instead of filling it in.

Extraction doesn't modify the game. Repeat it after a patch if you need new item icons, the patch changed terror zones, or you use the farming advisor (its drop rates come from the extracted tables).

### On Linux and Steam Deck

These steps haven't been tested on Linux yet:

- CASC Viewer is a Windows program. Run `CascView.exe` with Wine, for example `wine CascView.exe`. In its folder dialog, drive `Z:` is your Linux root folder.
- The D2R folder is `~/.local/share/Steam/steamapps/common/Diablo II Resurrected` for the Steam release. For a Battle.net install it's `drive_c/Program Files (x86)/Diablo II Resurrected` inside the game's Wine or Proton prefix. The app suggests the folder in **Settings → D2R installation** if it finds one of these.
- Folder names are case-sensitive on Linux. Move the extracted folders into the top-level `Data` folder, with a capital D.

## Making D2R use the extracted files

Item icons and the farming advisor only need the files on disk. Terror zone changes also require D2R to load the extracted files instead of the archives:

1. Create a shortcut to `D2R.exe`.
2. In **Properties → Target**, add `-direct -txt` after the path, for example `"C:\Program Files (x86)\Diablo II Resurrected\D2R.exe" -direct -txt`.
3. Always start D2R with this shortcut.

Without these flags D2R ignores the extracted files. [This Reddit post](https://www.reddit.com/r/Diablo/comments/qey05y/d2r_single_player_tips_to_improve_your_load_times/) has more background on `-direct -txt`.
