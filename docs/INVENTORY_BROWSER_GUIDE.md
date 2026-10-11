# Inventory Browser

The **Inventory Browser** (title bar → **Inventory**, route `/inventory-browser`) shows what is in your save files and lets you move items around without starting the game. For the grail itself, see the [Holy Grail Guide](HOLY_GRAIL_GUIDE.md).

## What you see

- One board per character (equipped items, inventory, belt, mercenary, corpse) and per shared stash, built from the last scan of your `.d2s` and `.d2i` files.
- Shared stash tabs, plus the **Runes**, **Gems** and **Materials** tabs of the modern (v105+) shared stash. Stacks show their count.
- **Characters & Stashes** comes first: it lists each character (with its class icon, class and level) and each shared stash with its item count. Click one, or drag an item over it, to open it in a separate window, and drag items between that window and the main view. Hover or select an item in that window to see its details. Selecting a vaulted item in the main view shows its details there.
- **Filter items** sits at the top of that list: a search box (item names, codes or quality) and filters for character, location and item type. They narrow the list to the characters and stashes that hold matching items (the count then shows the matches) and the **Vaulted Items** below to matching items. If no vaulted item matches while a filter is on, **Vaulted Items** stays visible and says so. The windows you open always show every item.
- A one-line notice at the top of the page and of each character window reminds you to close the game, because changes are written straight to your save files. **Details** shows the full explanation. The notice can't be dismissed.

## Changing your items

- **Move**: drag an item to a free spot in the same file or another file. Occupied spots, invalid equipment slots and class restrictions are refused with a message, and nothing is changed. While you drag over the equipment, a slot turns green when the item type fits it (for example a helm, circlet or pelt on the head) and the slot is free, and red otherwise. Class restrictions and two-handed weapon rules are checked when you drop.
- **Split a stack**: pick up part of a stack and place the pieces one by one. The Runes, Gems and Materials tabs themselves are not draggable.
- **Vault**: drop an item on the vault area (or select it in a character window and use **Vault**). The vault area appears at the bottom of the main view while you drag an item from a character or stash window, and goes away when the drag ends, leaves the window or the item is dropped. Dropping or vaulting an item removes it from the save file and keeps it in the app's database. A message confirms the move; for items that came from an inventory or stash spot it has an **Undo** button that puts the item back there (refused with a message if the spot is taken now or the entry changed since). **Undo** takes back only what that vault added, even if more units joined the entry afterwards. A stack that merges into an entry already in the vault has no **Undo**, because that entry no longer is the stack you vaulted.
- **Unvault**: drag a vaulted item onto a free spot in a character or stash window to put it back into that save file. If you select a vaulted item that came from an inventory or stash spot, **Put back where it was** returns it to that spot (refused with a message if the spot is taken now). **Put back where it was** is offered when the vault entry's count equals the count of the stack as it was vaulted and it has a restorable inventory or stash position. Other items (for example from an equipment slot, the belt or the mercenary) and entries whose count differs (other stacks merged in, or part of it withdrawn) can only be dragged back. Vault entries that never came from a save file have a plain **Unvault** button.

Vaulting and unvaulting are the only ways the app keeps an item outside a save file. The **Bookmark** action in the grail item dialog is different: see [Bookmarks](HOLY_GRAIL_GUIDE.md#bookmarks).

## Safety

- Before every write, the app copies the save file to `save-file-backups` in its data folder and keeps the 20 newest copies per file. If the backup fails, the file is not modified.
- Moving, vaulting and unvaulting edit your save files directly. Close **Diablo II: Resurrected** before you change items here. On Windows, writes are refused while the game is running, because it would overwrite the change. Other platforms can't check this, so close the game yourself before editing.
- The app only edits files inside your configured save folder, and refuses a change if the file changed since the last scan (refresh and try again).
- Bookmarks never appear here and can't be unvaulted, since they hold no item.
