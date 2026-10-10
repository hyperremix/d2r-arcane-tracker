# Inventory Browser

The **Inventory Browser** (title bar → **Inventory Browser**, route `/inventory-browser`) shows what is in your save files and lets you move items around without starting the game. For the grail itself, see the [Holy Grail Guide](HOLY_GRAIL_GUIDE.md).

## What you see

- One board per character (equipped items, inventory, belt, mercenary, corpse) and per shared stash, built from the last scan of your `.d2s` and `.d2i` files.
- Shared stash tabs, plus the **Runes**, **Gems** and **Materials** tabs of the modern (v105+) shared stash. Stacks show their count.
- A search box (item names, codes or quality) and filters for character, location and item type.
- Hover or select an item to see its details. **Characters & Stashes** lists each character and shared stash with its item count; click one to open it in a separate window, and drag items between that window and the main view.
- A notice at the top of the page and of each character window reminds you that changes are written straight to your save files.

## Changing your items

- **Move**: drag an item to a free spot in the same file or another file. Occupied spots, invalid equipment slots and class restrictions are refused with a message, and nothing is changed. While you drag over the equipment, a slot turns green when the item type fits it (for example a helm, circlet or pelt on the head) and the slot is free, and red otherwise. Class restrictions and two-handed weapon rules are checked when you drop.
- **Split a stack**: pick up part of a stack and place the pieces one by one. The Runes, Gems and Materials tabs themselves are not draggable.
- **Vault**: drop an item on the vault area (or select it in a character window and use **Vault**) to remove it from the save file and keep it in the app's database. A message confirms the move; for items that came from an inventory or stash spot it has an **Undo** button that puts the item back there (refused with a message if the spot is taken now). A stack that merges into an entry already in the vault has no **Undo**, because that entry no longer is the stack you vaulted.
- **Unvault**: drag a vaulted item onto a free spot in a character or stash window to put it back into that save file. If you select a vaulted item that came from an inventory or stash spot, **Put back where it was** returns it to that spot (refused with a message if the spot is taken now). **Put back where it was** is offered only while the vault entry still is the stack as it was vaulted. Other items (for example from an equipment slot, the belt or the mercenary) and stacks whose count has changed since (other stacks merged in, or part of it withdrawn) can only be dragged back. Vault entries that never came from a save file have a plain **Unvault** button.

Vaulting and unvaulting are the only ways the app keeps an item outside a save file. The **Bookmark** action in the grail item dialog is different: see [Bookmarks](HOLY_GRAIL_GUIDE.md#bookmarks).

## Safety

- Before every write, the app copies the save file to `save-file-backups` in its data folder and keeps the 20 newest copies per file. If the backup fails, the file is not modified.
- Moving, vaulting and unvaulting edit your save files directly. Close **Diablo II: Resurrected** before you change items here. On Windows, writes are refused while the game is running, because it would overwrite the change. Other platforms can't check this, so close the game yourself before editing.
- The app only edits files inside your configured save folder, and refuses a change if the file changed since the last scan (refresh and try again).
- Bookmarks never appear here and can't be unvaulted, since they hold no item.
