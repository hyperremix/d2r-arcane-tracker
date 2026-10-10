// Upgrade path for databases created before schema migrations existed.
//
// Older versions created the schema with one `CREATE ... IF NOT EXISTS` script plus ad-hoc
// `ALTER TABLE` steps and backfills that ran on every launch. Such a database has no
// `__drizzle_migrations` rows. The migration runner (./migrator.ts) upgrades it once with
// `upgradeLegacyDatabase` and then marks the baseline migration as applied.
//
// Do not update the legacy script below for new schema changes. New schema changes are
// migrations; this module only reproduces what the legacy script created.

import { basename } from 'node:path';
import { items as grailItemCatalog } from '../items';
import type { D2SItem, VaultLocationContext, VaultSourceFileType } from '../types/grail';
import type { DatabaseContext } from './types';

/** The schema script of the last version before migrations, without its default settings. */
const LEGACY_SCHEMA_SQL = `
      -- Items table - stores all Holy Grail items
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        link TEXT,
        code TEXT,
        item_base TEXT,
        image_filename TEXT,
        type TEXT NOT NULL CHECK (type IN ('unique', 'set', 'rune', 'runeword')),
        category TEXT NOT NULL,
        sub_category TEXT NOT NULL,
        treasure_class TEXT NOT NULL,
        set_name TEXT,
        runes TEXT,
        ethereal_type TEXT NOT NULL CHECK (ethereal_type IN ('none', 'optional', 'only')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Characters table - stores character profiles
      CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        character_class TEXT NOT NULL CHECK (
          character_class IN (
            'amazon',
            'assassin',
            'barbarian',
            'druid',
            'necromancer',
            'paladin',
            'sorceress',
            'shared_stash'
          )
        ),
        level INTEGER NOT NULL DEFAULT 1,
        hardcore BOOLEAN NOT NULL DEFAULT FALSE,
        expansion BOOLEAN NOT NULL DEFAULT TRUE,
        save_file_path TEXT,
        deleted_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Grail progress table - tracks item discoveries per character
      CREATE TABLE IF NOT EXISTS grail_progress (
        id TEXT PRIMARY KEY,
        character_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        found_date DATETIME,
        manually_added BOOLEAN NOT NULL DEFAULT FALSE,
        auto_detected BOOLEAN NOT NULL DEFAULT TRUE,
        difficulty TEXT CHECK (difficulty IN ('normal', 'nightmare', 'hell')),
        notes TEXT,
        is_ethereal BOOLEAN NOT NULL DEFAULT FALSE,
        from_initial_scan BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
      );

      -- Settings table - stores user preferences
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Save file states table - tracks modification times of save files
      CREATE TABLE IF NOT EXISTS save_file_states (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL UNIQUE,
        last_modified DATETIME NOT NULL,
        last_parsed DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Sessions table - tracks gaming sessions
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        total_run_time INTEGER DEFAULT 0, -- milliseconds
        total_session_time INTEGER DEFAULT 0, -- milliseconds
        run_count INTEGER DEFAULT 0,
        archived BOOLEAN DEFAULT FALSE,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Runs table - tracks individual runs within sessions
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        character_id TEXT,
        run_number INTEGER NOT NULL, -- sequential within session
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        duration INTEGER, -- milliseconds
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (character_id) REFERENCES characters(id)
      );

      -- Run items table - associates items with runs
      CREATE TABLE IF NOT EXISTS run_items (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        grail_progress_id TEXT,
        name TEXT,
        found_time DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE,
        FOREIGN KEY (grail_progress_id) REFERENCES grail_progress(id) ON DELETE CASCADE
      );

      -- Vault categories table - stores category metadata for vaulted items
      CREATE TABLE IF NOT EXISTS vault_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Vault items table - stores item snapshots captured from save scans
      CREATE TABLE IF NOT EXISTS vault_items (
        id TEXT PRIMARY KEY,
        fingerprint TEXT NOT NULL,
        item_name TEXT NOT NULL,
        item_code TEXT,
        quality TEXT NOT NULL,
        ethereal BOOLEAN NOT NULL DEFAULT FALSE,
        socket_count INTEGER,
        stack_count INTEGER NOT NULL DEFAULT 1,
        raw_item_json TEXT NOT NULL,
        source_character_id TEXT,
        source_character_name TEXT,
        source_file_type TEXT NOT NULL CHECK (source_file_type IN ('d2s', 'sss', 'd2x', 'd2i')),
        location_context TEXT NOT NULL DEFAULT 'unknown' CHECK (
          location_context IN ('equipped', 'inventory', 'stash', 'mercenary', 'corpse', 'unknown')
        ),
        stash_tab INTEGER,
        grid_x INTEGER,
        grid_y INTEGER,
        grid_width INTEGER,
        grid_height INTEGER,
        equipped_slot_id INTEGER,
        icon_file_name TEXT,
        is_socketed_item BOOLEAN NOT NULL DEFAULT FALSE,
        grail_item_id TEXT,
        is_present_in_latest_scan BOOLEAN NOT NULL DEFAULT TRUE,
        last_seen_at DATETIME,
        vaulted_at DATETIME,
        unvaulted_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_character_id) REFERENCES characters(id) ON DELETE SET NULL,
        FOREIGN KEY (grail_item_id) REFERENCES items(id) ON DELETE SET NULL
      );

      -- Vault item categories table - many-to-many mapping for item category tags
      CREATE TABLE IF NOT EXISTS vault_item_categories (
        vault_item_id TEXT NOT NULL,
        vault_category_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (vault_item_id, vault_category_id),
        FOREIGN KEY (vault_item_id) REFERENCES vault_items(id) ON DELETE CASCADE,
        FOREIGN KEY (vault_category_id) REFERENCES vault_categories(id) ON DELETE CASCADE
      );

      -- Indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
      CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
      CREATE INDEX IF NOT EXISTS idx_characters_class ON characters(character_class);
      CREATE INDEX IF NOT EXISTS idx_characters_deleted_at ON characters(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_grail_progress_character ON grail_progress(character_id);
      CREATE INDEX IF NOT EXISTS idx_grail_progress_item ON grail_progress(item_id);
      CREATE INDEX IF NOT EXISTS idx_grail_progress_found_date ON grail_progress(found_date);
      CREATE INDEX IF NOT EXISTS idx_grail_progress_character_item ON grail_progress(character_id, item_id);
      CREATE INDEX IF NOT EXISTS idx_save_file_states_path ON save_file_states(file_path);
      CREATE INDEX IF NOT EXISTS idx_save_file_states_modified ON save_file_states(last_modified);

      -- Sessions indexes
      CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
      CREATE INDEX IF NOT EXISTS idx_sessions_archived ON sessions(archived);

      -- Runs indexes
      CREATE INDEX IF NOT EXISTS idx_runs_session ON runs(session_id);
      CREATE INDEX IF NOT EXISTS idx_runs_character ON runs(character_id);
      CREATE INDEX IF NOT EXISTS idx_runs_start_time ON runs(start_time);
      CREATE INDEX IF NOT EXISTS idx_runs_session_number ON runs(session_id, run_number);

      -- Run items indexes
      CREATE INDEX IF NOT EXISTS idx_run_items_run ON run_items(run_id);
      CREATE INDEX IF NOT EXISTS idx_run_items_progress ON run_items(grail_progress_id);

      -- Additional indexes for sorting and filtering operations
      CREATE INDEX IF NOT EXISTS idx_grail_progress_updated_at ON grail_progress(updated_at);
      CREATE INDEX IF NOT EXISTS idx_characters_updated_at ON characters(updated_at);

      -- Vault category indexes
      CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_categories_name ON vault_categories(name);

      -- Vault items indexes
      CREATE UNIQUE INDEX IF NOT EXISTS idx_vault_items_fingerprint ON vault_items(fingerprint);
      CREATE INDEX IF NOT EXISTS idx_vault_items_item_name ON vault_items(item_name);
      CREATE INDEX IF NOT EXISTS idx_vault_items_item_code ON vault_items(item_code);
      CREATE INDEX IF NOT EXISTS idx_vault_items_quality ON vault_items(quality);
      CREATE INDEX IF NOT EXISTS idx_vault_items_source_character_id ON vault_items(source_character_id);
      CREATE INDEX IF NOT EXISTS idx_vault_items_source_file_type ON vault_items(source_file_type);
      CREATE INDEX IF NOT EXISTS idx_vault_items_location_context ON vault_items(location_context);
      CREATE INDEX IF NOT EXISTS idx_vault_items_grail_item_id ON vault_items(grail_item_id);
      CREATE INDEX IF NOT EXISTS idx_vault_items_present_scan ON vault_items(is_present_in_latest_scan);
      CREATE INDEX IF NOT EXISTS idx_vault_items_last_seen_at ON vault_items(last_seen_at);

      -- Vault item categories indexes
      CREATE INDEX IF NOT EXISTS idx_vault_item_categories_item ON vault_item_categories(vault_item_id);
      CREATE INDEX IF NOT EXISTS idx_vault_item_categories_category ON vault_item_categories(vault_category_id);

      -- Triggers to update the updated_at timestamp
      CREATE TRIGGER IF NOT EXISTS update_items_timestamp
        AFTER UPDATE ON items
        BEGIN
          UPDATE items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      CREATE TRIGGER IF NOT EXISTS update_characters_timestamp
        AFTER UPDATE ON characters
        BEGIN
          UPDATE characters SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      CREATE TRIGGER IF NOT EXISTS update_grail_progress_timestamp
        AFTER UPDATE ON grail_progress
        BEGIN
          UPDATE grail_progress SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      CREATE TRIGGER IF NOT EXISTS update_settings_timestamp
        AFTER UPDATE ON settings
        BEGIN
          UPDATE settings SET updated_at = CURRENT_TIMESTAMP WHERE key = NEW.key;
        END;

      CREATE TRIGGER IF NOT EXISTS update_save_file_states_timestamp
        AFTER UPDATE ON save_file_states
        BEGIN
          UPDATE save_file_states SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      CREATE TRIGGER IF NOT EXISTS update_sessions_timestamp
        AFTER UPDATE ON sessions
        BEGIN
          UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      CREATE TRIGGER IF NOT EXISTS update_runs_timestamp
        AFTER UPDATE ON runs
        BEGIN
          UPDATE runs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      CREATE TRIGGER IF NOT EXISTS update_vault_categories_timestamp
        AFTER UPDATE ON vault_categories
        BEGIN
          UPDATE vault_categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      CREATE TRIGGER IF NOT EXISTS update_vault_items_timestamp
        AFTER UPDATE ON vault_items
        BEGIN
          UPDATE vault_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
`;

