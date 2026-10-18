# Farming Advisor

The farming advisor answers "where should I farm for my missing items?". It reads the drop tables of your own D2R installation and shows, for the uniques, set items and runes your grail is still missing:

- which areas, super uniques and bosses can drop them, per difficulty,
- what the current and the next terror zone of your offline schedule can drop when terrorized,
- for one item, every monster that drops it and how many kills a drop takes on average, for your `/players` setting and magic find.

## Requirements

1. All game files [extracted](EXTRACTING_GAME_FILES.md). The advisor reads these files from `Data/global/excel` in your D2R folder: `treasureclassex.txt`, `levels.txt`, `monstats.txt`, `superuniques.txt`, `itemratio.txt`, `itemtypes.txt`, `uniqueitems.txt`, `setitems.txt`, `weapons.txt`, `armor.txt` and `misc.txt`. Area and monster names come from `Data/local/lng/strings/levels.json` and `monsters.json` when they are there.
2. **Settings → D2R installation** pointing at your D2R folder.

The advisor only reads these files; it never changes them. Unlike the [terror zone configuration](TERROR_ZONE_CONFIGURATION.md), it doesn't need D2R started with `-direct -txt`. Because the numbers come from your own files, they follow the game version you have installed. Extract the files again after a patch.

The tables are read once and kept in memory until one of them changes on disk (their size or modification time). The terror zone file is checked on every request, so changes made on the terror zone configuration page show up, and read again when it changed. The latest answers are kept too, so asking the same question again doesn't recalculate it. The calculation runs in the app's main process; the page waits a moment after you stop typing in an input before it asks.

## The farming advisor page

Open it with the crosshair icon (**Farming advisor**) next to the terror zone icon on the right of the title bar.

Until the files can be read, the page says what is missing: without a D2R folder it asks you to set one, with an **Open D2R installation settings** button (the same prompt the terror zone pages show), and when files are missing it lists them.

The page then shows:

