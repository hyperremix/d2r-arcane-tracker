#!/usr/bin/env npx tsx

/**
 * inject-grail-item.ts
 *
 * A development script to test grail item detection by injecting a unique/set item
 * into a D2R shared stash file. This triggers the app's file watcher and item detection
 * without needing to run the game.
 *
 * Usage:
 *   npx tsx scripts/inject-grail-item.ts [--item <itemId>] [--list] [--dry-run]
 *
 * Options:
 *   --item <id>     Specific item ID to inject (from electron/items)
 *   --list          List available unfound items and exit
 *   --dry-run       Parse the stash but don't write changes
 *   --save-dir      Custom save directory path
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';

// Default paths
const DEFAULT_SAVE_DIR = '/Users/f00486/Saved Games/Diablo II Resurrected/mods/givemhell';
const DB_PATH = '/Users/f00486/Library/Application Support/@hyperremix/d2r-arcane-tracker/grail.db';

// Use require for loading d2s constants
const require = createRequire(import.meta.url);
const constants96 = require('@dschu012/d2s/lib/data/versions/96_constant_data').constants;
const constants99 = require('@dschu012/d2s/lib/data/versions/99_constant_data').constants;

// Initialize d2s constants (same as SaveFileMonitor)
function initializeD2SConstants(): void {
  const constantVersions = [96, 97, 98, 99, 0, 1, 2];
  for (const version of constantVersions) {
    try {
      d2s.getConstantData(version);
    } catch (_e) {
      const constants = version === 99 ? constants99 : constants96;
      d2s.setConstantData(version, constants as d2s.types.IConstantData);
    }
  }
}

interface GrailItem {
  id: string;
  name: string;
  code: string;
  type: string;
  category: string;
  subCategory: string;
}

/**
 * Run a sqlite3 query and return results as JSON
 */
