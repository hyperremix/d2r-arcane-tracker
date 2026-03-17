import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { types as d2sTypes } from '@dschu012/d2s';
import * as d2s from '@dschu012/d2s';
import { BitReader } from '@dschu012/d2s/lib/binary/bitreader';
import { readItem, writeItem } from '@dschu012/d2s/lib/d2/items';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import { constants as constants96 } from '@dschu012/d2s/lib/data/versions/96_constant_data';
import { constants as constants99 } from '@dschu012/d2s/lib/data/versions/99_constant_data';
import type { CharacterClass, VaultLocationContext, VaultSourceFileType } from '../types/grail';
import { constants105Extended, resolveStackCount, SHARED_TAB_COUNT } from './modernStashParser';
import { readD2iMetadata } from './stashFormat';

type StashConstants = {
  constants: d2sTypes.IConstantData;
  version: number;
};

interface MoveSaveFileItemOptions {
  sourceFilePath: string;
  sourceFileType: VaultSourceFileType;
  sourceItemId: number | undefined;
  sourceStashTab?: number;
  sourceGridXFromItem?: number;
  sourceGridYFromItem?: number;
  targetFilePath: string;
  targetFileType: VaultSourceFileType;
  targetLocationContext: VaultLocationContext;
  targetStashTab?: number;
  targetGridX?: number;
  targetGridY?: number;
  targetEquippedSlotId?: number;
}

function getStashConstants(ext: string): StashConstants {
  if (ext === '.d2i') {
    return { constants: constants99, version: 99 };
  }

  return { constants: constants96, version: 96 };
}

function assertWritableD2iBuffer(ext: string, buffer: Buffer): void {
  if (ext !== '.d2i') {
    return;
  }

  const metadata = readD2iMetadata(buffer);
  if (metadata.version >= 105) {
    throw new Error('MODERN_STASH_READ_ONLY');
  }
}

async function assertWritableStashMutationTarget(
  filePath: string,
  fileType: VaultSourceFileType,
): Promise<void> {
  if (fileType !== 'd2i') {
    return;
  }

  const buffer = await readFile(filePath);
  assertWritableD2iBuffer(extname(filePath), buffer);
}

type ConstantItemDefinition = {
  c?: unknown;
  mind?: unknown;
  maxd?: unknown;
  min2d?: unknown;
  max2d?: unknown;
};

type ConstantDataWithItems = {
  armor_items?: Record<string, ConstantItemDefinition>;
  weapon_items?: Record<string, ConstantItemDefinition>;
  other_items?: Record<string, ConstantItemDefinition>;
};

type ItemEquipMetadata = {
  categories?: Set<string>;
  hasOneHandDamage: boolean;
  hasTwoHandDamage: boolean;
};

type EquipValidationCode =
  | 'INVALID_SLOT'
  | 'CLASS_RESTRICTED'
  | 'OFFHAND_WEAPON_RESTRICTED'
  | 'TWO_HANDED_REQUIRES_RIGHT_HAND'
  | 'TWO_HANDED_OFFHAND_OCCUPIED'
  | 'OFFHAND_BLOCKED_BY_TWO_HANDED'
  | 'TARGET_SLOT_OCCUPIED';

const EQUIP_VALIDATION_PREFIX = 'EQUIP_VALIDATION';
const VALID_EQUIPPED_SLOT_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const CLASS_SPECIFIC_CATEGORY_TO_CLASS: Record<string, Exclude<CharacterClass, 'shared_stash'>> = {
  'amazon item': 'amazon',
  'assassin item': 'assassin',
  'barbarian item': 'barbarian',
  'druid item': 'druid',
  'necromancer item': 'necromancer',
  'paladin item': 'paladin',
  'sorceress item': 'sorceress',
};

function toPositiveNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

const ITEM_EQUIP_METADATA_BY_CODE = (() => {
  const map = new Map<string, ItemEquipMetadata>();
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Constant-data normalization covers several table shapes.
  const addConstantData = (constantData: d2sTypes.IConstantData) => {
    const typedConstantData = constantData as unknown as ConstantDataWithItems;
    const entries = [
      typedConstantData.armor_items,
      typedConstantData.weapon_items,
      typedConstantData.other_items,
    ];

    for (const record of entries) {
      if (!record) {
        continue;
      }

      for (const [code, itemDefinition] of Object.entries(record)) {
        const normalizedCode = code.toLowerCase();
        const existing = map.get(normalizedCode) ?? {
          categories: undefined,
          hasOneHandDamage: false,
          hasTwoHandDamage: false,
        };
        let categories = existing.categories;

        if (!Array.isArray(itemDefinition.c)) {
          map.set(normalizedCode, {
            categories,
            hasOneHandDamage:
              existing.hasOneHandDamage ||
              toPositiveNumber(itemDefinition.mind) !== undefined ||
              toPositiveNumber(itemDefinition.maxd) !== undefined,
            hasTwoHandDamage:
              existing.hasTwoHandDamage ||
              toPositiveNumber(itemDefinition.min2d) !== undefined ||
              toPositiveNumber(itemDefinition.max2d) !== undefined,
          });
          continue;
        }

        categories = categories ?? new Set<string>();
        for (const category of itemDefinition.c) {
          if (typeof category === 'string') {
            const normalizedCategory = category.trim().toLowerCase();
            if (normalizedCategory.length > 0) {
              categories.add(normalizedCategory);
            }
          }
        }

        map.set(normalizedCode, {
          categories,
          hasOneHandDamage:
            existing.hasOneHandDamage ||
            toPositiveNumber(itemDefinition.mind) !== undefined ||
            toPositiveNumber(itemDefinition.maxd) !== undefined,
          hasTwoHandDamage:
            existing.hasTwoHandDamage ||
            toPositiveNumber(itemDefinition.min2d) !== undefined ||
            toPositiveNumber(itemDefinition.max2d) !== undefined,
        });
      }
    }
  };

  addConstantData(constants99);
  addConstantData(constants96);
  return map;
})();

function createEquipValidationError(code: EquipValidationCode): Error {
  return new Error(`${EQUIP_VALIDATION_PREFIX}:${code}`);
}

function normalizeOccupiedWeaponSetSlotId(slotId: number): number {
  if (slotId === 13) {
    return 11;
  }

  if (slotId === 14) {
    return 12;
  }

  return slotId;
}

function normalizeWeaponSetSlotId(slotId: number): number {
  if (slotId === 11 || slotId === 13) {
    return 4;
  }

  if (slotId === 12 || slotId === 14) {
    return 5;
  }

  return slotId;
}

function resolveItemCode(item: d2sTypes.IItem): string | undefined {
  const rawCode =
    (item as { code?: unknown; type?: unknown }).code ?? (item as { type?: unknown }).type;
  if (typeof rawCode !== 'string' || rawCode.trim().length === 0) {
    return undefined;
  }

  return rawCode.toLowerCase();
}

function resolveItemEquipMetadata(item: d2sTypes.IItem): ItemEquipMetadata {
  const code = resolveItemCode(item);
  if (!code) {
    return {
      categories: undefined,
      hasOneHandDamage: false,
      hasTwoHandDamage: false,
    };
  }

  return (
    ITEM_EQUIP_METADATA_BY_CODE.get(code) ?? {
      categories: undefined,
      hasOneHandDamage: false,
      hasTwoHandDamage: false,
    }
  );
}

function isWeaponLikeCategorySet(categories: Set<string> | undefined): boolean {
  if (!categories) {
    return false;
  }

  return [...categories].some((category) => category.includes('weapon'));
}

function isShieldCategorySet(categories: Set<string> | undefined): boolean {
  if (!categories) {
    return false;
  }

  return [...categories].some((category) => category.includes('shield'));
}

function isSwordCategorySet(categories: Set<string> | undefined): boolean {
  if (!categories) {
    return false;
  }

  return [...categories].some((category) => category.includes('sword'));
}