interface VaultItemSpatialBackfillRow {
  id: string;
  raw_item_json: string;
  item_name: string;
  item_code: string | null;
  grail_item_id: string | null;
  source_file_type: VaultSourceFileType;
  location_context: VaultLocationContext;
  stash_tab: number | null;
  grid_x: number | null;
  grid_y: number | null;
  grid_width: number | null;
  grid_height: number | null;
  equipped_slot_id: number | null;
  icon_file_name: string | null;
}

/** vault_items columns that the legacy script added with ALTER TABLE when they were missing. */
const addedVaultItemColumns = [
  { name: 'source_file_path', definition: 'TEXT' },
  { name: 'grid_x', definition: 'INTEGER' },
  { name: 'grid_y', definition: 'INTEGER' },
  { name: 'grid_width', definition: 'INTEGER' },
  { name: 'grid_height', definition: 'INTEGER' },
  { name: 'equipped_slot_id', definition: 'INTEGER' },
  { name: 'icon_file_name', definition: 'TEXT' },
  { name: 'is_socketed_item', definition: 'BOOLEAN NOT NULL DEFAULT FALSE' },
  { name: 'stack_count', definition: 'INTEGER NOT NULL DEFAULT 1' },
] as const;

function parseRawJsonObject(raw: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore invalid json payloads.
  }

  return undefined;
}