function runQuery(query: string): string {
  try {
    const result = execSync(`sqlite3 -json "${DB_PATH}" "${query.replace(/"/g, '\\"')}"`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.trim();
  } catch {
    return '[]';
  }
}

/**
 * Get unfound unique/set items from the database
 */
function getUnfoundItems(): GrailItem[] {
  const query = `
    SELECT id, name, code, type, category, sub_category as subCategory
    FROM items
    WHERE type IN ('unique', 'set')
      AND code IS NOT NULL
      AND id NOT IN (SELECT item_id FROM grail_progress)
    ORDER BY category, sub_category, name
  `;
  const result = runQuery(query);
  return result ? JSON.parse(result) : [];
}

/**
 * Get a specific item by ID
 */
function getItemById(itemId: string): GrailItem | null {
  const query = `
    SELECT id, name, code, type, category, sub_category as subCategory
    FROM items WHERE id = '${itemId}'
  `;
  const result = runQuery(query);
  const items = result ? JSON.parse(result) : [];
  return items[0] || null;
}

/**
 * Check if item is already found
 */
function isItemFound(itemId: string): boolean {
  const query = `SELECT COUNT(*) as count FROM grail_progress WHERE item_id = '${itemId}'`;
  const result = runQuery(query);
  const rows = result ? JSON.parse(result) : [];
  return rows[0]?.count > 0;
}

/**
 * Create a D2S item structure for injection
 * This creates a minimal but valid unique/set item
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: dev script with necessary branching for item type detection
function createD2SItem(grailItem: GrailItem, x: number, y: number): d2s.types.IItem {
  const isUnique = grailItem.type === 'unique';

  // Lookup dimensions and type from constants
  let width = 1;
  let height = 1;
  let typeId = 4; // Default to Other
  let categories: string[] = [];

  // Check armor - type_id 1 = Armor
  if (constants99.armor_items[grailItem.code]) {
    const itemData = constants99.armor_items[grailItem.code];
    width = itemData.iw;
    height = itemData.ih;
    typeId = 1; // ItemType.Armor
    categories = itemData.c || [];
  }
  // Check weapons - type_id 3 = Weapon
  else if (constants99.weapon_items[grailItem.code]) {
    const itemData = constants99.weapon_items[grailItem.code];
    width = itemData.iw;
    height = itemData.ih;
    typeId = 3; // ItemType.Weapon
    categories = itemData.c || [];
  }
  // Check other items - type_id 4 = Other
  else if (constants99.other_items[grailItem.code]) {
    const itemData = constants99.other_items[grailItem.code];
    width = itemData.iw;
    height = itemData.ih;
    typeId = 4; // ItemType.Other
    categories = itemData.c || [];
  }

  // Lookup Unique/Set ID
  let uniqueId = 0;
  let setId = 0;

  if (isUnique) {
    // Find index in unq_items
    const index = constants99.unq_items.findIndex((u: { n: string }) => u.n === grailItem.name);
    if (index !== -1) {
      uniqueId = index;
    } else {
      console.warn(
        `⚠️  Warning: Unique item "${grailItem.name}" not found in D2S constants. Defaulting to ID 0.`,
      );
    }
  } else {
    // Find index in set_items
    const index = constants99.set_items.findIndex((s: { n: string }) => s.n === grailItem.name);
    if (index !== -1) {
      setId = index;
    } else {
      console.warn(
        `⚠️  Warning: Set item "${grailItem.name}" not found in D2S constants. Defaulting to ID 0.`,
      );
    }
  }

  // Create item with all required fields from IItem interface
  const item: d2s.types.IItem = {
    // Basic flags
    identified: 1,
    socketed: 0,
    new: 0,
    is_ear: 0,
    starter_item: 0,
    simple_item: 0, // Not simple - has properties
    ethereal: 0,
    personalized: 0,
    personalized_name: '',
    given_runeword: 0,

    // Version (Pass as number to ensure correct handling)
    // biome-ignore lint/suspicious/noExplicitAny: d2s library types expect string but runtime needs number
    version: 101 as any,

    // Location in stash
    location_id: 0, // stored
    equipped_id: 0, // not equipped
    position_x: x,
    position_y: y,
    alt_position_id: 5, // stash

    // Item type
    type: grailItem.code,
    type_id: typeId,
    type_name: grailItem.name,

    // Quest/socket info
    quest_difficulty: 0,
    nr_of_items_in_sockets: 0,

    // Unique ID
    id: Math.floor(Math.random() * 0xffffffff),

    // Item stats
    level: 85,
    quality: isUnique ? 7 : 5, // 7 = unique, 5 = set
    multiple_pictures: 0,
    picture_id: 0,
    class_specific: 0,
    low_quality_id: 0,
    timestamp: 0,

    // Ear (not applicable)
    // biome-ignore lint/suspicious/noExplicitAny: d2s library types don't allow undefined for optional field
    ear_attributes: undefined as any,

    // Defense/durability
    defense_rating: 100,
    max_durability: 100,
    current_durability: 100,

    // Sockets
    total_nr_of_sockets: 0,
    quantity: 0,

    // Magic affixes (not used for unique/set)
    magic_prefix: 0,
    magic_prefix_name: '',
    magic_suffix: 0,
    magic_suffix_name: '',

    // Runeword (not applicable)
    runeword_id: 0,
    runeword_name: '',
    runeword_attributes: [],

    // Set info
    set_id: isUnique ? 0 : setId,
    set_name: isUnique ? '' : grailItem.name,
    set_list_count: 0,
    set_attributes: [],
    set_attributes_num_req: 0,
    set_attributes_ids_req: 0,

    // Rare names (not applicable)
    rare_name: '',
    rare_name2: '',
    magical_name_ids: [],
    rare_name_id: 0,
    rare_name_id2: 0,

    // Unique info
    unique_id: isUnique ? uniqueId : 0,
    unique_name: isUnique ? grailItem.name : '',

    // Magic properties
    magic_attributes: [],
    combined_magic_attributes: [],
    displayed_magic_attributes: [],
    displayed_runeword_attributes: [],
    displayed_combined_magic_attributes: [],

    // Socketed items
    socketed_items: [],

    // Base damage
    base_damage: { mindam: 0, maxdam: 0, twohandmindam: 0, twohandmaxdam: 0 },

    // Requirements
    reqstr: 0,
    reqdex: 0,

    // Inventory display
    inv_width: width,
    inv_height: height,
    inv_file: 0,
    inv_transform: 0,
    transform_color: '',
    item_quality: 0 as d2s.types.EItemQuality,
    categories: categories,
    file_index: 0,
    auto_affix_id: 0,

    // Unknown data - zero-initialized byte arrays for proper binary alignment
    _unknown_data: {
      b0_3: new Uint8Array(4),
      b5_10: new Uint8Array(6),
      b12: new Uint8Array(1),
      b14_15: new Uint8Array(2),
      b18_20: new Uint8Array(3),
      b23: new Uint8Array([1]), // IFLAG_JUSTSAVED - always 1
      b25: new Uint8Array(1),
      b27_31: new Uint8Array(5),
    },
  };

  return item;
}

/**
 * List unfound items grouped by category
 */
function listUnfoundItems(): void {
  const unfoundItems = getUnfoundItems();

  if (unfoundItems.length === 0) {
    console.log('🎉 Congratulations! All unique and set items have been found!');
    return;
  }

  console.log(`\n📋 Unfound Items (${unfoundItems.length} total):\n`);

  // Group by category
  const byCategory = new Map<string, GrailItem[]>();
  for (const item of unfoundItems) {
    const key = `${item.category}/${item.subCategory}`;
    const existing = byCategory.get(key) ?? [];
    existing.push(item);
    byCategory.set(key, existing);
  }

  for (const [category, items] of byCategory) {
    console.log(`\n  ${category.toUpperCase()} (${items.length}):`);
    for (const item of items.slice(0, 5)) {
      console.log(`    - ${item.id}: ${item.name} [${item.code}]`);
    }
    if (items.length > 5) {
      console.log(`    ... and ${items.length - 5} more`);
    }
  }

  console.log('\n  Usage: npx tsx scripts/inject-grail-item.ts --item <itemId>\n');
}

/**
 * Parse command line arguments
 */
function parseArgs(): { itemId?: string; list: boolean; saveDir: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let itemId: string | undefined;
  let list = false;
  let saveDir = DEFAULT_SAVE_DIR;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--item') {
      itemId = args[++i];
    } else if (arg === '--list') {
      list = true;
    } else if (arg === '--save-dir') {
      saveDir = args[++i];
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--help') {
      console.log(`
🎮 D2R Grail Item Injection Script

Usage:
  npx tsx scripts/inject-grail-item.ts [options]

Options:
  --item <id>     Inject a specific item by ID
  --list          List available unfound items
  --dry-run       Parse the stash but don't write changes
  --save-dir      Custom save directory path
  --help          Show this help message

Examples:
  # List all unfound items
  npx tsx scripts/inject-grail-item.ts --list

  # Inject a random unfound item
  npx tsx scripts/inject-grail-item.ts

  # Inject a specific item
  npx tsx scripts/inject-grail-item.ts --item goldwrap
`);
      process.exit(0);
    }
  }

  return { itemId, list, saveDir, dryRun };
}