- **How many missing items** your grail tracks: uniques, set items and runes with at least one tracked version (normal or ethereal, following **Settings → Tracking**) that no character found. Runewords are made, not found, so they are left out, and so are the crafted Latent and Renewed sunder charms. Items that no monster in the game files drops are listed by name, for example Annihilus and the Hellfire Torch, which come from events the advisor doesn't cover.
- **Character level**: the level the terror zone monster levels follow. It starts at the highest level of your characters (99 without characters) and is kept until you close the app.
- **Terror zones**: the current and the next zone of the [offline schedule](TERROR_ZONE_CONFIGURATION.md#schedule), each with one line per difficulty: how many of your missing items its terrorized monsters can drop, and their monster levels. Select a line to list the items. If `Data/hd/global/excel/desecratedzones.json` can't be read, this section says so; a zone the file has no entry for says it has no drop data. A line below the zone cards points to the assumed monster level rules described here.
- **Where your missing items drop**: one tab per difficulty listing every area, super unique and boss whose monsters can drop at least one missing item, with its monster level and the number of items, most items first, ten per page. Select the item count to list the items. Search by location, area or item name to narrow the list; the search covers all three difficulties' tabs.

Select an item in any list to open its details.

The [terror zone schedule](TERROR_ZONE_CONFIGURATION.md#schedule) uses the same data to show how many of your missing items each upcoming zone can drop.

## Where to farm (item details)

The details of a unique, set item or rune have a **Where to farm** section. It lists the monsters that drop the item, best drop rate first: each area's regular monsters, champions and unique monsters, each super unique and boss, and their terrorized versions (marked **Terror zone**) at the character level set on the farming advisor page. **Show all** lists every source.

The drop rate is the average number of kills per drop, for example "1 in 1,779". Where a source groups several monster types (the regular monsters of an area), the range from the best to the worst type is shown. Set **Players** (your `/players` setting) and **Magic find** above the list; both are kept until you close the app.

Without a D2R folder the section shows the same prompt to set one, with an **Open D2R installation settings** button. When a folder is set but game files are missing or can't be read, a warning names the missing files, or says the files can't be read, and tells you to extract the game files again.

## How the numbers are calculated

The advisor follows the game's drop code as reimplemented by [D2MOO](https://github.com/ThePhrozenKeep/D2MOO), applied to the tables of your installation:

- **Monster level.** In Normal, monsters have the level of their monstats entry. In Nightmare and Hell they have the area level. Champions add 2, unique monsters and super uniques add 3. Bosses, and super uniques of a boss monster (Griswold, Radament, Nihlathak), use their own fixed level, plus 3 for the super uniques.
- **Treasure class.** Each monster kind (regular, champion, unique) has its own treasure class per difficulty. In Nightmare and Hell it is upgraded within its group to the highest level the monster level reaches, except for bosses.
- **Picks and NoDrop.** A positive pick count rolls that many times between the entries and NoDrop. NoDrop shrinks with `/players`: the other players count half, so it only changes at `/players` 3, 5 and 7. Negative picks drop the entries in order (Item1 Prob1 times, then Item2 ...). A nested treasure class finishes before its parent continues, and a kill drops at most six items, so items late in the order can be pushed out. This is why the Countess drops fewer runes at higher `/players`: her item drops come first.
- **Item level.** Dropped items get the monster level as their item level. Item type treasure classes such as `armo87` are built from `weapons.txt` and `armor.txt` the way the game builds them.
- **Quality.** A dropped base item first rolls for unique quality, then for set quality, using `itemratio.txt`, the quality level of the base item, the treasure class quality ratios and magic find. Magic find above 10% has diminishing returns: it counts as 250 × MF / (MF + 250) for uniques and 500 × MF / (MF + 500) for sets. A unique is picked among the uniques of that base whose level the item level reaches, weighted by their rarity; set items the same way. If the unique roll succeeds but no unique fits, the item becomes rare, so it doesn't get a set roll. The Cow King's set only drops from Hell Bovines.
- **Conditions.** Treasure classes, uniques and set items with a condition (for example Hell only, or terror zones only) are only used where it is met. Evaluating these conditions (`ConditionCalc`, `DropConditionCalc`) and the terror zones go beyond what D2MOO reimplements, and are assumptions.

What was compared with published numbers:

- The Hell Countess rune rates at `/players` 1, with the Reign of the Warlock tables of the retail game, come out as 1 in 195 for Um, 1 in 191 for Mal, 1 in 287 for Ist and 1 in 32,150 for Vex, the same as [d2runewizard's Countess table](https://d2runewizard.com/articles/mechanics/countess). This was done with `scripts/farming-drop-check.ts` on the retail tables; the script is not part of the automated tests.
- The treasure class math was compared with the precalculated drops of [blizzhackers/d2data](https://github.com/blizzhackers/d2data) for the treasure classes tried. They agree for classes such as `Act 5 (H) Equip C` and `Runes 17`. They differ for negative picks, because d2data drops those in random order rather than in order.

Unique and set item odds with magic find, and drop rates at `/players` above 1, follow the D2MOO formulas described above and haven't been compared with a published table. To repeat the checks, run `bun scripts/farming-drop-check.ts <excel-dir> <d2data>/json/precalctc` with the folder holding your extracted tables; it also prints the `levels.txt` name of the area of every super unique and boss in `electron/data/farmingLocations.ts`, so the placements can be checked by eye.

### Terror zones

The terror zone levels come from the `game_difficulties` of `desecratedzones.json` (the Reign of the Warlock values, or the Lord of Destruction ones when the file has no others): the zone level is your character level plus `boost_level`, kept between `bound_incl_min` and `bound_incl_max` of the difficulty (Hell: 70 to 96). Champions add 2 to it and unique monsters, super uniques and bosses 3, and no monster ends up below its level outside the terror zone. Super uniques of a boss monster add their 3 levels after that. Terrorized champions, uniques, super uniques and bosses drop from their terror zone treasure classes (`TreasureClassDesecrated...` in monstats.txt, `TC ... Desecrated` in superuniques.txt); monsters without one use their usual treasure class.

## Assumptions and limitations

These parts could not be checked against the game itself and are assumptions:

- The drop rules above are those of the game code D2MOO reimplements. They are assumed to be unchanged in D2R and Reign of the Warlock where the tables don't say otherwise.
- Outside terror zones, champions add 2 and unique monsters and super uniques add 3 to the monster level. This follows the published rule and hasn't been checked against D2R.
- The terror zone level rule (character level plus the boost, within the file's bounds; +2 for champions and +3 for uniques, super uniques and bosses; +3 more for Griswold, Radament and Nihlathak) follows the published rule for D2R and the values in the file. That act bosses are terrorized like unique monsters is an assumption.
- Treasure classes are only upgraded by monster level in Nightmare and Hell, as in the game code D2MOO reimplements. That this also holds for Normal terror zones is an assumption.
- The terror zone level rules come from the `rotw` entry of `game_difficulties` in `desecratedzones.json` when the file has one, otherwise from `expansion`. That the Reign of the Warlock entry is the one a game uses is an assumption, and only the first config of the file is read.
- A treasure class entry whose condition isn't met is removed together with its share of the probabilities.
- A unique or set item a treasure class names directly (for example the colossal jewels of the Colossal Summit ancients) always drops as that item.
- The ladder season columns of the tables are not used. Items that are ladder-only in the current season are shown as droppable.
- The advisor doesn't tell Lord of Destruction and Reign of the Warlock games apart: every item in the tables counts as droppable in both.

Not covered:

- Heralds of terror zones and their treasure classes. Sunder charms that only heralds drop are shown as having no drop source.
- Quest drops (the first kill of a quest boss), events (Uber Tristram, the Pandemonium keys and organs, Diablo Clone) and minions of unique monsters.
- Which monster types of an area spawn in a game: the game picks some of the area's monster types per game, the advisor counts all of them.
- The ethereal roll: drop rates are for the item in any version.
- Where super uniques and bosses stand comes from a list in the app (`electron/data/farmingLocations.ts`), since the tables don't hold it.
- Drop rates are the average number of drops per kill. For rare items this is the chance per kill; for items that can drop several times per kill (low runes from the Countess) it is the average count.