function isClawCategorySet(categories: Set<string> | undefined): boolean {
  if (!categories) {
    return false;
  }

  return [...categories].some((category) => category.includes('hand to hand'));
}

function resolveRequiredCharacterClass(
  categories: Set<string> | undefined,
): Exclude<CharacterClass, 'shared_stash'> | undefined {
  if (!categories) {
    return undefined;
  }

  for (const [category, characterClass] of Object.entries(CLASS_SPECIFIC_CATEGORY_TO_CLASS)) {
    if (categories.has(category)) {
      return characterClass;
    }
  }

  return undefined;
}

function normalizeCharacterClass(rawClass: unknown): CharacterClass | undefined {
  if (typeof rawClass !== 'string' || rawClass.trim().length === 0) {
    return undefined;
  }

  const normalized = rawClass.trim().toLowerCase();
  const compact = normalized.replace(/ /g, '').replace(/_/g, '');

  switch (compact) {
    case 'amazon':
    case 'ama':
      return 'amazon';
    case 'assassin':
    case 'ass':
      return 'assassin';
    case 'barbarian':
    case 'barb':
    case 'bar':
      return 'barbarian';
    case 'druid':
    case 'dru':
      return 'druid';
    case 'necromancer':
    case 'necro':
    case 'nec':
      return 'necromancer';
    case 'paladin':
    case 'pal':
      return 'paladin';
    case 'sorceress':
    case 'sorc':
    case 'sor':
      return 'sorceress';
    case 'sharedstash':
      return 'shared_stash';
    default:
      return undefined;
  }
}

function resolveTargetCharacterClass(data: d2sTypes.ID2S): CharacterClass | undefined {
  return normalizeCharacterClass((data as { header?: { class?: unknown } }).header?.class);
}

function resolveWeaponSet(slotId: number): 'i' | 'ii' | undefined {
  const normalizedSlotId = normalizeOccupiedWeaponSetSlotId(slotId);
  if (normalizedSlotId === 4 || normalizedSlotId === 5) {
    return 'i';
  }

  if (normalizedSlotId === 11 || normalizedSlotId === 12) {
    return 'ii';
  }

  return undefined;
}

function resolveEquippedSlotId(item: d2sTypes.IItem): number | undefined {
  const slotId = normalizeItemId((item as { equipped_id?: unknown }).equipped_id);
  if (!slotId) {
    return undefined;
  }

  const normalizedSlotId = normalizeOccupiedWeaponSetSlotId(slotId);
  if (!VALID_EQUIPPED_SLOT_IDS.has(normalizedSlotId)) {
    return undefined;
  }

  return normalizedSlotId;
}

function buildEquippedSlotMap(items: d2sTypes.IItem[]): Map<number, d2sTypes.IItem> {
  const map = new Map<number, d2sTypes.IItem>();
  for (const item of items) {
    const slotId = resolveEquippedSlotId(item);
    if (!slotId || map.has(slotId)) {
      continue;
    }

    map.set(slotId, item);
  }

  return map;
}

function isTwoHandedRequiredWeaponForCharacter(
  item: d2sTypes.IItem,
  targetCharacterClass: CharacterClass | undefined,
): boolean {
  const metadata = resolveItemEquipMetadata(item);
  const barbarianTwoHandedSwordException =
    targetCharacterClass === 'barbarian' &&
    isSwordCategorySet(metadata.categories) &&
    metadata.hasTwoHandDamage;

  return (
    isWeaponLikeCategorySet(metadata.categories) &&
    metadata.hasTwoHandDamage &&
    !metadata.hasOneHandDamage &&
    !barbarianTwoHandedSwordException
  );
}

function resolveEligibleEquippedSlots(item: d2sTypes.IItem): Set<number> | undefined {
  const { categories } = resolveItemEquipMetadata(item);
  const slots = new Set<number>();

  if (!categories || categories.size === 0) {
    return undefined;
  }

  const isRing = categories.has('ring');
  const isAmulet = categories.has('amulet');
  const isHelm = categories.has('helm');
  const isGloves = categories.has('gloves');
  const isBoots = categories.has('boots');
  const isBelt = categories.has('belt');
  const isShield = categories.has('shield') || categories.has('any shield');
  const isWeaponLike = isWeaponLikeCategorySet(categories);
  const isBodyArmor = categories.has('armor') || categories.has('any armor');
  const hasSpecificArmorPieceCategory = isHelm || isGloves || isBoots || isBelt || isShield;

  if (isRing) {
    slots.add(6);
    slots.add(7);
  }

  if (isAmulet) {
    slots.add(2);
  }

  if (isHelm) {
    slots.add(1);
  }

  if (isGloves) {
    slots.add(10);
  }

  if (isBoots) {
    slots.add(9);
  }

  if (isBelt) {
    slots.add(8);
  }

  if (isShield) {
    slots.add(5);
  }

  if (isWeaponLike) {
    slots.add(4);
    slots.add(5);
  }

  if (isBodyArmor && !hasSpecificArmorPieceCategory) {
    slots.add(3);
  }

  return slots;
}

