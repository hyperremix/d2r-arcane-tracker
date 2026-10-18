# Inventory Browser

The **Inventory browser** (title bar → **Inventory**, route `/inventory-browser`) shows what is in your save files and lets you move items around without starting the game. For the grail itself, see the [Holy Grail Guide](HOLY_GRAIL_GUIDE.md).

## What you see

- One board per character (equipped items, inventory, belt, mercenary, corpse) and per shared stash, built from the last scan of your `.d2s` and `.d2i` files.
- Shared stash tabs, plus the **Runes**, **Gems** and **Materials** tabs of the modern (v105+) shared stash. Stacks show their count.
- **Characters & stashes** comes first: it lists each character (tracked characters show their class icon, class and level, other character saves a generic icon and the file kind) and each shared stash with its item count. Click one, or drag an item over it, to open it in a separate window, and drag items between that window and the main view. Hover or select an item in that window to see its details. Selecting a vaulted item in the main view shows its details there.
- **Filter items** sits at the top of that list: a search box (item names, codes or quality), filters for character, location and item type, and the [item property filters](#item-property-filters). They narrow the list to the characters and stashes that hold matching items (the count then shows the matches) and the **Vaulted items** below to matching items. While a filter is on, **Vaulted items** is shown with a note that it is filtered, even if no vaulted item matches, and **Matching items** lists the matching items of your characters and stashes with where each one is, whether it is ethereal and its [roll quality](#roll-quality). It shows the first 100 matches and says how many there are in total; click one to open the window of the character or stash that holds it. The windows you open always show every item.
- A short notice at the top of the page and of each character window reminds you to close the game, because changes are written straight to your save files. **Details** shows the full explanation. The notice can't be dismissed.

## Item property filters

Below the search and the character, location and type filters, **Item properties** narrows the items further. All filters you set must match.

- **Base item or type**: text the base item name (for example "thresher" finds Thresher and Giant Thresher), its item code or its item category (for example "polearm" or "charm") must contain.
- **Sockets** and **Socket count**: an item with exactly, or at least, the chosen number of sockets (filled or open). **Any** turns the filter off.
- **Ethereal**: ethereal items only, or items that aren't ethereal.
- **Roll quality at least (%)**: unique and set items whose overall [roll quality](#roll-quality) is at least this value. Items without a roll quality don't match.
- **Stats**: **Add stat** adds a row with a stat (for example life, faster hit recovery, all resistances, all skills, enhanced damage or enhanced defense) and an **At least** value; the remove button next to it takes the row away. An item matches when it has every listed stat at or above its value, or just has the stat when the value is empty. Stats count what the tooltip shows: the item's own stats, its runeword and what is socketed in it. **All resistances** counts the lowest of the four resistances, and **Class skills** and **Skill tree skills** the highest bonus of any class or skill tree.
- **Sort by**: **Best roll first** orders **Matching items** (shown only while a filter is on) and the tiles in **Vaulted items** by roll quality, with items that have none at the end. It doesn't reorder the **Characters & stashes** list. **Default** keeps the usual order.

## Roll quality

Unique and set items whose stats can roll in a range show their roll quality in the item tooltip and on the selected item card of a character or stash window: each variable stat with its range and where the rolled value sits in it (the minimum is 0%, the maximum 100%), and the overall roll quality, the average of those stats. Percentages are rounded down, so only a stat at its maximum shows 100%. When every variable stat is at its maximum, the item shows **Perfect roll**. Fixed stats don't count, and items whose stats are all fixed, such as The Stone of Jordan, have no roll quality.

The ranges come from the game's `uniqueitems.txt` and `setitems.txt` as converted by [d2data](https://github.com/blizzhackers/d2data) (see [Third-party licenses](THIRD_PARTY_LICENSES.md)), so they match the patch that data was taken from. A stat is shown as **Not rated** when its value can't be read from the item or told apart from other stats that add to the same value, or when the value lies outside the range, for example because a patch changed the range since the item dropped. Properties whose minimum and maximum aren't a single value, such as damage ranges (elemental damage included), chance to cast, charges and per-level stats, aren't rated, and neither are ranges of the base item (such as the defense of the base armor) and variable socket counts.

## Character overview

A character's window has two tabs: **Items** (the boards above) and **Overview**. The overview is read from the `.d2s` file when you open the tab and again whenever the app sees the file change. It never writes the file. Shared stash windows have no overview.

- **Character**: class, level, softcore or hardcore (and **Classic** for characters without the expansion), experience, gold in the inventory and in the stash, the base attributes as stored in the save (without item bonuses), unused stat and skill points, and which difficulties are completed, in progress or not reached.
- **Quest rewards**: one row per reward, one column per difficulty. Each cell says **Claimed**, **Not claimed** (highlighted: the quest is done but the reward is still waiting) or **Not earned**. For Akara's reset the states read **Used**, **Available** and **Not earned**. Characters without the expansion have no Larzuk or Anya rows.
- **Missing waypoints**: per difficulty, how many waypoints are active and which are missing, by act. Characters without the expansion have no Act V waypoints.
- **Gear totals**: magic find and gold find, the four resistances in Normal, Nightmare and Hell, and faster cast rate, faster hit recovery, faster block rate and increased attack speed.

### How quest rewards are read

The app reads the quest flags stored in the save. Their meaning comes from the public save format notes ([Trevin's v1.09 file format](https://user.xmission.com/~trevin/DiabloIIv1.09_File_Format.shtml)) and two open source save editors ([D2SSharp](https://github.com/ResurrectedTrader/D2SSharp) and [D2CE](https://github.com/WalterCouto/D2CE)):

| Reward | Claimed | Not claimed |
| --- | --- | --- |
| Den of Evil, Tools of the Trade (Charsi's imbue), Radament's Lair, Lam Esen's Tome, The Fallen Angel, Siege on Harrogath (Larzuk's socket) | The quest's "reward granted" flag is set | Only the "requirements met, reward waiting" flag is set |
| The Golden Bird (Potion of Life) | Quest done and the "holds the Potion of Life" flag is clear | The "holds the Potion of Life" flag is set (the game clears it when you drink the potion), or the reward is waiting |
| Prison of Ice (Scroll of Resistance) | The "read the scroll" flag is set | The scroll flag is clear and the quest is done or its reward is waiting |
| Akara's reset | The "used" flag of the reset slot in the Act V quest data is set (**Used**) | The "used" flag is clear and either the slot's "available" flag is set or the Den of Evil is done (**Available**) |

The Potion of Life (bit 5) and Scroll of Resistance (bit 7) bits follow Trevin's notes and the real version 105 save used in the tests; D2CE's table numbers them differently (6 and 8).

The app's tests check these rules against real saves only for a character that took every reward and a new character. The **Not claimed** states were tested with edited flags, not with real saves of characters that left a reward waiting, so they are assumptions. In particular:

- Radament's skill point comes from reading the Book of Skill. Whether the game marks the reward as granted before you read the book wasn't checked.
- The rule for Larzuk's socket is the general "reward waiting" flag; Trevin's notes list a separate "Larzuk offers to socket an item" flag whose relation to it wasn't checked.
- The Akara reset flag is read as described by D2SSharp and D2CE; it wasn't checked against a save before and after a reset. Showing the row for characters without the expansion is an assumption that the slot works the same way there.

If the quest data can't be found in a save, the overview says so and lists no rewards. Reign of the Warlock saves (version 105) store quests, waypoints and attributes in the same format, and the overview reads them; the tests use real version 105 saves. Quests that Reign of the Warlock might add are not shown.

### How gear totals are counted

- Counted: every equipped item except the inactive weapon set, and the charms in the inventory grid (not in the stash or the cube). An item's stats include its runeword and the runes, gems and jewels socketed into it. "Per character level" stats (for example Enigma's magic find) count value × level / 8, rounded down.
- Resistances add 10 to every resistance for each difficulty in which you read Anya's Scroll of Resistance. This is an assumption: a scroll is assumed to apply in every difficulty column, including the ones before the one where it was read. Nightmare and Hell subtract a penalty, taken from community sources for `difficultylevels.txt` and assumed correct: 40 and 100 for expansion characters, 20 and 50 for characters without the expansion. A value above the cap (75, plus maximum resistance bonuses, at most 95) shows the cap and the uncapped value.
- Not counted: set bonuses (partial and full), auras, skills, shrines and the mercenary. Item requirements aren't checked, so an item counts even if the character can't use it.
- Breakpoints: faster cast rate, faster hit recovery and faster block rate show the breakpoint reached and the next one, from the standard table of the class (Druid and Necromancer in human form, the Druid's hit recovery without one-handed swinging weapons, the Paladin's hit recovery without spears and staves, the Amazon's block without one-handed swinging weapons). Skill-specific tables (Lightning and Chain Lightning, Holy Shield) and shapeshifted forms (werewolf, werebear, vampire) aren't used. Increased attack speed shows only the total, because its breakpoints depend on the weapon and the skill. The tables, Warlock included, are the published rows, which [d2-lab](https://github.com/bengous/d2-lab) checks against the animation data of D2R 3.3.93847; see [Third-Party Licenses](THIRD_PARTY_LICENSES.md). The Warlock's block row in that source ends at 86%, so the overview shows no breakpoint past it.
- The active weapon set is read from the save. The tests cover a save with weapon set I active; weapon set II is only tested with constructed data.

## Changing your items

- **Move**: drag an item to a free spot in the same file or another file. Occupied spots, invalid equipment slots and class restrictions are refused with a message, and nothing is changed. While you drag over the equipment, a slot turns green when the item type fits it (for example a helm, circlet or pelt on the head) and the slot is free, and red otherwise. Class restrictions and two-handed weapon rules are checked when you drop.
- **Split a stack**: pick up part of a stack and place the pieces one by one. The Runes, Gems and Materials tabs themselves are not draggable.
- **Vault**: drop an item on the vault area (or select it in a character window and use **Vault**). The vault area appears at the bottom of the main view while you drag an item from a character or stash window, and goes away when the drag ends or the item is dropped. Dropping or vaulting an item removes it from the save file and keeps it in the app's database. A message confirms the move; for items that came from an inventory or stash spot it has an **Undo** button that puts the item back there (refused with a message if the spot is taken now or the entry changed since). **Undo** takes back only what that vault added, even if more units joined the entry afterwards. A stack that merges into an entry already in the vault has no **Undo**, because that entry no longer is the stack you vaulted.
- **Unvault**: drag a vaulted item onto a free spot in a character or stash window to put it back into that save file. If you select a vaulted item that came from an inventory or stash spot, **Put back where it was** returns it to that spot (refused with a message if the spot is taken now). **Put back where it was** is offered when the vault entry's count equals the count of the stack as it was vaulted and it has a restorable inventory or stash position. Other items (for example from an equipment slot, the belt or the mercenary) and entries whose count differs (other stacks merged in, or part of it withdrawn) can only be dragged back. Vault entries that never came from a save file have a plain **Unvault** button.

Vaulting and unvaulting are the only ways the app keeps an item outside a save file. The **Bookmark** action in the grail item dialog is different: see [Bookmarks](HOLY_GRAIL_GUIDE.md#bookmarks).

## Safety

- Before every write, the app copies the save file to `save-file-backups` in its data folder and keeps the 20 newest copies per file. If the backup fails, the file is not modified. You can restore these copies, and the snapshots the app takes whenever a save file changes, in **Settings → Data → Save file snapshots** (see [Save file snapshots](HOLY_GRAIL_GUIDE.md#save-file-snapshots)).
- Moving, vaulting and unvaulting edit your save files directly. Close **Diablo II: Resurrected** before you change items here. On Windows and Linux, writes are refused while the game is running, because it would overwrite the change. On Linux the app looks for `D2R.exe` running under Wine or Proton. macOS can't check this, so close the game yourself before editing.
- The app only edits files inside your configured save folder, and refuses a change if the file changed since the last scan (refresh and try again).
- Bookmarks never appear here and can't be unvaulted, since they hold no item.
- Character saves in the Reign of the Warlock format (version 105), which includes every Warlock, can be changed like older saves. Besides the items you change, only the file size and checksum stored in it are updated; everything else stays as it was. If a save holds data the app can't write back unchanged, a move, split, vault or unvault that involves it is refused before any file is written.