/**
 * Find empty position in stash page
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: dev script with grid search algorithm
function findEmptyPosition(
  page: d2s.types.IStashPage,
  itemWidth: number,
  itemHeight: number,
): { x: number; y: number } | null {
  const STASH_WIDTH = 10;
  const STASH_HEIGHT = 10;

  // Build occupancy grid
  const occupied = new Set<string>();
  for (const item of page.items) {
    const w = item.inv_width || 1;
    const h = item.inv_height || 1;
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        occupied.add(`${item.position_x + dx},${item.position_y + dy}`);
      }
    }
  }

  // Find empty spot
  for (let y = 0; y <= STASH_HEIGHT - itemHeight; y++) {
    for (let x = 0; x <= STASH_WIDTH - itemWidth; x++) {
      let fits = true;
      for (let dx = 0; dx < itemWidth && fits; dx++) {
        for (let dy = 0; dy < itemHeight && fits; dy++) {
          if (occupied.has(`${x + dx},${y + dy}`)) {
            fits = false;
          }
        }
      }
      if (fits) {
        return { x, y };
      }
    }
  }

  return null;
}

/**
 * Main script entry point
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: dev script CLI entry point
async function main(): Promise<void> {
  console.log('\n🎮 D2R Grail Item Injection Script\n');

  // Initialize d2s constants
  initializeD2SConstants();

  const { itemId, list, saveDir, dryRun } = parseArgs();

  // Check if database exists
  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ Database not found at: ${DB_PATH}`);
    console.error('   Make sure the D2R Arcane Tracker app has been run at least once.');
    process.exit(1);
  }

  // List mode
  if (list) {
    listUnfoundItems();
    return;
  }

  // Get the item to inject
  let item: GrailItem | null;

  if (itemId) {
    item = getItemById(itemId);
    if (!item) {
      console.error(`❌ Item not found: ${itemId}`);
      console.error('   Use --list to see available items.');
      process.exit(1);
    }
    if (isItemFound(itemId)) {
      console.warn(`⚠️  Warning: ${item.name} is already found in grail progress.`);
      console.warn('   The app may not show a notification for this item.');
    }
  } else {
    // Get a random unfound item
    const unfoundItems = getUnfoundItems();
    if (unfoundItems.length === 0) {
      console.log('🎉 All unique and set items have been found!');
      return;
    }
    item = unfoundItems[Math.floor(Math.random() * unfoundItems.length)];
  }

  console.log(`📦 Selected item: ${item.name} (${item.id})`);
  console.log(`   Type: ${item.type}, Code: ${item.code}`);

  // Find the shared stash file
  const stashPath = path.join(saveDir, 'SharedStashSoftCoreV2.d2i');

  if (!fs.existsSync(stashPath)) {
    console.error(`❌ Shared stash not found at: ${stashPath}`);
    console.error('   Check the save directory path.');
    process.exit(1);
  }

  console.log(`\n📂 Using stash: ${stashPath}`);

  // Read and parse the stash file
  const buffer = fs.readFileSync(stashPath);
  const stashData = await d2stash.read(buffer, constants99);

  console.log(`   Stash has ${stashData.pages.length} pages`);

  // Find a page with space
  let targetPage: d2s.types.IStashPage | null = null;
  let position: { x: number; y: number } | null = null;

  for (const page of stashData.pages) {
    position = findEmptyPosition(page, 2, 3);
    if (position) {
      targetPage = page;
      break;
    }
  }

  if (!targetPage || !position) {
    console.error('❌ No empty position found in any stash page.');
    console.error('   Clear some space and try again.');
    process.exit(1);
  }

  console.log(`   Placing item in page "${targetPage.name}" at (${position.x}, ${position.y})`);

  // Create the item
  const newItem = createD2SItem(item, position.x, position.y);

  if (dryRun) {
    console.log('\n🔍 Dry run mode - no changes written');
    console.log('   Would inject item with type:', newItem.type);
    return;
  }

  // Add item to stash
  targetPage.items.push(newItem);

  // Write modified stash
  try {
    const newBuffer = await d2stash.write(
      stashData,
      constants99,
      stashData.version ? Number.parseInt(stashData.version, 10) : 99,
    );
    fs.writeFileSync(stashPath, Buffer.from(newBuffer));
    console.log('\n✅ Item injected successfully!');
    console.log(`   ${item.name} has been added to your shared stash.`);
    console.log('\n   The app should detect this change and show a notification.');
  } catch (error) {
    console.error('\n❌ Failed to write stash file:', error);

    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Script error:', error);
  process.exit(1);
});
