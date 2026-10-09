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
| Unique items | 385 | Weapons, armor, jewelry, charms and class-specific items |
| Set items | 127 | Grouped by set |
| Runes | 33 | El (#1) to Zod (#33), optional |
| Runewords | 93 | Optional. Runewords are made, not found |

Common variants are the classic grail (normal uniques and sets), the ethereal grail (adds every item that can be ethereal), and the full grail (adds runes and runewords). Hardcore grails are tracked separately by many players.

## Setup

The setup wizard opens on first launch. You can run it again from **Settings → Setup Wizard**. It asks for:

1. **Save folder** (required): usually `%USERPROFILE%\Saved Games\Diablo II Resurrected`, the folder containing your `.d2s` files. Browse to it, or type or paste the path and click **Use This Folder**. The wizard checks the folder and only continues once it finds at least one character file. If you picked the parent folder (such as `Saved Games`) or a folder inside the save folder, it offers the right folder with **Use Suggested Folder**. If you haven't created a character yet, tick **Continue anyway without character files**.
2. **What to track**: game mode, grail contents and game version. The defaults suit most players. See [Choosing what to track](#choosing-what-to-track).
3. **D2R installation folder** (optional): only needed for [item icons](#item-icons) and [terror zones](TERROR_ZONE_CONFIGURATION.md). The wizard only suggests the Battle.net default, `C:\Program Files (x86)\Diablo II Resurrected`, if that folder exists.
4. **Preferences** (optional): theme, notifications and widget.

Click **Skip Optional Steps** on the "What to track" step to go straight to the summary, which shows the save folder and how many character files were found. You can change all of these settings later in **Settings**.

Settings are saved as soon as you change them. If a change can't be saved, the app undoes it and shows an error with a **Retry** button. Inside the setup wizard, a setting that can't be saved is undone and an error appears in the step instead; if the wizard can't save when you click **Finish** or **Skip Setup**, it stays open and shows an error so you can try again.

> **Warning:** switching the monitored save folder to a different folder deletes all characters and progress in the app. Back up first (**Settings → Database → Backup**).

In **Settings → Save File Monitoring**, **Change Directory** opens a folder picker and **Restore Default** uses the platform default folder. If the chosen folder is the one already monitored, nothing changes and nothing is deleted. If it's a different folder and the app has characters or progress, a confirmation shows the current and new folder and offers **Back up first** before anything is deleted.

[Run Tracker](RUN_TRACKER.md) sessions and runs are kept when you switch folders, but they are no longer linked to a character. Items in those runs that were found through the deleted progress are removed with it. If the app can't delete the old data or save the new folder, it keeps the old folder and all data.

## Choosing what to track

### Game mode (Settings → Game Mode)

| Mode | Effect |
| --- | --- |
| Both Softcore & Hardcore | Items from all characters count |
| Softcore Only | Only softcore characters count |
| Hardcore Only | Only hardcore characters count |
| Manual Entry | Save files are not rescanned and you mark items yourself |

Switching modes changes which finds count toward progress. No data is deleted. Switching from Manual Entry back to another mode resumes save file monitoring.

### Game version (Settings → Game Version)

Choose **Diablo II: Resurrected** unless you're tracking the original Diablo II: Lord of Destruction. The setting affects save file parsing.

### Grail contents (Settings → Holy Grail Configuration)

| Option | Default | Effect |
| --- | --- | --- |
| Include Normal Items | On | Normal (non-ethereal) uniques and sets |
| Include Ethereal Items | Off | Ethereal versions of items that can be ethereal, tracked separately |
| Include Runes | Off | All 33 runes, each found once |
| Include Runewords | Off | Runewords you have made |

Progress percentages update as soon as you change an option.

## How item detection works

1. The app watches the save folder for changes to character files (`.d2s`) and the shared stash (`.d2i`).
2. When a file changes, it parses the file and reads every item: inventory, equipment, personal and shared stash, and Horadric Cube.
3. Items that match grail entries you haven't found yet are recorded with the character, the time, and the current [run](RUN_TRACKER.md) if one is active.
4. You get a [notification](#notifications) for new finds.

Things to know:

- **D2R only writes save files when you leave a game**, so new finds show up after you exit to the menu, not when you pick them up.
- **You don't need mule characters.** Once an item is recorded you can sell, drop or use it.
- Shared stash finds are attributed to the shared stash, not a character. Shared stashes in the newer v105+ `.d2i` format are listed as **Modern Shared Stash Softcore** or **Modern Shared Stash Hardcore**, the older format as **Shared Stash Softcore** or **Shared Stash Hardcore**.

### Manual entry

In **Manual Entry** mode, or for finds the app can't see (another PC, older finds), open an item and use **Mark as Found**. **Mark as Not Found** undoes it.

## Browsing your grail

The main screen lists every grail item with its found status. The search and filter bar lets you:

- Search by item name, base item ("Shako", "Diadem"), set name ("Tal Rasha") or, for runewords, rune ("Ber"). Every word you type must match, so "tal lidless" narrows the results further. Turn on fuzzy search (the wand icon) to also find items when you abbreviate words ("hrlqn") or make a small typo ("windfroce").
- Filter by status (all, found, missing) and by type with the colored Unique, Set, Rune and Runeword toggles. Rune and runeword toggles only appear when you track them.
- Open **Filters** to narrow by category (weapons, armor, jewelry, charms) and sub-category, such as helms, body armor or class-specific items, grouped by category.
- Group by category, type or ethereal status (available when ethereal tracking is on), and switch between grid and list views. In the grid, items are shown in rows that read left to right and wrap to the next row, with as many columns as fit the window width; when grouped, each group has a header with its found count above its rows.
- Sort by name, category, type or found date. Items with the same value, such as all missing items when sorting by found date, are listed alphabetically.

The count under the bar shows how many items match your filters out of all tracked items.

Keyboard shortcuts:

| Key | Action |
| --- | --- |
| `/` or Ctrl+F (Cmd+F on macOS) | Focus the search field |
| Esc (in the search field) | Clear the search; press again to leave the field |

As in the game, an item's name color shows its quality: gold for uniques, green for sets, orange for runes and purple for runewords. Found items have a solid frame in that color. Missing items have a dashed frame and grayed-out artwork.

Click an item to see its details, which characters found it and when, and links to [diablo2.io](https://diablo2.io/) or [d2runewizard](https://d2runewizard.com/).

### Bookmarks

The item dialog also has a **Bookmark** button (**Remove Bookmark** once set) and a **Bookmark Status** badge. A bookmark only records the item as one you care about in the app's own database. It never reads or changes a save file, and it doesn't count as finding the item. Bookmarks are not shown in the [Inventory Browser](INVENTORY_BROWSER_GUIDE.md).

### Item icons

To show the game's own item icons:

1. [Extract the game files](EXTRACTING_GAME_FILES.md).
2. Go to **Settings → Item Icon Management**, click **Convert Sprite Files to PNG**, and wait for it to finish.
3. Turn on **Show Item Icons**.

Conversion only reads game files and is safe to run again. The PNGs are stored in the app's data folder.

## Other features

### Statistics

The **Statistics** page shows overall and per-category progress, recent finds, find streaks, a comparison between characters, and run analytics from the [Run Tracker](RUN_TRACKER.md). The selected tab (**Grail Statistics** or **Run Statistics**) is kept in the page address, so going back to the page with the browser's back button restores it.

### Inventory Browser

The **Inventory Browser** lists the items in every character and shared stash, and can move items between them or vault them. See the [Inventory Browser guide](INVENTORY_BROWSER_GUIDE.md), including its safety rules (backups, and writes refused while the game is running on Windows).

### Runeword Calculator

The **Runeword Calculator** reads the runes in your save files and shows which runewords you can make:

- Choose what to show: **Craftable now** (the default) shows runewords you can make with the runes you have. **Missing ≤ 1** also shows runewords that need one more rune, and **All** shows every runeword. If nothing matches the current view, the page offers the next broader view that has results.
- Results are sorted with craftable runewords first, then by the fewest missing runes, then by name.
- Search by name, or select runes in the sidebar to show only runewords that use **all** of the selected runes. **Clear selection** removes them. The sidebar also shows how many of each rune you have.
- **Refresh runes** rescans your save files after you pick up or use runes in the game. In **Manual Entry** mode save files are not rescanned, so the counts stay as they were at the last scan.
- Each card shows how many of its runes you have (for example, "3/4 runes") and marks missing runes with a cross, including when a runeword needs the same rune more than once.

The calculator works whether or not you track runewords in your grail.

### Terror zones

You can limit the terror zone rotation to zones you choose. See the [Terror Zone Configuration guide](TERROR_ZONE_CONFIGURATION.md).

### Notifications

**Settings → Notification Settings**:

- **Sound Notifications**, with a volume control.
- **In-App Notifications**: cards inside the app. Recent finds are also listed under the bell icon.
- **Native Notifications**: OS notifications, which also appear while the app is minimized.

If a background task fails, for example a save file can't be read or a database write fails, an error message appears in the bottom-left corner. It stays open until you close it, and a repeated failure of the same kind updates that one message with the most recent file name and details instead of adding new ones. Errors you can fix in the settings have an **Open Settings** button. The others have **Copy details**, which copies the technical details for a bug report.

### Widget

**Settings → Widget Settings** enables an always-on-top overlay that you can drag, resize and set to any opacity. It snaps to screen edges. Display modes:

- **Overall**: total progress.
- **Split**: normal and ethereal progress. Requires ethereal tracking.
- **All**: all three gauges. Requires ethereal tracking.
- **Run Only**: the current run counter, and optionally a list of items found in this run. Turning the item list on or off switches the widget to the matching default height.

The widget remembers its size separately for each display mode. **Reset Size** restores the default for the current mode.

To see the widget over the game, set D2R's display mode to **Windowed (Fullscreen)**. Always-on-top windows can't appear over exclusive **Fullscreen** mode.

**Lock Widget (Click-Through)** stops the widget from getting in the way while you play. Clicks pass through it to the game, and it can't take focus, be dragged or be resized. In Run Only mode the manual item field is hidden while the widget is locked. To move or resize the widget again, turn the lock off in **Settings → Widget Settings**.

### Backups

**Settings → Database** creates a backup of the database or restores one. Restoring replaces all current data. The app checks the backup first and refuses files that aren't intact app databases. If the restore fails, your current data is kept. If a restore fails and the app also cannot put the previous database back, it keeps that database next to the live one as `grail.db.pre-restore` so the data can still be recovered; the next restore renames it to `grail.db.pre-restore.<timestamp>` instead of overwriting it. These copies are full copies of the database and are never deleted automatically, so delete them from the app data folder once you no longer need them.

### Error screen

If a page crashes, the app shows a **Something went wrong** screen instead of going blank. The title bar stays usable, so you can switch to another page. From the error screen:

- **Try to Recover** loads the page again.
- **Reload Application** reloads the app window.
- **Copy Error Details** copies the app version, error message, stack trace and (when available) component stack to the clipboard.
- **Report Issue** opens the GitHub issue tracker in your browser. If it can't be opened, a message appears under the buttons; open the [issues](https://github.com/hyperremix/d2r-arcane-tracker/issues) page yourself instead.

If the app layout itself fails, the same screen fills the whole window without the title bar, so use **Reload Application** to recover.

If the error keeps happening, paste the copied details into a new issue.
