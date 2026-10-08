# Inventory Browser

The **Inventory Browser** (title bar → **Inventory Browser**, route `/inventory-browser`) shows what is in your save files and lets you move items around without starting the game. For the grail itself, see the [Holy Grail Guide](HOLY_GRAIL_GUIDE.md).

## What you see

- One board per character (equipped items, inventory, belt, mercenary, corpse) and per shared stash, built from the last scan of your `.d2s` and `.d2i` files.
- Shared stash tabs, plus the **Runes**, **Gems** and **Materials** tabs of the modern (v105+) shared stash. Stacks show their count.
- A search box (item names, codes or quality) and filters for character, location and item type.
- Hover or select an item to see its details. **Characters & Stashes** opens a character or stash in a separate window, and you can drag items between that window and the main view.

## Changing your items

- **Move**: drag an item to a free spot in the same file or another file. Occupied spots, invalid equipment slots and class restrictions are refused with a message, and nothing is changed.
- **Split a stack**: pick up part of a stack and place the pieces one by one. The Runes, Gems and Materials tabs themselves are not draggable.
- **Vault**: drop an item on the vault area (or use **Vault**) to take it out of the save file and keep it in the app's database. Drag a vaulted item onto a free spot to **Unvault** it back into a character or stash.

Vaulting and unvaulting are the only ways the app keeps an item outside a save file. The **Bookmark** action in the grail item dialog is different: see [Bookmarks](HOLY_GRAIL_GUIDE.md#bookmarks).

## Safety

- Before every write, the app copies the save file to `save-file-backups` in its data folder and keeps the 20 newest copies per file. If the backup fails, the file is not modified.
- On Windows, writes are refused while **Diablo II: Resurrected** is running, because the game would overwrite the change. Close the game first. Other platforms can't check this, so close the game yourself before editing.
- The app only edits files inside your configured save folder, and refuses a change if the file changed since the last scan (refresh and try again).
- Bookmarks never appear here and can't be unvaulted, since they hold no item.
