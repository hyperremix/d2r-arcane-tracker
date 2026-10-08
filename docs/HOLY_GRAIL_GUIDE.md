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

1. **Save folder**: usually `%USERPROFILE%\Saved Games\Diablo II Resurrected`, the folder containing your `.d2s` files.
2. **D2R installation folder**: only needed for [item icons](#item-icons) and [terror zones](TERROR_ZONE_CONFIGURATION.md).
3. **Game mode, game version and grail options**: see [Choosing what to track](#choosing-what-to-track).
4. **Notifications, widget and theme**.

All of these can be changed later in **Settings**.

> **Warning:** changing the monitored save folder deletes all characters and progress in the app. Back up first (**Settings → Database → Backup**).

## Choosing what to track

### Game mode (Settings → Game Mode)

| Mode | Effect |
| --- | --- |
| Both Softcore & Hardcore | Items from all characters count |
| Softcore Only | Only softcore characters count |
| Hardcore Only | Only hardcore characters count |
| Manual Entry | Save file monitoring is off and you mark items yourself |

Switching modes changes which finds count toward progress. No data is deleted.

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
- Shared stash finds are attributed to the shared stash, not a character.

### Manual entry

In **Manual Entry** mode, or for finds the app can't see (another PC, older finds), open an item and use **Mark as Found**. **Mark as Not Found** undoes it.

## Browsing your grail

The main screen lists every grail item with its found status. The search and filter bar lets you:

- Search by item name, base item ("Shako", "Diadem"), set name ("Tal Rasha") or, for runewords, rune ("Ber"). Every word you type must match, so "tal lidless" narrows the results further. Turn on fuzzy search (the wand icon) to also find items when you abbreviate words ("hrlqn") or make a small typo ("windfroce").
- Filter by status (all, found, missing) and by type with the colored Unique, Set, Rune and Runeword toggles. Rune and runeword toggles only appear when you track them.
- Open **Filters** to narrow by category (weapons, armor, jewelry, charms) and sub-category, such as helms, body armor or class-specific items, grouped by category.
- Group by category, type or ethereal status, and switch between grid and list views.
- Sort by name, category, type or found date. Items with the same value, such as all missing items when sorting by found date, are listed alphabetically.

The count under the bar shows how many items match your filters out of all tracked items.

Keyboard shortcuts:

| Key | Action |
| --- | --- |
| `/` or Ctrl+F (Cmd+F on macOS) | Focus the search field |
| Esc (in the search field) | Clear the search; press again to leave the field |

Click an item to see its details, which characters found it and when, and links to [diablo2.io](https://diablo2.io/) or [d2runewizard](https://d2runewizard.com/).

### Item icons

To show the game's own item icons:

1. [Extract the game files](EXTRACTING_GAME_FILES.md).
2. Go to **Settings → Item Icon Management**, click **Convert Sprite Files to PNG**, and wait for it to finish.
3. Turn on **Show Item Icons**.

Conversion only reads game files and is safe to run again. The PNGs are stored in the app's data folder.

## Other features

### Statistics

The **Statistics** page shows overall and per-category progress, recent finds, find streaks, a comparison between characters, and run analytics from the [Run Tracker](RUN_TRACKER.md).

### Runeword Calculator

The **Runeword Calculator** reads the runes in your save files and shows all 93 runewords:

- Search by name, or select runes in the sidebar to filter runewords that use them. The sidebar also shows how many of each rune you have.
- Turn **Show Partial** off to see only runewords you can make right now.
- Each card shows which runes you have and which are missing, including when a runeword needs the same rune more than once.

The calculator works whether or not you track runewords in your grail.

### Terror zones

You can limit the terror zone rotation to zones you choose. See the [Terror Zone Configuration guide](TERROR_ZONE_CONFIGURATION.md).

### Notifications

**Settings → Notification Settings**:

- **Sound Notifications**, with a volume control.
- **In-App Notifications**: cards inside the app. Recent finds are also listed under the bell icon.
- **Native Notifications**: OS notifications, which also appear while the app is minimized.

### Widget

**Settings → Widget Settings** enables an always-on-top overlay that you can drag, resize and set to any opacity. It snaps to screen edges. Display modes:

- **Overall**: total progress.
- **Split**: normal and ethereal progress. Requires ethereal tracking.
- **All**: all three gauges. Requires ethereal tracking.
- **Run Only**: the current run counter, and optionally a list of items found in this run.

### Backups

**Settings → Database** creates a backup of the database or restores one. Restoring replaces all current data.