function getOptionalNumericValue(
  rowValue: number | null,
  parsed: Record<string, unknown> | undefined,
  key: string,
): number | null {
  if (rowValue !== null) {
    return rowValue;
  }

  const parsedValue = parsed?.[key];
  return typeof parsedValue === 'number' ? parsedValue : null;
}

function getOptionalStringValue(
  parsed: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = parsed?.[key];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return undefined;
}

// Frozen rewrites of the location and icon resolvers the legacy backfill needs.
//
// They reproduce `resolveSpatialLocation` (utils/spatialLocationResolver.ts) and
// `resolveCanonicalIconFilename` (utils/iconFilenameResolver.ts) as they were when migrations
// replaced the legacy script. This upgrade step must produce the same result whenever it runs,
// so it must not change when the live resolvers do. Do not update or reuse this code. The
// icon lookup still reads the bundled item catalog, which is data rather than resolver logic.

interface LegacySpatialLocation {
  locationContext: VaultLocationContext;
  stashTab?: number;
  gridX?: number;
  gridY?: number;
  gridWidth?: number;
  gridHeight?: number;
  equippedSlotId?: number;
}

type LegacySpatialFields = Omit<LegacySpatialLocation, 'locationContext'>;

const LEGACY_INVENTORY_COLUMNS = 10;
const LEGACY_INVENTORY_ROWS = 4;
const LEGACY_BELT_COLUMNS = 4;

function legacyToFiniteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function legacyFitsInventoryBounds(spatial: LegacySpatialFields): boolean {
  const { gridX, gridY, gridWidth, gridHeight } = spatial;
  if (
    typeof gridX !== 'number' ||
    gridX < 0 ||
    typeof gridY !== 'number' ||
    gridY < 0 ||
    typeof gridWidth !== 'number' ||
    gridWidth <= 0 ||
    typeof gridHeight !== 'number' ||
    gridHeight <= 0
  ) {
    return false;
  }

  return (
    gridX + gridWidth <= LEGACY_INVENTORY_COLUMNS && gridY + gridHeight <= LEGACY_INVENTORY_ROWS
  );
}

/** Moves an inventory item outside the 10x4 grid by one cell up and/or left if it then fits. */
function legacyNormalizeInventorySpatial(
  locationContext: VaultLocationContext,
  spatial: LegacySpatialFields,
): LegacySpatialFields {
  if (locationContext !== 'inventory') {
    return spatial;
  }

  const { gridX, gridY, gridWidth, gridHeight } = spatial;
  if (
    typeof gridX !== 'number' ||
    typeof gridY !== 'number' ||
    typeof gridWidth !== 'number' ||
    typeof gridHeight !== 'number' ||
    legacyFitsInventoryBounds(spatial)
  ) {
    return spatial;
  }

  const candidateOffsets = [
    { xOffset: 0, yOffset: -1 },
    { xOffset: -1, yOffset: 0 },
    { xOffset: -1, yOffset: -1 },
  ];
  for (const { xOffset, yOffset } of candidateOffsets) {
    const moved = { ...spatial, gridX: gridX + xOffset, gridY: gridY + yOffset };
    if (legacyFitsInventoryBounds(moved)) {
      return moved;
    }
  }

  return spatial;
}

