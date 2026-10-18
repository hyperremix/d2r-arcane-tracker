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

## Changing your items

- **Move**: drag an item to a free spot in the same file or another file. Occupied spots, invalid equipment slots and class restrictions are refused with a message, and nothing is changed. While you drag over the equipment, a slot turns green when the item type fits it (for example a helm, circlet or pelt on the head) and the slot is free, and red otherwise. Class restrictions and two-handed weapon rules are checked when you drop.
- **Split a stack**: pick up part of a stack and place the pieces one by one. The Runes, Gems and Materials tabs themselves are not draggable.
- **Vault**: drop an item on the vault area (or select it in a character window and use **Vault**). The vault area appears at the bottom of the main view while you drag an item from a character or stash window, and goes away when the drag ends or the item is dropped. Dropping or vaulting an item removes it from the save file and keeps it in the app's database. A message confirms the move; for items that came from an inventory or stash spot it has an **Undo** button that puts the item back there (refused with a message if the spot is taken now or the entry changed since). **Undo** takes back only what that vault added, even if more units joined the entry afterwards. A stack that merges into an entry already in the vault has no **Undo**, because that entry no longer is the stack you vaulted.
- **Unvault**: drag a vaulted item onto a free spot in a character or stash window to put it back into that save file. If you select a vaulted item that came from an inventory or stash spot, **Put back where it was** returns it to that spot (refused with a message if the spot is taken now). **Put back where it was** is offered when the vault entry's count equals the count of the stack as it was vaulted and it has a restorable inventory or stash position. Other items (for example from an equipment slot, the belt or the mercenary) and entries whose count differs (other stacks merged in, or part of it withdrawn) can only be dragged back. Vault entries that never came from a save file have a plain **Unvault** button.

Vaulting and unvaulting are the only ways the app keeps an item outside a save file. The **Bookmark** action in the grail item dialog is different: see [Bookmarks](HOLY_GRAIL_GUIDE.md#bookmarks).

## Safety

- Before every write, the app copies the save file to `save-file-backups` in its data folder and keeps the 20 newest copies per file. If the backup fails, the file is not modified.
- Moving, vaulting and unvaulting edit your save files directly. Close **Diablo II: Resurrected** before you change items here. On Windows, writes are refused while the game is running, because it would overwrite the change. Other platforms can't check this, so close the game yourself before editing.
- The app only edits files inside your configured save folder, and refuses a change if the file changed since the last scan (refresh and try again).
- Bookmarks never appear here and can't be unvaulted, since they hold no item.
- Character saves in the Reign of the Warlock format (version 105), which includes every Warlock, can be changed like older saves. Besides the items you change, only the file size and checksum stored in it are updated; everything else stays as it was. If a save holds data the app can't write back unchanged, a move, split, vault or unvault that involves it is refused before any file is written.