function assertEligibleForEquippedSlot(item: d2sTypes.IItem, targetSlotId: number): void {
  const normalizedTargetSlotId = normalizeWeaponSetSlotId(targetSlotId);
  const eligibleSlots = resolveEligibleEquippedSlots(item);
  if (!eligibleSlots || eligibleSlots.size === 0) {
    throw createEquipValidationError('INVALID_SLOT');
  }

  if (!eligibleSlots.has(normalizedTargetSlotId)) {
    throw createEquipValidationError('INVALID_SLOT');
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Equip validation intentionally combines slot, class, and handedness rules.
function assertEquipValidationRules(
  item: d2sTypes.IItem,
  targetSlotId: number,
  equippedItems: d2sTypes.IItem[],
  targetCharacterClass: CharacterClass | undefined,
): void {
  const normalizedTargetSlotId = normalizeWeaponSetSlotId(targetSlotId);
  const normalizedOccupiedTargetSlotId = normalizeOccupiedWeaponSetSlotId(targetSlotId);
  const equippedSlots = buildEquippedSlotMap(equippedItems);

  if (equippedSlots.has(normalizedOccupiedTargetSlotId)) {
    throw createEquipValidationError('TARGET_SLOT_OCCUPIED');
  }

  assertEligibleForEquippedSlot(item, targetSlotId);

  const metadata = resolveItemEquipMetadata(item);
  const requiredClass = resolveRequiredCharacterClass(metadata.categories);
  if (requiredClass && targetCharacterClass !== requiredClass) {
    throw createEquipValidationError('CLASS_RESTRICTED');
  }

  const targetWeaponSet = resolveWeaponSet(normalizedOccupiedTargetSlotId);
  if (!targetWeaponSet) {
    return;
  }

  const rightSlotId = targetWeaponSet === 'ii' ? 11 : 4;
  const leftSlotId = targetWeaponSet === 'ii' ? 12 : 5;
  const rightHandItem = equippedSlots.get(rightSlotId);

  if (
    normalizedTargetSlotId === 5 &&
    rightHandItem &&
    isTwoHandedRequiredWeaponForCharacter(rightHandItem, targetCharacterClass)
  ) {
    throw createEquipValidationError('OFFHAND_BLOCKED_BY_TWO_HANDED');
  }

  const isWeaponLike = isWeaponLikeCategorySet(metadata.categories);
  const isShieldLike = isShieldCategorySet(metadata.categories);
  const isTwoHandedRequired = isTwoHandedRequiredWeaponForCharacter(item, targetCharacterClass);

  if (isTwoHandedRequired) {
    if (normalizedTargetSlotId !== 4) {
      throw createEquipValidationError('TWO_HANDED_REQUIRES_RIGHT_HAND');
    }

    if (equippedSlots.has(leftSlotId)) {
      throw createEquipValidationError('TWO_HANDED_OFFHAND_OCCUPIED');
    }
  }

  if (normalizedTargetSlotId === 5 && isWeaponLike && !isShieldLike) {
    const barbarianAllowed =
      targetCharacterClass === 'barbarian' &&
      (metadata.hasOneHandDamage ||
        (isSwordCategorySet(metadata.categories) && metadata.hasTwoHandDamage));
    const assassinAllowed =
      targetCharacterClass === 'assassin' && isClawCategorySet(metadata.categories);

    if (!barbarianAllowed && !assassinAllowed) {
      throw createEquipValidationError('OFFHAND_WEAPON_RESTRICTED');
    }
  }
}

function normalizeItemId(rawId: unknown): number | undefined {
  if (typeof rawId === 'number' && Number.isInteger(rawId)) {
    return rawId;
  }

  if (typeof rawId === 'string' && rawId.trim().length > 0) {
    const parsed = Number.parseInt(rawId, 10);
    return Number.isInteger(parsed) ? parsed : undefined;
  }

  return undefined;
}

function itemMatchesId(item: d2sTypes.IItem, itemId: number): boolean {
  return normalizeItemId((item as { id?: unknown }).id) === itemId;
}

function findItemById(items: d2sTypes.IItem[], itemId: number): d2sTypes.IItem | undefined {
  return items.find((item) => itemMatchesId(item, itemId));
}

function extractItemById(items: d2sTypes.IItem[], itemId: number): d2sTypes.IItem | undefined {
  const index = items.findIndex((item) => itemMatchesId(item, itemId));
  if (index < 0) {
    return undefined;
  }

  const [removed] = items.splice(index, 1);
  return removed;
}

function withTargetCoordinates(
  item: d2sTypes.IItem,
  targetGridX?: number,
  targetGridY?: number,
): d2sTypes.IItem {
  if (targetGridX === undefined || targetGridY === undefined) {
    return item;
  }

  return {
    ...item,
    position_x: targetGridX,
    position_y: targetGridY,
  };
}

function withD2SLocationContext(
  item: d2sTypes.IItem,
  locationContext: VaultLocationContext,
  equippedItems: d2sTypes.IItem[],
  targetCharacterClass: CharacterClass | undefined,
  targetEquippedSlotId?: number,
): d2sTypes.IItem {
  switch (locationContext) {
    case 'inventory':
      return {
        ...item,
        location_id: 0,
        alt_position_id: 1,
        equipped_id: 0,
      };
    case 'stash':
      return {
        ...item,
        location_id: 0,
        alt_position_id: 5,
        equipped_id: 0,
      };
    case 'equipped':
      if (targetEquippedSlotId !== undefined) {
        assertEquipValidationRules(item, targetEquippedSlotId, equippedItems, targetCharacterClass);
      }

      return {
        ...item,
        location_id: 1,
        alt_position_id: 0,
        equipped_id: targetEquippedSlotId ?? item.equipped_id ?? 0,
        position_x: 0,
        position_y: 0,
      };
    case 'mercenary':
      return {
        ...item,
        location_id: 3,
        alt_position_id: 0,
        equipped_id: 0,
      };
    case 'corpse':
      return {
        ...item,
        location_id: 3,
        alt_position_id: 0,
        equipped_id: 0,
      };
    default:
      return item;
  }
}

async function findItemInSaveFile(
  filePath: string,
  fileType: VaultSourceFileType,
  itemId: number,
): Promise<d2sTypes.IItem | undefined> {
  const buffer = await readFile(filePath);

  if (fileType === 'd2s') {
    const data = await d2s.read(buffer);
    return (
      findItemById(data.items, itemId) ??
      findItemById(data.corpse_items, itemId) ??
      findItemById(data.merc_items, itemId)
    );
  }

  const ext = extname(filePath);

  if (ext === '.d2i') {
    const metadata = readD2iMetadata(buffer);
    if (metadata.version >= 105) {
      return findItemInModernStashSharedPage(filePath, itemId);
    }
  }

  const { constants } = getStashConstants(ext);
  const data = await d2stash.read(buffer, constants);

  for (const page of data.pages) {
    const found = findItemById(page.items, itemId);
    if (found) {
      return found;
    }
  }

  return undefined;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Handles d2s, classic stash, and modern d2i move paths in a single coordinated function. Splitting further would require passing complex partial state between helpers.
async function moveItemWithinSingleSaveFile(options: MoveSaveFileItemOptions): Promise<void> {
  const { sourceFilePath, sourceFileType, sourceItemId } = options;
  const buffer = await readFile(sourceFilePath);

  if (sourceFileType === 'd2s') {
    // Non-d2i paths always receive a numeric item id (non-simple items only).
    const numericItemId = sourceItemId as number;
    const data = await d2s.read(buffer);
    const sourceItem =
      extractItemById(data.items, numericItemId) ??
      extractItemById(data.corpse_items, numericItemId) ??
      extractItemById(data.merc_items, numericItemId);

    if (!sourceItem) {
      throw new Error('Source item not found in save file');
    }

    const itemToWrite = withD2SLocationContext(
      withTargetCoordinates(sourceItem, options.targetGridX, options.targetGridY),
      options.targetLocationContext,
      data.items,
      resolveTargetCharacterClass(data),
      options.targetEquippedSlotId,
    );

    if (options.targetLocationContext === 'mercenary') {
      data.merc_items.push(itemToWrite);
    } else if (options.targetLocationContext === 'corpse') {
      data.corpse_items.push(itemToWrite);
    } else {
      data.items.push(itemToWrite);
    }

    const result = await d2s.write(data);
    await writeFile(sourceFilePath, Buffer.from(result));
    return;
  }

  const ext = extname(sourceFilePath);

  if (ext === '.d2i') {
    const metadata = readD2iMetadata(buffer);
    if (metadata.version >= 105) {
      const targetTab = options.targetStashTab ?? 0;
      if (targetTab >= SHARED_TAB_COUNT) {
        throw new Error('MODERN_STASH_READ_ONLY');
      }
      const sourceItem = await findItemInModernStashSharedPage(
        sourceFilePath,
        sourceItemId,
        options.sourceStashTab,
        options.sourceGridXFromItem,
        options.sourceGridYFromItem,
      );
      if (!sourceItem) {
        throw new Error('Source item not found in stash file');
      }
      await addItemToModernStashSharedPage(
        sourceFilePath,
        sourceItem,
        targetTab,
        options.targetGridX ?? 0,
        options.targetGridY ?? 0,
      );
      await removeItemFromModernStashSharedPage(
        sourceFilePath,
        sourceItemId,
        options.sourceStashTab,
        options.sourceGridXFromItem,
        options.sourceGridYFromItem,
      );
      return;
    }
  }

  assertWritableD2iBuffer(ext, buffer);
  const { constants, version } = getStashConstants(ext);
  const data = await d2stash.read(buffer, constants);
  // Classic stash paths always receive a numeric id (non-modern d2i handled above).
  const classicItemId = sourceItemId as number;
  let sourceItem: d2sTypes.IItem | undefined;

  for (const page of data.pages) {
    const extracted = extractItemById(page.items, classicItemId);
    if (extracted) {
      sourceItem = extracted;
      break;
    }
  }

  if (!sourceItem) {
    throw new Error('Source item not found in stash file');
  }

  const itemToWrite = withTargetCoordinates(sourceItem, options.targetGridX, options.targetGridY);
  const targetTab = options.targetStashTab ?? 0;

  while (data.pages.length <= targetTab) {
    data.pages.push({ name: '', type: 0, items: [] });
    data.pageCount = data.pages.length;
  }

  data.pages[targetTab].items.push(itemToWrite);

  const result = await d2stash.write(data, constants, version);
  await writeFile(sourceFilePath, Buffer.from(result));
}

export async function removeItemFromSaveFile(
  filePath: string,
  fileType: VaultSourceFileType,
  itemId: number,
): Promise<void> {
  const buffer = await readFile(filePath);

  if (fileType === 'd2s') {
    const data = await d2s.read(buffer);
    data.items = data.items.filter((item: d2sTypes.IItem) => !itemMatchesId(item, itemId));
    data.corpse_items = data.corpse_items.filter(
      (item: d2sTypes.IItem) => !itemMatchesId(item, itemId),
    );
    data.merc_items = data.merc_items.filter(
      (item: d2sTypes.IItem) => !itemMatchesId(item, itemId),
    );
    const result = await d2s.write(data);
    await writeFile(filePath, Buffer.from(result));
    return;
  }

  const ext = extname(filePath);

  if (ext === '.d2i') {
    const metadata = readD2iMetadata(buffer);
    if (metadata.version >= 105) {
      await removeItemFromModernStashSharedPage(filePath, itemId);
      return;
    }
  }

  assertWritableD2iBuffer(ext, buffer);
  const { constants, version } = getStashConstants(ext);
  const data = await d2stash.read(buffer, constants);

  for (const page of data.pages) {
    page.items = page.items.filter((item) => !itemMatchesId(item, itemId));
  }

  const result = await d2stash.write(data, constants, version);
  await writeFile(filePath, Buffer.from(result));
}

// Size in bytes of the sector header in a .d2i file.
const D2I_SECTOR_HEADER_SIZE = 64;
// Byte offset within the sector header where the total sector size (header + payload) is stored.
const D2I_SECTOR_SIZE_FIELD_OFFSET = 16;
// Resource-stash stack-count magic attribute ID (9-bit unsigned, D2R-only).
const RESOURCE_STASH_ATTR_ID = 381;

/**
 * Appends one item to a shared stash sector (tabs 0–4) inside a modern .d2i file.
 * The sector payload is a standard JM item list. We binary-splice: reuse existing
 * item bytes unchanged and only serialize the new item, then patch the count field
 * and sector size and rebuild the file buffer.
 */
// Byte offsets within a JM item-list header.
const JM_ITEM_COUNT_OFFSET = 2; // bytes 2-3 = LE uint16 item count
const JM_ITEM_DATA_OFFSET = 4; // item bytes start at byte 4

/**
 * Rebuilds a .d2i buffer, replacing one sector's payload with `newPayload`.
 * All other sectors are kept byte-for-byte identical.
 */
function rebuildD2iBuffer(
  buffer: Buffer,
  sectors: Array<{ offset: number; size: number }>,
  targetSectorOffset: number,
  newPayload: Buffer,
): Buffer {
  const parts: Buffer[] = [];
  for (const sector of sectors) {
    const header = Buffer.from(
      buffer.subarray(sector.offset, sector.offset + D2I_SECTOR_HEADER_SIZE),
    );
    if (sector.offset === targetSectorOffset) {
      header.writeUInt32LE(
        D2I_SECTOR_HEADER_SIZE + newPayload.length,
        D2I_SECTOR_SIZE_FIELD_OFFSET,
      );
      parts.push(header, newPayload);
    } else {
      const sectorData = buffer.subarray(
        sector.offset + D2I_SECTOR_HEADER_SIZE,
        sector.offset + sector.size,
      );
      parts.push(header, Buffer.from(sectorData));
    }
  }
  return Buffer.concat(parts);
}

/**
 * Returns true if an item matches the given identifier — by numeric id when
 * available (non-simple items), or by grid position (simple items like gems/runes).
 */
function itemMatchesLocator(
  item: d2sTypes.IItem,
  itemId: number | undefined,
  gridX?: number,
  gridY?: number,
): boolean {
  if (gridX !== undefined && gridY !== undefined) {
    // When source coordinates are known (modern drag/drop and stack-pickup flows),
    // treat them as the authoritative locator. Falling back to id here can remove
    // the just-inserted copy during same-tab moves because both items share id
    // until the source is removed.
    return item.position_x === gridX && item.position_y === gridY;
  }
  if (itemId !== undefined && itemMatchesId(item, itemId)) {
    return true;
  }
  return false;
}

function stripResourceStashStackMetadata(item: d2sTypes.IItem): d2sTypes.IItem {
  const magicAttributes = item.magic_attributes as Array<{ id?: unknown }> | undefined;
  if (!Array.isArray(magicAttributes)) {
    return item;
  }

  const isResourceStackAttributeId = (value: unknown): boolean => {
    if (value === RESOURCE_STASH_ATTR_ID) {
      return true;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number.parseInt(value, 10);
      return Number.isInteger(parsed) && parsed === RESOURCE_STASH_ATTR_ID;
    }

    return false;
  };

  const hasResourceStashStackAttribute = magicAttributes.some((attribute) =>
    isResourceStackAttributeId(attribute?.id),
  );
  if (!hasResourceStashStackAttribute) {
    return item;
  }

  return {
    ...item,
    quantity: 1,
    magic_attributes: magicAttributes.filter(
      (attribute) => !isResourceStackAttributeId(attribute?.id),
    ),
    id: undefined,
  };
}

function withUpdatedResourceStackCount(item: d2sTypes.IItem, newCount: number): d2sTypes.IItem {
  const magicAttributes = item.magic_attributes as
    | Array<{ id?: unknown; values?: unknown; [key: string]: unknown }>
    | undefined;

  if (!Array.isArray(magicAttributes)) {
    return { ...item, quantity: newCount };
  }

  let hasResourceStackAttribute = false;
  const nextMagicAttributes = magicAttributes.map((attribute) => {
    const rawId = attribute?.id;
    const normalizedId =
      typeof rawId === 'string' && rawId.trim().length > 0 ? Number.parseInt(rawId, 10) : rawId;

    if (normalizedId !== RESOURCE_STASH_ATTR_ID) {
      return attribute;
    }

    hasResourceStackAttribute = true;
    return {
      ...attribute,
      values: [newCount],
    };
  });

  if (!hasResourceStackAttribute) {
    return { ...item, quantity: newCount };
  }

  return {
    ...item,
    quantity: newCount,
    magic_attributes: nextMagicAttributes,
  };
}

/**
 * Finds an item in the shared stash sectors (JM sectors 0–SHARED_TAB_COUNT-1)
 * of a modern .d2i file. Matches by numeric id when present (non-simple items),
 * or by grid position (simple items like gems/runes that have no stored id).
 * Returns undefined if not found.
 */
async function findItemInModernStashSharedPage(
  filePath: string,
  itemId: number | undefined,
  stashTab?: number,
  gridX?: number,
  gridY?: number,
): Promise<d2sTypes.IItem | undefined> {
  const buffer = await readFile(filePath);
  const metadata = readD2iMetadata(buffer);

  const jmSectors = metadata.sectors
    .map((sector, index) => ({ sectorIndex: index, ...sector }))
    .filter((s) => s.payloadSignature === 'JM')
    .sort((a, b) => a.sectorIndex - b.sectorIndex);

  const config = { extendedStash: false, sortProperties: true };
  const constants = constants105Extended as unknown as d2sTypes.IConstantData;

  const startIdx = stashTab !== undefined ? stashTab : 0;
  const endIdx = stashTab !== undefined ? stashTab + 1 : SHARED_TAB_COUNT;

  for (let jmIdx = startIdx; jmIdx < endIdx && jmIdx < jmSectors.length; jmIdx++) {
    const targetSector = jmSectors[jmIdx];
    const payload = Buffer.from(
      buffer.subarray(
        targetSector.payloadOffset,
        targetSector.payloadOffset + targetSector.payloadSize,
      ),
    );

    if (payload.length < JM_ITEM_DATA_OFFSET || payload.toString('ascii', 0, 2) !== 'JM') {
      continue;
    }

    const count = payload.readUInt16LE(JM_ITEM_COUNT_OFFSET);
    const reader = new BitReader(payload);
    reader.ReadString(2); // skip "JM"
    reader.ReadUInt16(); // skip count

    for (let i = 0; i < count; i++) {
      let item: d2sTypes.IItem;
      try {
        item = await readItem(reader, metadata.version, constants, config);
      } catch {
        // Cannot parse this item — stop searching this sector (reader offset unknown)
        break;
      }
      if (itemMatchesLocator(item, itemId, gridX, gridY)) {
        return item;
      }
    }
  }

  return undefined;
}

/**
 * Removes an item from the shared stash sectors (JM sectors 0–SHARED_TAB_COUNT-1)
 * of a modern .d2i file. Matches by numeric id (non-simple items) or by grid
 * position (simple items like gems/runes that have no stored id).
 *
 * Uses binary splice: items are parsed one-by-one and parsing stops as soon as
 * the target is matched. Items after the target are kept as raw bytes without
 * further parsing — this prevents failures for items with unsupported attributes.
 *
 * Throws if the item is not found in any shared tab.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Handles multi-sector search, per-item parsing with early exit, binary splice, and graceful fallback — each branch is necessary.
async function removeItemFromModernStashSharedPage(
  filePath: string,
  itemId: number | undefined,
  stashTab?: number,
  gridX?: number,
  gridY?: number,
): Promise<void> {
  const buffer = await readFile(filePath);
  const metadata = readD2iMetadata(buffer);

  const jmSectors = metadata.sectors
    .map((sector, index) => ({ sectorIndex: index, ...sector }))
    .filter((s) => s.payloadSignature === 'JM')
    .sort((a, b) => a.sectorIndex - b.sectorIndex);

  const config = { extendedStash: false, sortProperties: true };
  const constants = constants105Extended as unknown as d2sTypes.IConstantData;

  const startIdx = stashTab !== undefined ? stashTab : 0;
  const endIdx = stashTab !== undefined ? stashTab + 1 : SHARED_TAB_COUNT;

  for (let jmIdx = startIdx; jmIdx < endIdx && jmIdx < jmSectors.length; jmIdx++) {
    const targetSector = jmSectors[jmIdx];
    const payload = Buffer.from(
      buffer.subarray(
        targetSector.payloadOffset,
        targetSector.payloadOffset + targetSector.payloadSize,
      ),
    );

    if (payload.length < JM_ITEM_DATA_OFFSET || payload.toString('ascii', 0, 2) !== 'JM') {
      continue;
    }

    const count = payload.readUInt16LE(JM_ITEM_COUNT_OFFSET);
    const reader = new BitReader(payload);
    reader.ReadString(2); // skip "JM"
    reader.ReadUInt16(); // skip count

    let matchStartByte: number | undefined;
    let matchEndByte: number | undefined;

    // Parse items one-by-one and stop as soon as the target is found.
    // Items after the match are NOT parsed — their raw bytes are spliced verbatim.
    // This prevents "Save Bits is undefined" failures for items with unsupported
    // magic attributes that happen to sit after the target in the same sector.
    for (let i = 0; i < count; i++) {
      const startBit = reader.offset;
      let item: d2sTypes.IItem;
      try {
        item = await readItem(reader, metadata.version, constants, config);
      } catch {
        // Cannot parse this item — if we haven't found the target yet, abort
        break;
      }
      const endBit = reader.offset;

      if (itemMatchesLocator(item, itemId, gridX, gridY)) {
        matchStartByte = startBit / 8;
        matchEndByte = endBit / 8;
        break; // Stop here — do not parse any further items
      }
    }

    if (matchStartByte === undefined || matchEndByte === undefined) {
      continue; // Not found in this sector — try next
    }

    const beforeBytes = payload.subarray(JM_ITEM_DATA_OFFSET, matchStartByte);
    // afterBytes covers all remaining raw item bytes from the item after the match
    const afterBytes = payload.subarray(matchEndByte);

    const newHeader = Buffer.alloc(JM_ITEM_DATA_OFFSET);
    newHeader.write('JM', 0, 'ascii');
    newHeader.writeUInt16LE(count - 1, JM_ITEM_COUNT_OFFSET);
    const newPayload = Buffer.concat([newHeader, beforeBytes, afterBytes]);

    await writeFile(
      filePath,
      rebuildD2iBuffer(buffer, metadata.sectors, targetSector.offset, newPayload),
    );
    return;
  }

  throw new Error('Item not found in any modern stash shared tab');
}

async function addItemToModernStashSharedPageBuffer(
  buffer: Buffer,
  item: d2sTypes.IItem,
  stashTab: number,
  gridX: number,
  gridY: number,
): Promise<Buffer> {
  const metadata = readD2iMetadata(buffer);

  const jmSectors = metadata.sectors
    .map((sector, index) => ({ sectorIndex: index, ...sector }))
    .filter((s) => s.payloadSignature === 'JM')
    .sort((a, b) => a.sectorIndex - b.sectorIndex);

  if (stashTab >= jmSectors.length) {
    throw new Error(
      `Stash tab ${stashTab} not found in modern stash (${jmSectors.length} JM sectors)`,
    );
  }

  const targetSector = jmSectors[stashTab];
  const payload = Buffer.from(
    buffer.subarray(
      targetSector.payloadOffset,
      targetSector.payloadOffset + targetSector.payloadSize,
    ),
  );

  if (payload.length < JM_ITEM_DATA_OFFSET || payload.toString('ascii', 0, 2) !== 'JM') {
    throw new Error(`Invalid JM sector payload for stash tab ${stashTab}`);
  }

  const existingCount = payload.readUInt16LE(JM_ITEM_COUNT_OFFSET);

  // Strip the resource-stash quantity attribute and set correct stash location fields.
  // We only serialize the NEW item — existing items are kept as raw bytes, avoiding
  // the need to parse them (which would fail for items with stats that lack sB).
  const normalizedItem = stripResourceStashStackMetadata(item);
  const isSimpleItem = (normalizedItem as { simple_item?: unknown }).simple_item === 1;
  const newItem: d2sTypes.IItem = {
    ...normalizedItem,
    location_id: 0,
    alt_position_id: 5,
    equipped_id: 0,
    position_x: gridX,
    position_y: gridY,
    quantity: 1,
    // Keep ids for non-simple items so they remain movable after repeated shared-tab moves.
    // Simple resource-derived items are intentionally id-less.
    id: isSimpleItem ? undefined : normalizedItem.id,
  };

  const config = { extendedStash: false, sortProperties: true };
  const constants = constants105Extended as unknown as d2sTypes.IConstantData;
  const newItemBytes = Buffer.from(await writeItem(newItem, metadata.version, constants, config));

  // Some modern sectors may contain trailing bytes after the counted item stream.
  // If we can parse all existing items, insert new item bytes before that trailing tail.
  // Otherwise, fall back to appending at the payload end (legacy behavior).
  let existingItemBytes = payload.subarray(JM_ITEM_DATA_OFFSET);
  let trailingBytes = Buffer.alloc(0);
  try {
    const reader = new BitReader(payload);
    reader.ReadString(2); // skip "JM"
    reader.ReadUInt16(); // skip count

    for (let i = 0; i < existingCount; i += 1) {
      await readItem(reader, metadata.version, constants, config);
    }

    const itemDataEndByte = reader.offset / 8;
    existingItemBytes = payload.subarray(JM_ITEM_DATA_OFFSET, itemDataEndByte);
    trailingBytes = payload.subarray(itemDataEndByte);
  } catch {
    // Keep fallback (append at end) if we cannot safely parse all existing items.
  }

  // Binary splice: reuse the raw existing-item bytes and prepend the serialized new item.
  // Prepending makes newly placed items visible even when parsing later existing items fails
  // (for example, unsupported/modded attrs in shared tabs).
  // If trailing bytes are present, keep them after the item stream.
  const newHeader = Buffer.alloc(JM_ITEM_DATA_OFFSET);
  newHeader.write('JM', 0, 'ascii');
  newHeader.writeUInt16LE(existingCount + 1, JM_ITEM_COUNT_OFFSET);
  const newPayload = Buffer.concat([newHeader, newItemBytes, existingItemBytes, trailingBytes]);

  return rebuildD2iBuffer(buffer, metadata.sectors, targetSector.offset, newPayload);
}

async function addItemToModernStashSharedPage(
  filePath: string,
  item: d2sTypes.IItem,
  stashTab: number,
  gridX: number,
  gridY: number,
): Promise<void> {
  const buffer = await readFile(filePath);
  const nextBuffer = await addItemToModernStashSharedPageBuffer(
    buffer,
    item,
    stashTab,
    gridX,
    gridY,
  );
  await writeFile(filePath, nextBuffer);
}

export async function addItemToSaveFile(
  filePath: string,
  fileType: VaultSourceFileType,
  item: d2sTypes.IItem,
  locationContext: VaultLocationContext,
  stashTab?: number,
  targetGridX?: number,
  targetGridY?: number,
  targetEquippedSlotId?: number,
): Promise<void> {
  const buffer = await readFile(filePath);
  const normalizedItem = stripResourceStashStackMetadata(item);

  if (fileType === 'd2s') {
    const data = await d2s.read(buffer);
    const itemToWrite = withD2SLocationContext(
      withTargetCoordinates(normalizedItem, targetGridX, targetGridY),
      locationContext,
      data.items,
      resolveTargetCharacterClass(data),
      targetEquippedSlotId,
    );

    if (locationContext === 'mercenary') {
      data.merc_items.push(itemToWrite);
    } else if (locationContext === 'corpse') {
      data.corpse_items.push(itemToWrite);
    } else {
      data.items.push(itemToWrite);
    }

    const result = await d2s.write(data);
    await writeFile(filePath, Buffer.from(result));
    return;
  }

  const ext = extname(filePath);

  // Modern .d2i: shared stash pages (tabs 0–4) are writable via sector patching.
  if (
    ext === '.d2i' &&
    locationContext === 'stash' &&
    typeof stashTab === 'number' &&
    stashTab < SHARED_TAB_COUNT
  ) {
    await addItemToModernStashSharedPage(
      filePath,
      item,
      stashTab,
      targetGridX ?? 0,
      targetGridY ?? 0,
    );
    return;
  }

  assertWritableD2iBuffer(ext, buffer);
  const { constants, version } = getStashConstants(ext);
  const data = await d2stash.read(buffer, constants);
  const itemToWrite = withTargetCoordinates(normalizedItem, targetGridX, targetGridY);

  const targetTab = stashTab ?? 0;

  while (data.pages.length <= targetTab) {
    data.pages.push({ name: '', type: 0, items: [] });
    data.pageCount = data.pages.length;
  }

  data.pages[targetTab].items.push(itemToWrite);

  const result = await d2stash.write(data, constants, version);
  await writeFile(filePath, Buffer.from(result));
}

interface SplitStackTarget {
  targetFilePath: string;
  targetFileType: VaultSourceFileType;
  targetLocationContext: VaultLocationContext;
  targetStashTab?: number;
  targetGridX: number;
  targetGridY: number;
}

interface SplitStackOptions {
  sourceFilePath: string;
  sourceFileType: VaultSourceFileType;
  sourceStashTab: number;
  sourceItemCode: string;
  /** Raw JSON of the source IItem. Required when sourceFileType is 'd2i' (modern stash). */
  sourceRawItemJson?: string;
  splitCount: number;
  targets: SplitStackTarget[];
}

function normalizeItemCode(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim().replace(/\0/g, '').toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function findItemByCode(items: d2sTypes.IItem[], code: string): d2sTypes.IItem | undefined {
  return items.find((item) => {
    const itemCode = normalizeItemCode(
      (item as { code?: unknown; type?: unknown }).code ?? (item as { type?: unknown }).type,
    );
    return itemCode === code;
  });
}

function getItemQuantity(item: d2sTypes.IItem): number {
  const qty = (item as { quantity?: unknown }).quantity;
  if (typeof qty === 'number' && Number.isInteger(qty) && qty >= 1) {
    return qty;
  }
  return 1;
}

function withQuantityOne(item: d2sTypes.IItem): d2sTypes.IItem {
  return { ...item, quantity: 1 };
}

function withReducedQuantity(item: d2sTypes.IItem, reduceBy: number): d2sTypes.IItem {
  const current = getItemQuantity(item);
  const next = Math.max(0, current - reduceBy);
  return { ...item, quantity: next };
}

/**
 * Reduces the quantity of a stackable item in a modern stash resource sector (runes/gems/materials).
 * Removes the item entirely if its quantity reaches zero.
 *
 * Searches ALL resource sectors (JM sectors at index >= SHARED_TAB_COUNT) for the best matching
 * source entry by item code and optional source hints. Uses binary splice: only the modified item
 * is re-serialized; all other items keep their original raw bytes, avoiding round-trip data loss.
 */
interface ModernResourceSector {
  sectorIndex: number;
  offset: number;
  size: number;
  payloadOffset: number;
  payloadSize: number;
}

interface ResourceSectorItemEntry {
  sector: ModernResourceSector;
  count: number;
  startByte: number;
  endByte: number;
  item: d2sTypes.IItem;
}

interface ResourceStackMatchHint {
  positionX?: number;
  positionY?: number;
  stackCount?: number;
}

function resolveModernJmSectors(buffer: Buffer): {
  metadata: ReturnType<typeof readD2iMetadata>;
  jmSectors: ModernResourceSector[];
} {
  const metadata = readD2iMetadata(buffer);
  const jmSectors = metadata.sectors
    .map((sector, index) => ({ sectorIndex: index, ...sector }))
    .filter((s) => s.payloadSignature === 'JM')
    .sort((a, b) => a.sectorIndex - b.sectorIndex);

  return { metadata, jmSectors };
}

async function readResourceSectorEntries(
  buffer: Buffer,
  jmSectors: ModernResourceSector[],
  version: number,
): Promise<ResourceSectorItemEntry[]> {
  const config = { extendedStash: false, sortProperties: true };
  const constants = constants105Extended as unknown as d2sTypes.IConstantData;
  const entries: ResourceSectorItemEntry[] = [];

  // Resource sectors live at JM indices >= SHARED_TAB_COUNT.
  for (let jmIdx = SHARED_TAB_COUNT; jmIdx < jmSectors.length; jmIdx++) {
    const targetSector = jmSectors[jmIdx];
    const payload = Buffer.from(
      buffer.subarray(
        targetSector.payloadOffset,
        targetSector.payloadOffset + targetSector.payloadSize,
      ),
    );

    if (payload.length < JM_ITEM_DATA_OFFSET || payload.toString('ascii', 0, 2) !== 'JM') {
      continue;
    }

    const count = payload.readUInt16LE(JM_ITEM_COUNT_OFFSET);

    // Read items one at a time, tracking byte boundaries via reader.offset.
    const reader = new BitReader(payload);
    reader.ReadString(2); // skip "JM"
    reader.ReadUInt16(); // skip count

    for (let i = 0; i < count; i++) {
      const startBit = reader.offset;
      const item = await readItem(reader, version, constants, config);
      const endBit = reader.offset;
      entries.push({
        sector: targetSector,
        count,
        startByte: startBit / 8,
        endByte: endBit / 8,
        item,
      });
    }
  }

  return entries;
}

function selectResourceStackEntry(
  entries: ResourceSectorItemEntry[],
  itemCode: string,
  hint?: ResourceStackMatchHint,
): ResourceSectorItemEntry | undefined {
  const normalizedCode = normalizeItemCode(itemCode);
  if (!normalizedCode) {
    return undefined;
  }

  const matchingEntries = entries.filter((entry) => {
    const code = normalizeItemCode(
      (entry.item as { code?: unknown; type?: unknown }).code ??
        (entry.item as { type?: unknown }).type,
    );
    return code === normalizedCode;
  });

  if (matchingEntries.length === 0) {
    return undefined;
  }

  let bestEntry = matchingEntries[0];
  let bestScore = -1;

  for (const entry of matchingEntries) {
    let score = 0;

    if (
      hint?.positionX !== undefined &&
      hint.positionY !== undefined &&
      entry.item.position_x === hint.positionX &&
      entry.item.position_y === hint.positionY
    ) {
      score += 2;
    }

    if (hint?.stackCount !== undefined && resolveStackCount(entry.item) === hint.stackCount) {
      score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  return bestEntry;
}

async function reduceResourceStackEntryInModernStashBuffer(
  buffer: Buffer,
  entry: ResourceSectorItemEntry,
  reduceBy: number,
): Promise<Buffer> {
  const { metadata } = resolveModernJmSectors(buffer);
  const payload = Buffer.from(
    buffer.subarray(
      entry.sector.payloadOffset,
      entry.sector.payloadOffset + entry.sector.payloadSize,
    ),
  );
  const currentCount = resolveStackCount(entry.item);
  const newCount = currentCount - reduceBy;

  // Build new item bytes — binary splice: only the matching item is re-serialized.
  const beforeBytes = payload.subarray(JM_ITEM_DATA_OFFSET, entry.startByte);
  const afterBytes = payload.subarray(entry.endByte);

  let newPayload: Buffer;
  if (newCount <= 0) {
    // Remove the item entirely.
    const newHeader = Buffer.alloc(JM_ITEM_DATA_OFFSET);
    newHeader.write('JM', 0, 'ascii');
    newHeader.writeUInt16LE(entry.count - 1, JM_ITEM_COUNT_OFFSET);
    newPayload = Buffer.concat([newHeader, beforeBytes, afterBytes]);
  } else {
    // Re-serialize only the matching item with reduced quantity.
    const updatedItem = withUpdatedResourceStackCount(entry.item, newCount);
    const config = { extendedStash: false, sortProperties: true };
    const constants = constants105Extended as unknown as d2sTypes.IConstantData;
    const updatedItemBytes = Buffer.from(
      await writeItem(updatedItem as d2sTypes.IItem, metadata.version, constants, config),
    );
    const newHeader = Buffer.alloc(JM_ITEM_DATA_OFFSET);
    newHeader.write('JM', 0, 'ascii');
    newHeader.writeUInt16LE(entry.count, JM_ITEM_COUNT_OFFSET);
    newPayload = Buffer.concat([newHeader, beforeBytes, updatedItemBytes, afterBytes]);
  }

  return rebuildD2iBuffer(buffer, metadata.sectors, entry.sector.offset, newPayload);
}

async function reduceItemInModernStashResourceSector(
  filePath: string,
  itemCode: string,
  reduceBy: number,
  sourceHint?: ResourceStackMatchHint,
): Promise<void> {
  const buffer = await readFile(filePath);
  const { metadata, jmSectors } = resolveModernJmSectors(buffer);
  const entries = await readResourceSectorEntries(buffer, jmSectors, metadata.version);
  const entry = selectResourceStackEntry(entries, itemCode, sourceHint);
  if (!entry) {
    throw new Error(`Stack item '${itemCode}' not found in modern resource sectors`);
  }

  const nextBuffer = await reduceResourceStackEntryInModernStashBuffer(buffer, entry, reduceBy);
  await writeFile(filePath, nextBuffer);
}

/**
 * Splits `splitCount` items off a stack in a classic stash or character save file.
 *
 * Modern stash files (d2i v105+) are read-only and will throw MODERN_STASH_READ_ONLY.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This function coordinates d2s, classic stash, and multi-target file writes in a single operation. Splitting further would require passing complex partial state between helpers.
export async function splitStackInSaveFile(options: SplitStackOptions): Promise<void> {
  const { sourceFilePath, sourceFileType, sourceStashTab, sourceItemCode } = options;
  const normalizedCode = normalizeItemCode(sourceItemCode);
  if (!normalizedCode) {
    throw new Error('sourceItemCode is required');
  }

  if (options.splitCount <= 0) {
    throw new Error('splitCount must be positive');
  }

  // Modern stash resource tabs (d2i v105+) support stack splitting into shared tabs.
  // Prefer a single-buffer mutation path when source and targets are in the same modern stash file.
  if (sourceFileType === 'd2i' && options.sourceRawItemJson) {
    if (typeof options.sourceRawItemJson !== 'string' || !options.sourceRawItemJson.trim()) {
      throw new Error('sourceRawItemJson is required for modern stash sources');
    }
    let sourceItem: d2sTypes.IItem;
    try {
      sourceItem = JSON.parse(options.sourceRawItemJson) as d2sTypes.IItem;
    } catch {
      throw new Error('sourceRawItemJson must be valid JSON');
    }

    const requestedSplitCount = Math.min(options.splitCount, options.targets.length);
    if (requestedSplitCount <= 0) {
      return;
    }

    const sourceHint: ResourceStackMatchHint = {
      positionX:
        typeof sourceItem.position_x === 'number' && Number.isFinite(sourceItem.position_x)
          ? sourceItem.position_x
          : undefined,
      positionY:
        typeof sourceItem.position_y === 'number' && Number.isFinite(sourceItem.position_y)
          ? sourceItem.position_y
          : undefined,
      stackCount:
        typeof sourceItem.quantity === 'number' && Number.isInteger(sourceItem.quantity)
          ? sourceItem.quantity
          : undefined,
    };

    const splitTargets = options.targets.slice(0, requestedSplitCount);
    const isSingleModernFileSplit = splitTargets.every(
      (target) =>
        target.targetFilePath === sourceFilePath &&
        target.targetFileType === 'd2i' &&
        target.targetLocationContext === 'stash' &&
        typeof target.targetStashTab === 'number' &&
        target.targetStashTab < SHARED_TAB_COUNT,
    );

    if (isSingleModernFileSplit) {
      let workingBuffer = await readFile(sourceFilePath);
      const { metadata, jmSectors } = resolveModernJmSectors(workingBuffer);
      const entries = await readResourceSectorEntries(workingBuffer, jmSectors, metadata.version);
      const sourceEntry = selectResourceStackEntry(entries, normalizedCode, sourceHint);
      if (!sourceEntry) {
        throw new Error(`Stack item '${sourceItemCode}' not found in modern resource sectors`);
      }

      const sourceAvailable = resolveStackCount(sourceEntry.item);
      const actualSplitCount = Math.min(requestedSplitCount, sourceAvailable);
      if (actualSplitCount <= 0) {
        return;
      }

      // First reduce source in memory, then add placed copies; persist only once.
      workingBuffer = await reduceResourceStackEntryInModernStashBuffer(
        workingBuffer,
        sourceEntry,
        actualSplitCount,
      );

      for (let i = 0; i < actualSplitCount; i += 1) {
        const target = splitTargets[i];
        const copy = withQuantityOne(
          withTargetCoordinates(sourceEntry.item, target.targetGridX, target.targetGridY),
        );
        (copy as { id?: unknown }).id = undefined;
        workingBuffer = await addItemToModernStashSharedPageBuffer(
          workingBuffer,
          copy,
          target.targetStashTab as number,
          target.targetGridX,
          target.targetGridY,
        );
      }

      await writeFile(sourceFilePath, workingBuffer);
      return;
    }

    for (const target of splitTargets) {
      // Modern .d2i shared stash pages (tabs 0–4) are writable via sector patching.
      const isModernSharedStash =
        target.targetFileType === 'd2i' &&
        target.targetLocationContext === 'stash' &&
        typeof target.targetStashTab === 'number' &&
        target.targetStashTab < SHARED_TAB_COUNT;
      if (!isModernSharedStash) {
        await assertWritableStashMutationTarget(target.targetFilePath, target.targetFileType);
      }

      const copy = withQuantityOne(
        withTargetCoordinates(sourceItem, target.targetGridX, target.targetGridY),
      );
      (copy as { id?: unknown }).id = undefined;
      await addItemToSaveFile(
        target.targetFilePath,
        target.targetFileType,
        copy,
        target.targetLocationContext,
        target.targetStashTab,
        target.targetGridX,
        target.targetGridY,
      );
    }

    // Reduce the source resource-stack quantity after placements in multi-file flows.
    await reduceItemInModernStashResourceSector(
      sourceFilePath,
      normalizedCode,
      requestedSplitCount,
      sourceHint,
    );
    return;
  }

  // Validate all targets before touching any file.
  await assertWritableStashMutationTarget(sourceFilePath, sourceFileType);
  for (const target of options.targets) {
    await assertWritableStashMutationTarget(target.targetFilePath, target.targetFileType);
  }

  // Read and parse source file.
  const sourceBuffer = await readFile(sourceFilePath);

  if (sourceFileType === 'd2s') {
    const data = await d2s.read(sourceBuffer);
    const sourceItems = data.items;
    const sourceItem = findItemByCode(sourceItems, normalizedCode);
    if (!sourceItem) {
      throw new Error(`Stack item '${sourceItemCode}' not found in save file`);
    }

    const currentQty = getItemQuantity(sourceItem);
    const actualSplitCount = Math.min(options.splitCount, currentQty);

    // Add individual copies to targets.
    for (let i = 0; i < actualSplitCount && i < options.targets.length; i += 1) {
      const target = options.targets[i];
      const copy = withQuantityOne(
        withTargetCoordinates(
          withD2SLocationContext(
            sourceItem,
            target.targetLocationContext,
            data.items,
            resolveTargetCharacterClass(data),
            undefined,
          ),
          target.targetGridX,
          target.targetGridY,
        ),
      );
      // Remove ID so the library assigns a new one on write.
      (copy as { id?: unknown }).id = undefined;

      if (target.targetLocationContext === 'mercenary') {
        data.merc_items.push(copy);
      } else if (target.targetLocationContext === 'corpse') {
        data.corpse_items.push(copy);
      } else {
        data.items.push(copy);
      }
    }

    // Reduce or remove source item.
    const remaining = currentQty - actualSplitCount;
    if (remaining <= 0) {
      const idx = sourceItems.indexOf(sourceItem);
      if (idx >= 0) sourceItems.splice(idx, 1);
    } else {
      sourceItems[sourceItems.indexOf(sourceItem)] = withReducedQuantity(
        sourceItem,
        actualSplitCount,
      );
    }

    const result = await d2s.write(data);
    await writeFile(sourceFilePath, Buffer.from(result));
    return;
  }

  // Classic stash (sss / d2x / non-modern d2i).
  const ext = extname(sourceFilePath);
  assertWritableD2iBuffer(ext, sourceBuffer);
  const { constants, version } = getStashConstants(ext);
  const data = await d2stash.read(sourceBuffer, constants);

  const tabIndex = sourceStashTab;
  if (!data.pages[tabIndex]) {
    throw new Error(`Stash tab ${tabIndex} not found in source file`);
  }

  const tabItems = data.pages[tabIndex].items;
  const sourceItem = findItemByCode(tabItems, normalizedCode);
  if (!sourceItem) {
    throw new Error(`Stack item '${sourceItemCode}' not found in stash tab ${tabIndex}`);
  }

  const currentQty = getItemQuantity(sourceItem);
  const actualSplitCount = Math.min(options.splitCount, currentQty);

  // Build a map of target files needing writes (source file must be written last or together).
  // For simplicity, write source file after handling all same-file placements.
  for (let i = 0; i < actualSplitCount && i < options.targets.length; i += 1) {
    const target = options.targets[i];
    const copy = withQuantityOne(
      withTargetCoordinates(sourceItem, target.targetGridX, target.targetGridY),
    );
    // Remove ID so the library can assign a new one.
    (copy as { id?: unknown }).id = undefined;

    await addItemToSaveFile(
      target.targetFilePath,
      target.targetFileType,
      copy,
      target.targetLocationContext,
      target.targetStashTab,
      target.targetGridX,
      target.targetGridY,
    );
  }

  // Reduce or remove source item and write source file.
  const remaining = currentQty - actualSplitCount;
  if (remaining <= 0) {
    const idx = tabItems.indexOf(sourceItem);
    if (idx >= 0) tabItems.splice(idx, 1);
  } else {
    tabItems[tabItems.indexOf(sourceItem)] = withReducedQuantity(sourceItem, actualSplitCount);
  }

  const result = await d2stash.write(data, constants, version);
  await writeFile(sourceFilePath, Buffer.from(result));
}

async function isModernD2iFile(filePath: string, fileType: VaultSourceFileType): Promise<boolean> {
  if (fileType !== 'd2i' || extname(filePath) !== '.d2i') {
    return false;
  }
  const buffer = await readFile(filePath);
  const metadata = readD2iMetadata(buffer);
  return metadata.version >= 105;
}

export async function moveItemBetweenSaveFiles(options: MoveSaveFileItemOptions): Promise<void> {
  const isMovingWithinSameFile =
    options.sourceFilePath === options.targetFilePath &&
    options.sourceFileType === options.targetFileType;

  if (isMovingWithinSameFile) {
    await moveItemWithinSingleSaveFile(options);
    return;
  }

  // Modern .d2i sources can have items removed — skip the blanket assertion.
  const sourceIsModernD2i = await isModernD2iFile(options.sourceFilePath, options.sourceFileType);
  if (!sourceIsModernD2i) {
    await assertWritableStashMutationTarget(options.sourceFilePath, options.sourceFileType);
  }

  // Modern .d2i targets on shared tabs are writable — skip the blanket assertion.
  const targetStashTab = options.targetStashTab;
  const targetIsModernD2iSharedTab =
    typeof targetStashTab === 'number' &&
    targetStashTab < SHARED_TAB_COUNT &&
    (await isModernD2iFile(options.targetFilePath, options.targetFileType));
  if (!targetIsModernD2iSharedTab) {
    await assertWritableStashMutationTarget(options.targetFilePath, options.targetFileType);
  }

  let sourceItem: d2sTypes.IItem | undefined;
  if (sourceIsModernD2i) {
    sourceItem = await findItemInModernStashSharedPage(
      options.sourceFilePath,
      options.sourceItemId,
      options.sourceStashTab,
      options.sourceGridXFromItem,
      options.sourceGridYFromItem,
    );
  } else {
    sourceItem = await findItemInSaveFile(
      options.sourceFilePath,
      options.sourceFileType,
      // Non-modern-d2i paths always have a numeric id (non-simple items from .d2s / classic stash)
      options.sourceItemId as number,
    );
  }
  if (!sourceItem) {
    throw new Error('Source item not found in save file');
  }

  await addItemToSaveFile(
    options.targetFilePath,
    options.targetFileType,
    sourceItem,
    options.targetLocationContext,
    options.targetStashTab,
    options.targetGridX,
    options.targetGridY,
    options.targetEquippedSlotId,
  );

  if (sourceIsModernD2i) {
    await removeItemFromModernStashSharedPage(
      options.sourceFilePath,
      options.sourceItemId,
      options.sourceStashTab,
      options.sourceGridXFromItem,
      options.sourceGridYFromItem,
    );
  } else {
    await removeItemFromSaveFile(
      options.sourceFilePath,
      options.sourceFileType,
      // Non-modern-d2i paths always have a numeric id
      options.sourceItemId as number,
    );
  }
}