function legacyBuildLocation(
  locationContext: VaultLocationContext,
  spatial: LegacySpatialFields,
): LegacySpatialLocation {
  const normalized = legacyNormalizeInventorySpatial(locationContext, spatial);
  return {
    locationContext,
    stashTab: normalized.stashTab,
    gridX: normalized.gridX,
    gridY: normalized.gridY,
    gridWidth: normalized.gridWidth,
    gridHeight: normalized.gridHeight,
    equippedSlotId: normalized.equippedSlotId,
  };
}

function legacyInferLocationContext(
  item: D2SItem,
  fallbackLocation: VaultLocationContext,
): VaultLocationContext {
  if (item.location === 'equipped' || item.equipped) return 'equipped';
  if (item.location === 'stash') return 'stash';
  if (item.location === 'inventory') return 'inventory';
  if (item.location === 'mercenary') return 'mercenary';
  if (item.location === 'corpse') return 'corpse';
  return fallbackLocation;
}

/** Belt items: the x position is the slot index of a 4-column belt. */
function legacyResolveBeltLocation(
  positionX: number | undefined,
  equippedSlotId: number | undefined,
): LegacySpatialLocation {
  const hasSlot = typeof positionX === 'number' && positionX >= 0;
  return legacyBuildLocation('unknown', {
    gridX: hasSlot ? positionX % LEGACY_BELT_COLUMNS : undefined,
    gridY: hasSlot ? Math.floor(positionX / LEGACY_BELT_COLUMNS) : undefined,
    gridWidth: 1,
    gridHeight: 1,
    equippedSlotId,
  });
}

/** Stored items: the alternate position tells the stash (5) from the inventory (1, `.d2s` only). */
function legacyResolveStoredLocation(
  altPositionId: number | undefined,
  sourceFileType: VaultSourceFileType,
  fallbackStashTab: number | undefined,
  spatial: LegacySpatialFields,
): LegacySpatialLocation | undefined {
  if (altPositionId === 5) {
    return legacyBuildLocation('stash', {
      stashTab: sourceFileType === 'd2s' ? 0 : fallbackStashTab,
      ...spatial,
    });
  }
  if (altPositionId === 1 && sourceFileType === 'd2s') {
    return legacyBuildLocation('inventory', spatial);
  }
  return undefined;
}

function legacyResolveSpatialLocation(params: {
  item: D2SItem;
  sourceFileType: VaultSourceFileType;
  fallbackLocation: VaultLocationContext;
  fallbackStashTab?: number;
}): LegacySpatialLocation {
  const { item, sourceFileType, fallbackLocation, fallbackStashTab } = params;
  const locationId = legacyToFiniteNumber(item.location_id);
  const altPositionId = legacyToFiniteNumber(item.alt_position_id);
  const positionX = legacyToFiniteNumber(item.position_x);
  const spatial: LegacySpatialFields = {
    gridX: positionX,
    gridY: legacyToFiniteNumber(item.position_y),
    gridWidth: legacyToFiniteNumber(item.inv_width),
    gridHeight: legacyToFiniteNumber(item.inv_height),
    equippedSlotId: legacyToFiniteNumber(item.equipped_id),
  };

  // Equipped (or worn by the mercenary / on the corpse)
  if (locationId === 1) {
    const context: VaultLocationContext =
      fallbackLocation === 'mercenary' || fallbackLocation === 'corpse'
        ? fallbackLocation
        : 'equipped';
    return legacyBuildLocation(context, spatial);
  }

  if (locationId === 2) {
    return legacyResolveBeltLocation(positionX, spatial.equippedSlotId);
  }

  const storedLocation =
    locationId === 0
      ? legacyResolveStoredLocation(altPositionId, sourceFileType, fallbackStashTab, spatial)
      : undefined;
  if (storedLocation) {
    return storedLocation;
  }

  const inferredLocation = legacyInferLocationContext(item, fallbackLocation);
  return legacyBuildLocation(inferredLocation, {
    stashTab: inferredLocation === 'stash' ? fallbackStashTab : undefined,
    ...spatial,
  });
}

function legacyNormalizeLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function legacyNormalizeIconFilename(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}.png`;
  }
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const withoutExtension = basename(trimmed)
    .replace(/\.(png|sprite|dc6|dds|jpg|jpeg|webp)$/i, '')
    .trim()
    .toLowerCase();
  return withoutExtension ? `${withoutExtension}.png` : undefined;
}

function legacyToSnakeCaseIconFilename(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const slug = value
    .trim()
    .toLowerCase()
    .replace(/['`]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug ? `${slug}.png` : undefined;
}

interface LegacyIconIndex {
  byGrailItemId: Map<string, string>;
  byItemCode: Map<string, string>;
  byNameKey: Map<string, string>;
}

let legacyIconIndex: LegacyIconIndex | undefined;

/** Built on first use, so the index only exists when a legacy database is upgraded. */
function getLegacyIconIndex(): LegacyIconIndex {
  if (legacyIconIndex) {
    return legacyIconIndex;
  }

  const index: LegacyIconIndex = {
    byGrailItemId: new Map(),
    byItemCode: new Map(),
    byNameKey: new Map(),
  };
  for (const item of grailItemCatalog) {
    const iconFilename = legacyNormalizeIconFilename(item.imageFilename);
    if (!iconFilename) {
      continue;
    }

    index.byGrailItemId.set(item.id, iconFilename);
    // The first catalog item wins a code or name that several items share
    setIfAbsent(index.byItemCode, item.code?.trim().toLowerCase(), iconFilename);
    for (const nameCandidate of [item.name, item.id]) {
      const lookupKey = nameCandidate ? legacyNormalizeLookupKey(nameCandidate) : undefined;
      setIfAbsent(index.byNameKey, lookupKey, iconFilename);
    }
  }

  legacyIconIndex = index;
  return index;
}

function setIfAbsent(map: Map<string, string>, key: string | undefined, value: string): void {
  if (key && !map.has(key)) {
    map.set(key, value);
  }
}

function legacyResolveIconByName(
  index: LegacyIconIndex,
  candidates: Array<string | undefined>,
): string | undefined {
  for (const candidate of candidates) {
    const lookupKey = candidate ? legacyNormalizeLookupKey(candidate) : undefined;
    const iconFilename = lookupKey ? index.byNameKey.get(lookupKey) : undefined;
    if (iconFilename) {
      return iconFilename;
    }
  }
  return undefined;
}

function legacyResolveIconBySlug(sources: Array<string | undefined>): string | undefined {
  for (const source of sources) {
    const slugCandidate = legacyToSnakeCaseIconFilename(source);
    if (slugCandidate) {
      return slugCandidate;
    }
  }
  return undefined;
}

/** Charm codes many items share: only used for the icon when another signal names the item. */
const LEGACY_AMBIGUOUS_CHARM_CODES = new Set(['cm1', 'cm2']);

function legacyResolveIconFilename(input: {
  grailItemId: string | null;
  itemCode: string | null;
  itemName: string;
  uniqueName?: string;
  setName?: string;
  parsedName?: string;
  typeName?: string;
  rawIconFileName: unknown;
  fallbackIconFileName: string | null;
}): string | undefined {
  const index = getLegacyIconIndex();

  const grailItemId = input.grailItemId?.trim();
  if (grailItemId) {
    const grailIcon = index.byGrailItemId.get(grailItemId);
    if (grailIcon) {
      return grailIcon;
    }
  }

  const nameIcon = legacyResolveIconByName(index, [
    input.itemName,
    input.uniqueName,
    input.setName,
    input.parsedName,
  ]);

  const codeKey = input.itemCode?.trim().toLowerCase();
  const skipCode =
    !codeKey || (LEGACY_AMBIGUOUS_CHARM_CODES.has(codeKey) && !grailItemId && !nameIcon);
  const codeIcon = skipCode ? undefined : index.byItemCode.get(codeKey);

  return (
    codeIcon ??
    nameIcon ??
    legacyResolveIconBySlug([
      input.typeName,
      input.parsedName,
      input.itemName,
      input.uniqueName,
      input.setName,
    ]) ??
    legacyNormalizeIconFilename(input.rawIconFileName) ??
    legacyNormalizeIconFilename(input.fallbackIconFileName)
  );
}

