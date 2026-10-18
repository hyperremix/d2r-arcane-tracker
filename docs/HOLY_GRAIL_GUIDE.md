# Holy Grail Guide

What the Holy Grail challenge is, and how to track it with D2R Arcane Tracker. For installation, see the [README](../README.md#install).

- [The challenge](#the-challenge)
- [Setup](#setup)
- [Choosing what to track](#choosing-what-to-track)
- [How item detection works](#how-item-detection-works)
- [Browsing your grail](#browsing-your-grail)
- [Other features](#other-features)

## The challenge

The Holy Grail is a long-term goal: find every unique and set item in the game yourself, with no trading and no duplicated items. Many players extend it to ethereal versions, runes or runewords.

The tracker includes:

| Category | Count | Notes |
| --- | --- | --- |
| Unique items | 415 | Weapons, armor, jewelry, charms, Colossal Ancient jewels and class-specific items such as Warlock grimoires |
| Set items | 135 | Grouped by set |
| Runes | 33 | El (#1) to Zod (#33), optional |
| Runewords | 99 | Optional. Runewords are made, not found |

Reign of the Warlock renamed the Hustle runeword to Mania in weapons and Hysteria in body armor. The tracker lists both. A Hustle find from an earlier version becomes a find of each runeword that the same character's Hustle items in the vault were made in: Mania for weapons and Hysteria for body armor, so a character with both gets both. If the character has no Hustle items in the vault, the tracker cannot tell which one it was and the find becomes Mania.

Common variants are the classic grail (normal uniques and sets), the ethereal grail (adds every item that can be ethereal), and the full grail (adds runes and runewords). Hardcore grails are tracked separately by many players.

## Setup

The setup wizard opens on first launch. You can run it again from **Settings → General → Setup wizard**. It asks for:

1. **Save folder** (required): usually `%USERPROFILE%\Saved Games\Diablo II Resurrected`, the folder containing your `.d2s` files. On Linux and Steam Deck it's inside the game's Proton or Wine prefix, and the app fills in the first one it finds (see [Install](../README.md#linux-and-steam-deck)). Browse to it, or type or paste the path and click **Use this folder**. The wizard checks the folder and only continues once it finds at least one character file. If you picked the parent folder (such as `Saved Games`) or a folder inside the save folder, it offers the right folder with **Use suggested folder**. If you haven't created a character yet, tick **Continue anyway without character files**.
2. **What to track**: game mode, grail contents and game version. The defaults suit most players. See [Choosing what to track](#choosing-what-to-track).
3. **D2R installation folder** (optional): only needed for [item icons](#item-icons) and [terror zones](TERROR_ZONE_CONFIGURATION.md). The wizard only suggests the Battle.net default, `C:\Program Files (x86)\Diablo II Resurrected`, if that folder exists.
4. **Preferences** (optional): theme, notifications and widget.

Click **Skip optional steps** on the "What to track" step to go straight to the summary, which shows the save folder and how many character files were found. You can change all of these settings later in **Settings**. If you click **Skip setup** while the app isn't monitoring a save folder (and the game mode isn't Manual entry), the confirmation warns that automatic tracking won't work until you choose one in **Settings**.

Settings are saved as soon as you change them, so **Finish** only needs to mark the wizard as completed. If a change can't be saved, the app undoes it and shows an error with a **Retry** button. Inside the setup wizard, a setting that can't be saved is undone and an error appears in the step instead; if the wizard can't save when you click **Finish** or **Skip setup**, it stays open and shows an error so you can try again.

> **Warning:** switching the monitored save folder to a different folder deletes all characters and progress in the app. Back up first (**Settings → Database → Backup**).

In **Settings → Save file monitoring**, **Change directory** opens a folder picker and **Restore default** uses the platform default folder. While monitoring is on, the status badge reads **Active (N files)**, counting the character save files in the folder. Below it, one line sums them up (for example *15 characters detected, last saved Oct 17, 2026*): the date is the most recent save of any character, so you can check that the folder holds the saves you're playing. **Open inventory browser** takes you to the [Inventory browser](INVENTORY_BROWSER_GUIDE.md), which lists the characters themselves. If the chosen folder is the one already monitored, nothing changes and nothing is deleted. If it's a different folder and the app has characters or progress, a confirmation shows the current and new folder and how many characters and recorded grail finds will be deleted. **Back up first** is the highlighted action and receives focus when the dialog opens; once a backup has been made it becomes a secondary button; the destructive button says what it does (**Delete progress and switch folder**, or **Delete progress and use default folder**). Picking a different folder in the setup wizard shows the same confirmation.

[Run Tracker](RUN_TRACKER.md) sessions and runs are kept when you switch folders, but they are no longer linked to a character. Items in those runs that were found through the deleted progress are removed with it. If the app can't delete the old data or save the new folder, it keeps the old folder and all data.

## Choosing what to track

### Game mode (Settings → Tracking → Game mode)

| Mode | Effect |
| --- | --- |
| Both softcore & hardcore | Items from all characters count |
| Softcore only | Only softcore characters count |
| Hardcore only | Only hardcore characters count |
| Manual entry | Save files are not rescanned and you mark items yourself |

Switching modes changes which finds count toward progress. No data is deleted. Manual entry stays in effect after a restart or a save folder change; switching from Manual entry back to another mode resumes save file monitoring.

### Game version (Settings → Tracking → Game version)

Choose **Diablo II: Resurrected** unless you're tracking the original Diablo II: Lord of Destruction. The setting affects save file parsing.

### Grail contents (Settings → Tracking → Holy Grail configuration)

| Option | Default | Effect |
| --- | --- | --- |
| Include normal items | On | Normal (non-ethereal) uniques and sets |
| Include ethereal items | Off | Ethereal versions of items that can be ethereal, tracked separately |
| Include runes | Off | All 33 runes, each found once |
| Include runewords | Off | Runewords you have made |

Progress percentages update as soon as you change an option.

## How item detection works

1. The app watches the save folder for changes to character files (`.d2s`) and the shared stash (`.d2i`).
2. When a file changes, it parses the file and reads every item: inventory, equipment, personal and shared stash, and Horadric Cube.
3. Items that match grail entries you haven't found yet are recorded with the character, the time, and the current [run](RUN_TRACKER.md) if one is active.
4. You get a [notification](#notifications) for new finds.

Things to know:

- **D2R only writes save files when you leave a game**, so new finds show up after you exit to the menu, not when you pick them up.
- **You don't need mule characters.** Once an item is recorded you can sell, drop or use it.
- Character saves in the Reign of the Warlock format (version 105), which includes every Warlock, are read like older saves, and their finds are recorded with the character, including the items your hireling wears.
- Shared stash finds are attributed to the shared stash, not a character. Shared stashes in the newer v105+ `.d2i` format are listed as **Modern Shared Stash Softcore** or **Modern Shared Stash Hardcore**, the older format as **Shared Stash Softcore** or **Shared Stash Hardcore**. Like the game, the app tells softcore and hardcore stashes apart by file name (for example `SharedStashHardCoreV2.d2i`). Backup copies of a stash, such as `SharedStashSoftCoreV2_Backup.d2i`, are not scanned, so their items don't count twice.

### The in-game Chronicle

Reign of the Warlock records the set items, uniques and runewords you find in the **Chronicle**, which the game keeps in the v105+ shared stash. The app reads it whenever it scans the stash, so a find counts even if the item is in no save file anymore, for example because you sold it before the app saw it. A Chronicle entry only adds a find when the item isn't recorded yet, in either its normal or ethereal version. A find that only the Chronicle knows:

- is attributed to the shared stash, with the date and time the Chronicle recorded it;
- counts as a normal (non-ethereal) find, because the Chronicle doesn't record whether the item was ethereal;
- shows no notification. A new find still notifies through the item itself, which is in your character's save file.

An item that is already recorded keeps its found date. The app reads the Chronicle of each shared stash file that your [game mode](#game-mode-settings--tracking--game-mode) includes. The app only reads the Chronicle and never changes it. The Chronicle of online characters is stored on Battle.net, not in your save folder, so the app can't read it.

### Manual entry

In **Manual entry** mode, or for finds the app can't see (another PC, older finds), open an item, select **Mark as found** (**Add another find** once every version you track is found), and choose the character, the found date and, if you track both versions of the item, the version. To undo a manual find, use the remove button in its row of the item's character progress table. Finds detected from save files can't be removed there. To add many finds at once, [import](#import-and-export) them from a file.

## Browsing your grail

The main screen lists every grail item with its found status. At the top, the progress ledger shows your overall completion and how many item versions you found, next to one segment per item type (Unique, Set, and Rune and Runeword when you track them). The segments are equally wide, so small types such as runes have room for their count, and each fills up in the type's color as you find items; it also shows the type's count, such as "Unique 142/385". The counts include the same item versions as the overall progress (with ethereal tracking on, ethereal versions count too) and don't change when you filter. With ethereal tracking on, your normal and ethereal progress are listed below the segments. Select a segment (or focus it and press Enter or Space) to show only items of that type; select more segments to combine types, and select a highlighted segment again to remove it from the filter.

The search and filter bar lets you:

- Search by item name, base item ("Shako", "Diadem"), set name ("Tal Rasha") or, for runewords, rune ("Ber"). Every word you type must match, so "tal lidless" narrows the results further. Turn on **Fuzzy search** in **Filters** to also find items when you abbreviate words ("hrlqn") or make a small typo ("windfroce").
- Filter by status (all, found, missing).
- Open **Filters** to narrow by category (weapons, armor, jewelry, charms) and sub-category, such as helms, body armor or class-specific items, grouped by category.
- Open **View** to switch between grid and list views, sort and group. The button's icon shows the current view.
  - Sort by name, category, type or found date, ascending or descending. The default is found date, descending. Sorting by found date lists the items you're still missing first, in both directions, followed by your finds by date (newest first when descending, oldest first when ascending); with grouping on, this applies inside each group. Types sort in the game's quality order (unique, set, rune, runeword) and categories in the order weapons, armor, jewelry, charms, runes, runewords. Items with the same value, such as all missing items when sorting by found date, are listed alphabetically. The search, filters and sorting aren't saved: every time you open the app, the grail starts with all items, sorted by found date.
  - Group by category (the default when you open the app), type or ethereal status (available when ethereal tracking is on), or turn grouping off. Groups always appear in a fixed order, whatever the sort field or direction (the sort only orders the items inside each group): category groups as weapons, armor, jewelry, charms, runes, runewords; type groups as unique, set, rune, runeword; ethereal groups from both versions found down to not tracked. Ethereal groups read, for example, "Both versions found", "Missing both versions" or "No ethereal version: found". Each group has a header with its found and total count (for example "Armor 12/40") and a small progress bar.
- In the grid, items are shown as compact tiles of equal height in rows that read left to right and wrap to the next row, with as many columns as fit the window width.

Below the bar, removable chips show the search text, fuzzy search and the categories and sub-categories picked in **Filters**; the status control and the ledger segments already show their own state. **Clear all** resets the search, filters, fuzzy search and sorting, and clears any selected ledger segments (type filters). The count next to them shows how many items match your filters out of all tracked items.

Keyboard shortcuts:

| Key | Action |
| --- | --- |
| `/` or Ctrl+F (Cmd+F on macOS) | Focus the search field |
| Esc (in the search field) | Clear the search; press again to leave the field |

The grail works like a collection wall. Found items light up: as in the game, the name is colored by quality (gold for uniques, green for sets, orange for runes and purple for runewords), in a heavier weight, with a thin frame in a softer shade of the same color. Missing items stay dim and neutral, with a gray name, a plain frame and grayed-out artwork. Under the name, one line shows the set of set items and the base item of other items (for example "Shako"); long text is cut off. Hover over the name to see the full name, base item, set, category and who found the item and when. When the [farming advisor](FARMING_ADVISOR.md) can read your game files, the tooltip of a missing unique, set item or rune also names where to farm it, for example "Farm at Mephisto in Durance of Hate Level 3 (Hell, monster level 87)". This is the place the farming advisor lists first among those that drop the item: the highest difficulty, then the place that drops the most of your missing items, then the highest monster level. Terror zones are left out, since they change. For drop rates per monster, open the item and see **Where to farm**. Without a D2R folder in **Settings → D2R installation** the tooltip doesn't show this. The list view shows the base item, the set and the characters who found the item in each row.

When you track ethereal items, cards for items that can be ethereal show one pill per tracked version, **Normal** and **Ethereal** (or **Ethereal only**); grid tiles shorten **Ethereal** to **Eth**. A found version has a solid pill with a check mark; a missing version has a dashed pill with an empty circle, so you can see which version you still need. Items found in the last 7 days while the tracker was running have a **New** badge. Screen readers announce the same information: the item name, whether it is found (or the status of each version, such as "Normal found, Ethereal missing") and whether it was found recently.

Click an item to open its details, laid out like the in-game item tooltip. At the top are the rune images of a runeword (or the item icon, when item icons are on), the name in its quality color, the base item (for example "Shako") and whether you found it. An item that can be normal or ethereal shows a status for each version you track; any other item shows a single status. A find of a version you don't track, such as an ethereal find while ethereal tracking is off, reads **Found (not tracked)**. On this page it doesn't count as found: the card stays missing, the item shows under the **Missing** filter, and it sorts with the missing items by found date. Below that are the item's type, category, treasure class and ethereal type, its set or required runes where they apply, and a link to [diablo2.io](https://diablo2.io/) or [d2runewizard](https://d2runewizard.com/). Uniques, set items and runes then show **Where to farm**: the monsters that drop the item and how often (see the [Farming Advisor guide](FARMING_ADVISOR.md#where-to-farm-item-details)). The character progress table lists the characters who found the item, most recent find first, with the found date, the version (for items that can be normal or ethereal) and whether the find was detected automatically or added manually. If nobody found the item yet, a single line says so.

Below that, **Your copies** lists the copies of the item that are in your characters, shared stashes and vault right now, best roll first. It reads the latest save file scan and reloads when a save file changes; items socketed into other items are left out. Each row shows where the copy is (the character or stash and its location, or **Vaulted**), whether it is ethereal and its [roll quality](INVENTORY_BROWSER_GUIDE.md#roll-quality). With more than one copy, the copy with the highest roll quality is marked **Best roll** (several copies when they are tied).

### Bookmarks

The item dialog also has a **Bookmark** button. Once the item is bookmarked, the button reads **Remove bookmark** and its icon is filled. A bookmark only records the item as one you care about in the app's own database. It never reads or changes a save file, and it doesn't count as finding the item. Bookmarks are not shown in the [Inventory Browser](INVENTORY_BROWSER_GUIDE.md).

### Item icons

To show the game's own item icons:

1. [Extract the game files](EXTRACTING_GAME_FILES.md).
2. Go to **Settings → Item icon management**, click **Convert sprite files to PNG**, and wait for it to finish.
3. Turn on **Show item icons**.

To make the icons on the grail page bigger, pick **Large** or **Extra large** under **Icon size** in the same card. The size applies to the grid and the list view.

Conversion only reads game files and is safe to run again. The PNGs are stored in the app's data folder.

Icons of Reign of the Warlock items, such as the Warlock grimoires and the Colossal Ancient jewels, only exist in the game files of Reign of the Warlock. If you extracted the game files before installing it, [extract them again](EXTRACTING_GAME_FILES.md) and convert again. Conversion skips icons it already converted.

## Other features

### Statistics

The **Statistics** page shows overall and per-category progress, a comparison between characters, and run analytics from the [Run Tracker](RUN_TRACKER.md). Four tiles sum up the grail: **Total progress**, **Last find while tracking** (how long ago the tracker last saw you find a tracked version of an item, and which item; it reads "None yet" while every find came from the startup scan), **Closest set** (the unfinished set with the largest share of its items found) and **Runes missing** (how many runes you still need, and the highest of them). The set and rune tiles are hidden when no set or rune is part of your grail, for example when you track only ethereal items, since sets and runes can't be ethereal. Two charts show your progress over time: **Grail progress over time** counts each tracked item version on the day it was first found, and **Finds per week** shows the finds of each of the last 12 weeks, the latest week ending today. A chart with nothing to show shrinks to a one-line note without a card, its title and the reason side by side (the reason wraps below the title in a narrow window), and the other chart then takes the whole row. Items found when the app scans your save files at startup count as found, but the tracker didn't see them being found, so they don't count as recent finds, towards the weekly finds or as the find shown in the **Last find while tracking** tile. The progress chart treats the startup-scan items on its first day as a baseline: these are the items of the first scan that found items, so a scan that found nothing leaves no trace and a later scan can become the baseline. A dashed line marks them, the value axis starts just below that number instead of at zero, and a note under the chart says how many there were and on which day. Items from startup scans on later days (found while the app was closed) count on the day of that scan. Recent finds are the finds of the last 7 days; they're shown next to each category and character. Recent finds count every find made while the tracker was running, whether or not that version of the item is tracked. Shared stashes are not characters, so they are left out of the character comparison. Hover over a chart, or focus it and use the arrow keys, to see the values of a day or week. The statistics are refreshed when the date changes, so a window left open overnight stays current. The selected tab (**Grail statistics** or **Run statistics**) is kept in the page address, so going back to the page with the browser's back button restores it.

### Inventory Browser

The **Inventory Browser** lists the items in every character and shared stash, and can move items between them or vault them. See the [Inventory Browser guide](INVENTORY_BROWSER_GUIDE.md), including its safety rules (backups, and writes refused while the game is running on Windows and Linux).

### Runeword Calculator

The **Runeword calculator** reads the runes, gems and socketed items in your save files and shows which runewords you can make:

- Choose what to show: **Craftable now** (the default) shows runewords you can make with the runes you have. **Ready now** narrows that to runewords you also own a base for. **With upgrades** shows every runeword you can make with the runes you have or can cube from them. **Missing ≤ 1** also shows runewords that need one more rune, and **All** shows every runeword. If nothing matches the current view, the page offers the next broader view that has results.
- Results are sorted with craftable runewords first, then by the fewest missing runes, then by name.
- Search by name in the toolbar above the results, or select runes in the sidebar to show only runewords that use **all** of the selected runes. **Clear selection** removes them. The sidebar also shows how many of each rune you have; runes you don't have show a muted 0.
- **Refresh runes** rescans your save files after you pick up or use runes in the game. In **Manual entry** mode save files are not rescanned, so the counts stay as they were at the last scan.
- Each card shows how many of its runes you have below the runeword's name (for example, "3/4 runes", green when you have them all) and marks missing runes with a cross, including when a runeword needs the same rune more than once. The card footer shows how many sockets the runeword needs (one per rune) and has a link, labeled with the site it opens (d2runewizard or diablo2.io), to the runeword's page in your browser. The footer fits on one row on normal-width cards.
- **Rune upgrades**: when runes are missing but you can cube them from runes and gems you have, the card is marked **Makeable with upgrades** and lists the Horadric Cube upgrades in order, from the lowest rune up (for example, "Cube 3 Lem + Flawed Emerald → Pul"). The recipes are the game's: 3 runes from El to Ort, 3 runes and a gem from Thul to Lem, and 2 runes and a gem from Pul to Cham. A plan never uses a rune or gem twice, and never cubes away a rune the runeword itself needs. Gems are not upgraded. The calculator counts loose runes and gems in your characters and shared stash, including the Runes and Gems tabs, but not vaulted ones. Each runeword is planned on its own, so two runewords may count on the same runes and gems.
- **Owned bases**: each card says how many items you own that the runeword can be made in. Expand the count to see each one, whether it's ethereal, and where it is (the character or shared stash and the place in it, such as a stash tab, or the vault). A base is a low quality (such as Cracked), normal or superior item of a type the runeword allows, with exactly one socket per rune, all of them empty. Like runes, one base may be listed for several runewords.
- The sidebar stays in place while you scroll through the runewords. In short windows (roughly under 830px tall), the rune list scrolls inside the sidebar instead.

The calculator works whether or not you track runewords in your grail.

### Terror zones

You can limit the terror zone rotation to zones you choose. See the [Terror Zone Configuration guide](TERROR_ZONE_CONFIGURATION.md).

### Farming advisor

The **Farming advisor** shows where your missing uniques, set items and runes can drop, what the current and next terror zone can drop, and, in the item details under **Where to farm**, how many kills a drop takes. It needs the [extracted game files](EXTRACTING_GAME_FILES.md). See the [Farming Advisor guide](FARMING_ADVISOR.md).

### Notifications

**Settings → Notification settings**:

- **Sound notifications**, with a volume control.
- **In-app notifications**: cards inside the app. Recent finds are also listed under the bell icon.
- **Native notifications**: OS notifications, which also appear while the app is minimized.

If a background task fails, for example a save file can't be read or a database write fails, an error message appears in the bottom-left corner. It stays open until you close it, and a repeated failure of the same kind updates that one message with the most recent file name and details instead of adding new ones. Errors you can fix in the settings have an **Open Settings** button. The others have **Copy details**, which copies the technical details for a bug report.

### Widget

**Settings → Widget settings** enables an always-on-top overlay that you can drag, resize and set to any opacity. It snaps to screen edges. Display modes:

- **Overall**: total progress.
- **Split**: normal and ethereal progress. Requires ethereal tracking.
- **All**: all three gauges. Requires ethereal tracking.
- **Run only**: a large timer for the current run with its number and whether it's running, paused or idle, the session's fastest and average run, and optionally a list of items found in this session's runs. Turning the item list on or off switches the widget to the matching default height.
- **Terror zone**: the offline terror zone running now with a countdown to the end of its window, and the next three zones with their start times in your local time. It doesn't need ethereal tracking. The widget reads the schedule again every minute, so a change saved on the terror zone configuration page shows up within a minute. It shows "Retail schedule" when the schedule doesn't come from your own game file. See the [Terror Zone guide](TERROR_ZONE_CONFIGURATION.md#schedule).

The progress gauges show the same numbers as the progress ledger on the Holy Grail page. Only the versions you track count towards the totals: with **Include ethereal items** off there is no ethereal total, and with **Include normal items** off there is no normal total. The normal and ethereal split in the progress ledger is only shown while both versions are tracked.

The widget remembers its size separately for each display mode. **Reset size** restores the default for the current mode.

To see the widget over the game, set D2R's display mode to **Windowed (Fullscreen)**. Always-on-top windows can't appear over exclusive **Fullscreen** mode.

**Lock widget (click-through)** stops the widget from getting in the way while you play. Clicks pass through it to the game, and it can't take focus, be dragged or be resized. In Run only mode the manual item field is hidden while the widget is locked. To move or resize the widget again, turn the lock off in **Settings → Widget settings**.

### Backups

**Settings → Database** creates a backup of the database or restores one. Restoring replaces all current data, including characters, grail progress, run history, settings and vaulted items; the confirmation names the backup file and offers **Back up first**, which receives focus when the dialog opens and is highlighted until a backup has been made. Vaulted items exist only in the database, so any that aren't in the backup are lost. The app checks the backup first and refuses files that aren't intact app databases. If the restore fails, your current data is kept. If a restore fails and the app also cannot put the previous database back, it keeps that database next to the live one as `grail.db.pre-restore` so the data can still be recovered; the next restore renames it to `grail.db.pre-restore.<timestamp>` instead of overwriting it. These copies are full copies of the database and are never deleted automatically, so delete them from the app data folder once you no longer need them.

#### Save file snapshots

Offline saves have no server copy, so **Settings → Data → Save file snapshots** keeps copies of your save files in `save-file-snapshots` in the app data folder. While the app monitors your save folder, every save file it reads (`.d2s`, `.d2i`, `.sss`, `.d2x`) is stored as a snapshot unless its content is identical to the newest snapshot of that file. Snapshots are on by default and the app keeps 50 per file. You can turn them off or change the number (1 to 500) in the same card. Turning snapshots off keeps the existing ones; after you lower the number, the oldest snapshots of a file are deleted the next time that file changes. No snapshots are taken in Manual entry mode, because save files aren't read then. Snapshots start with the first read after you install or update the app, so the first snapshot of a file is the file as it is then, not an earlier state.

Pick a save file to see its copies, newest first, with the time, the type, the size and, for characters, the level. The type is **Snapshot**, or **Before app change** for the copies the app takes right before it edits a file (see the [Inventory Browser safety notes](INVENTORY_BROWSER_GUIDE.md#safety)). Files that are no longer in the save folder, such as a deleted character, are listed too. Only copies of files in the current save folder are listed.

**Restore** opens a confirmation that names the file and the time of the copy. On Windows and Linux, the app refuses to restore while Diablo II: Resurrected is running, because the game would overwrite the file. macOS can't check this, so close the game yourself first. Before the file is replaced, the app copies the current file, which then appears as **Before app change**, so you can undo a restore. The app only writes inside the configured save folder and rescans your save files afterwards. Grail finds the app has already recorded stay recorded. Vaulted items live only in the app's database: vaulting removes the item from the save and unvaulting writes it back. A copy made before a vault or unvault therefore leaves the save and the vault inconsistent when you restore it, so check the vault afterwards.

Restoring a hardcore character's save from before its death brings the character back. Whether you do that is your choice.

### Import and export

**Settings → Data → Grail import and export** saves your grail progress to a file or adds finds from one.

**Export JSON** and **Export CSV** save every recorded find with the item, its version (normal or ethereal), the found date, the character and the source (manual or auto-detected). JSON is the app's own format, made to be imported again; CSV opens in spreadsheets and can be imported too.

**Import from file** reads one of these files (up to 5 MB and 20,000 entries):

- A JSON export of this app.
- A JSON export of [Nasicus/d2-holy-grail](https://github.com/Nasicus/d2-holy-grail) (`HolyGrail_<name>.json`, `EthGrail_<name>.json` or `RunewordGrail_<name>.json`). The app reads these as that project's source code writes them (`ExportListItem.tsx`, `IItem.ts` and the grail data types, last updated in 2023), which is an assumption for exports made with other versions of it. Items marked as found count, including item counter values above 0. A file with uniques and sets is read as the normal grail, one with only uniques as the ethereal grail, and one that maps runeword names as runewords. A file that wraps these as `grailData`, `ethData` and `runewordData` is read too. These exports have no found dates.
- A CSV file with one item name per row. With a header row, the app reads the `item` (or `name`) column and, if present, `version` (or `ethereal`), `found_date` (or `date`), `item_id`, `type` and `character`. Without a header row, the columns are name, version and found date. A version is `normal` or `ethereal` (`eth`, `yes` and `true` also mean ethereal). Dates are ISO dates (`2024-01-15`) or ISO dates with a time; other formats and dates in the future are ignored.

Names are matched ignoring case, spaces and punctuation, and "Ber Rune" also finds Ber. When the file doesn't name a version, the normal version is used, or the ethereal one for items that only exist ethereal.

The app has no importer for holygrail.link, d2grail.com or diablo2.io, because no export file format of theirs could be confirmed from public sources: holygrail.link's source code ([zeddicus-pl/d2rHolyGrail](https://github.com/zeddicus-pl/d2rHolyGrail)) writes no grail export file, and d2grail.com and diablo2.io don't document one. A CSV list of item names works for finds from any tracker.

Before anything is saved, a preview names the file and shows how many finds will be added, how many item versions are already found, how many existing finds get an earlier date, and the entries that couldn't be matched to a grail item (or to a version the item doesn't have). When you confirm:

- An item version that already has a find is never added again. If the file has an earlier date for it, the earliest existing find of that version gets the file's date, which replaces its date; this can't be undone from the app.
- If the file lists an item version more than once, the earliest date counts.
- New finds are saved as manual finds, as with **Mark as found**, so you can remove them in the item's character progress table. They belong to the character the file names if that character is in the app, otherwise to the character you choose in the preview. Importing new finds therefore needs at least one character in the app.
- Finds without a date get the time of the import.

### Error screen

If a page crashes, the app shows a **Something went wrong** screen instead of going blank. The title bar stays usable, so you can switch to another page. From the error screen:

- **Try to recover** loads the page again.
- **Reload application** reloads the app window.
- **Copy error details** copies the app version, error message, stack trace and (when available) component stack to the clipboard.
- **Report issue** opens the GitHub issue tracker in your browser. If it can't be opened, a message appears under the buttons; open the [issues](https://github.com/hyperremix/d2r-arcane-tracker/issues) page yourself instead.

If the app layout itself fails, the same screen fills the whole window without the title bar, so use **Reload application** to recover.

If the error keeps happening, paste the copied details into a new issue.
