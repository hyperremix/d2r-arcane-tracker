import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { types as d2sTypes } from '@dschu012/d2s';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import { constants as constants96 } from '@dschu012/d2s/lib/data/versions/96_constant_data';
import { constants as constants99 } from '@dschu012/d2s/lib/data/versions/99_constant_data';
import type { CharacterClass, VaultLocationContext, VaultSourceFileType } from '../types/grail';

type StashConstants = {
  constants: d2sTypes.IConstantData;
  version: number;
};

interface MoveSaveFileItemOptions {
  sourceFilePath: string;
  sourceFileType: VaultSourceFileType;
  sourceItemId: number;
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

async function moveItemWithinSingleSaveFile(options: MoveSaveFileItemOptions): Promise<void> {
  const { sourceFilePath, sourceFileType, sourceItemId } = options;
  const buffer = await readFile(sourceFilePath);

  if (sourceFileType === 'd2s') {
    const data = await d2s.read(buffer);
    const sourceItem =
      extractItemById(data.items, sourceItemId) ??
      extractItemById(data.corpse_items, sourceItemId) ??
      extractItemById(data.merc_items, sourceItemId);

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
  const { constants, version } = getStashConstants(ext);
  const data = await d2stash.read(buffer, constants);
  let sourceItem: d2sTypes.IItem | undefined;

  for (const page of data.pages) {
    const extracted = extractItemById(page.items, sourceItemId);
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
    data.items = data.items.filter((item) => !itemMatchesId(item, itemId));
    data.corpse_items = data.corpse_items.filter((item) => !itemMatchesId(item, itemId));
    data.merc_items = data.merc_items.filter((item) => !itemMatchesId(item, itemId));
    const result = await d2s.write(data);
    await writeFile(filePath, Buffer.from(result));
    return;
  }

  const ext = extname(filePath);
  const { constants, version } = getStashConstants(ext);
  const data = await d2stash.read(buffer, constants);

  for (const page of data.pages) {
    page.items = page.items.filter((item) => !itemMatchesId(item, itemId));
  }

  const result = await d2stash.write(data, constants, version);
  await writeFile(filePath, Buffer.from(result));
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

  if (fileType === 'd2s') {
    const data = await d2s.read(buffer);
    const itemToWrite = withD2SLocationContext(
      withTargetCoordinates(item, targetGridX, targetGridY),
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
  const { constants, version } = getStashConstants(ext);
  const data = await d2stash.read(buffer, constants);
  const itemToWrite = withTargetCoordinates(item, targetGridX, targetGridY);

  const targetTab = stashTab ?? 0;

  while (data.pages.length <= targetTab) {
    data.pages.push({ name: '', type: 0, items: [] });
    data.pageCount = data.pages.length;
  }

  data.pages[targetTab].items.push(itemToWrite);

  const result = await d2stash.write(data, constants, version);
  await writeFile(filePath, Buffer.from(result));
}

export async function moveItemBetweenSaveFiles(options: MoveSaveFileItemOptions): Promise<void> {
  const isMovingWithinSameFile =
    options.sourceFilePath === options.targetFilePath &&
    options.sourceFileType === options.targetFileType;

  if (isMovingWithinSameFile) {
    await moveItemWithinSingleSaveFile(options);
    return;
  }

  const sourceItem = await findItemInSaveFile(
    options.sourceFilePath,
    options.sourceFileType,
    options.sourceItemId,
  );
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
  await removeItemFromSaveFile(
    options.sourceFilePath,
    options.sourceFileType,
    options.sourceItemId,
  );
}