function getVaultItemSpatialBackfillRows(ctx: DatabaseContext): VaultItemSpatialBackfillRow[] {
  return ctx.rawDb
    .prepare(
      `
        SELECT
          id,
          raw_item_json,
          item_name,
          item_code,
          grail_item_id,
          source_file_type,
          location_context,
          stash_tab,
          grid_x,
          grid_y,
          grid_width,
          grid_height,
          equipped_slot_id,
          icon_file_name
        FROM vault_items
      `,
    )
    .all() as VaultItemSpatialBackfillRow[];
}

function addMissingVaultItemColumns(ctx: DatabaseContext): void {
  const rows = ctx.rawDb.prepare('PRAGMA table_info(vault_items)').all() as Array<{ name: string }>;
  const columnNames = new Set(rows.map((row) => row.name));
  for (const column of addedVaultItemColumns) {
    if (!columnNames.has(column.name)) {
      ctx.rawDb.exec(`ALTER TABLE vault_items ADD COLUMN ${column.name} ${column.definition}`);
    }
  }
}

interface VaultItemSpatialBackfillValues {
  locationContext: VaultLocationContext;
  stashTab: number | null;
  gridX: number | null;
  gridY: number | null;
  gridWidth: number | null;
  gridHeight: number | null;
  equippedSlotId: number | null;
  iconFileName: string | null;
}

function buildVaultItemSpatialBackfillValues(
  row: VaultItemSpatialBackfillRow,
  parsed: Record<string, unknown> | undefined,
): VaultItemSpatialBackfillValues {
  const parsedItem = parsed as D2SItem | undefined;
  const resolvedSpatial = parsedItem
    ? legacyResolveSpatialLocation({
        item: parsedItem,
        sourceFileType: row.source_file_type,
        fallbackLocation: row.location_context,
        fallbackStashTab: row.stash_tab ?? undefined,
      })
    : undefined;
  const iconFileName =
    legacyResolveIconFilename({
      grailItemId: row.grail_item_id,
      itemCode: row.item_code,
      itemName: row.item_name,
      uniqueName: getOptionalStringValue(parsed, 'unique_name'),
      setName: getOptionalStringValue(parsed, 'set_name'),
      parsedName: getOptionalStringValue(parsed, 'name'),
      typeName: getOptionalStringValue(parsed, 'type_name'),
      rawIconFileName: parsed?.inv_file,
      fallbackIconFileName: row.icon_file_name,
    }) ?? null;

  return {
    locationContext: resolvedSpatial?.locationContext ?? row.location_context,
    stashTab:
      resolvedSpatial?.locationContext === 'stash'
        ? (resolvedSpatial.stashTab ?? row.stash_tab)
        : null,
    gridX: resolvedSpatial?.gridX ?? getOptionalNumericValue(row.grid_x, parsed, 'position_x'),
    gridY: resolvedSpatial?.gridY ?? getOptionalNumericValue(row.grid_y, parsed, 'position_y'),
    gridWidth:
      resolvedSpatial?.gridWidth ?? getOptionalNumericValue(row.grid_width, parsed, 'inv_width'),
    gridHeight:
      resolvedSpatial?.gridHeight ?? getOptionalNumericValue(row.grid_height, parsed, 'inv_height'),
    equippedSlotId:
      resolvedSpatial?.equippedSlotId ??
      getOptionalNumericValue(row.equipped_slot_id, parsed, 'equipped_id'),
    iconFileName,
  };
}

function hasVaultItemBackfillChanges(
  row: VaultItemSpatialBackfillRow,
  nextValues: VaultItemSpatialBackfillValues,
): boolean {
  return (
    row.location_context !== nextValues.locationContext ||
    row.stash_tab !== nextValues.stashTab ||
    row.grid_x !== nextValues.gridX ||
    row.grid_y !== nextValues.gridY ||
    row.grid_width !== nextValues.gridWidth ||
    row.grid_height !== nextValues.gridHeight ||
    row.equipped_slot_id !== nextValues.equippedSlotId ||
    row.icon_file_name !== nextValues.iconFileName
  );
}

/**
 * Re-derives location, grid position and icon of every vault row from its raw item JSON.
 * Rows written before these columns existed only have the raw JSON.
 */
function backfillVaultItemSpatialFields(ctx: DatabaseContext): void {
  const backfillRows = getVaultItemSpatialBackfillRows(ctx);

  const updateStmt = ctx.rawDb.prepare(
    `
      UPDATE vault_items
      SET
        location_context = ?,
        stash_tab = ?,
        grid_x = ?,
        grid_y = ?,
        grid_width = ?,
        grid_height = ?,
        equipped_slot_id = ?,
        icon_file_name = ?
      WHERE id = ?
    `,
  );

  for (const row of backfillRows) {
    const parsed = parseRawJsonObject(row.raw_item_json);
    const nextValues = buildVaultItemSpatialBackfillValues(row, parsed);
    if (!hasVaultItemBackfillChanges(row, nextValues)) {
      continue;
    }
    updateStmt.run(
      nextValues.locationContext,
      nextValues.stashTab,
      nextValues.gridX,
      nextValues.gridY,
      nextValues.gridWidth,
      nextValues.gridHeight,
      nextValues.equippedSlotId,
      nextValues.iconFileName,
      row.id,
    );
  }
}

/**
 * Indexes the migration baseline has but databases created by the legacy schema script lack.
 * Later migrations may refer to them by name.
 *
 * `save_file_states_file_path_unique` is the one known redundancy: the legacy table declared
 * `file_path TEXT NOT NULL UNIQUE`, so SQLite already enforces uniqueness through an implicit
 * `sqlite_autoindex_*` index, which cannot be dropped without rebuilding the table. Creating the
 * named index anyway keeps it available to later migrations (for example `DROP INDEX`) on upgraded
 * databases, at the cost of one extra index on a tiny table. migrator.test.ts pins this as the
 * only unique index an upgraded database has beyond a new database's.
 */
const BASELINE_ALIGNMENT_SQL = `
  CREATE INDEX IF NOT EXISTS idx_vault_items_socketed ON vault_items(is_socketed_item);
  CREATE UNIQUE INDEX IF NOT EXISTS save_file_states_file_path_unique ON save_file_states(file_path);
`;

/**
 * Whether the database has any table other than SQLite's internal tables and the given
 * migrations table, i.e. was not created empty.
 * @param ctx - Database context
 * @param migrationsTable - Name of the table that records applied migrations
 */
export function hasAppTables(ctx: DatabaseContext, migrationsTable: string): boolean {
  const row = ctx.rawDb
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' AND name <> ? LIMIT 1",
    )
    .get(migrationsTable);
  return row !== undefined;
}

/**
 * Brings a database created before schema migrations existed up to the migration baseline
 * (`migrations/0000_baseline.sql`): creates missing tables, indexes and triggers, adds the vault
 * columns that were added later and backfills the vault fields derived from the raw item JSON.
 * Idempotent. Meant to run once per database, inside the caller's transaction, right before the
 * baseline is marked as applied.
 * @param ctx - Database context
 */
export function upgradeLegacyDatabase(ctx: DatabaseContext): void {
  ctx.rawDb.exec(LEGACY_SCHEMA_SQL);
  addMissingVaultItemColumns(ctx);
  ctx.rawDb.exec(BASELINE_ALIGNMENT_SQL);
  backfillVaultItemSpatialFields(ctx);
}
