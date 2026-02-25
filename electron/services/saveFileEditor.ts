import { readFile, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import type { types as d2sTypes } from '@dschu012/d2s';
import * as d2s from '@dschu012/d2s';
import * as d2stash from '@dschu012/d2s/lib/d2/stash';
import { constants as constants96 } from '@dschu012/d2s/lib/data/versions/96_constant_data';
import { constants as constants99 } from '@dschu012/d2s/lib/data/versions/99_constant_data';
import type { VaultLocationContext, VaultSourceFileType } from '../types/grail';

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
};

type ConstantDataWithItems = {
  armor_items?: Record<string, ConstantItemDefinition>;
  weapon_items?: Record<string, ConstantItemDefinition>;
  other_items?: Record<string, ConstantItemDefinition>;
};

const ITEM_EQUIPMENT_CATEGORIES_BY_CODE = (() => {
  const map = new Map<string, Set<string>>();
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
        if (!Array.isArray(itemDefinition.c)) {
          continue;
        }

        const normalizedCode = code.toLowerCase();
        const existing = map.get(normalizedCode) ?? new Set<string>();
        for (const category of itemDefinition.c) {
          if (typeof category === 'string' && category.trim().length > 0) {
            existing.add(category.trim().toLowerCase());
          }
        }
        map.set(normalizedCode, existing);
      }
    }
  };

  addConstantData(constants99);
  addConstantData(constants96);
  return map;
})();

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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Equipment eligibility maps several category combinations into slot rules.
function resolveEligibleEquippedSlots(item: d2sTypes.IItem): Set<number> | undefined {
  const code = resolveItemCode(item);
  const categories = code ? ITEM_EQUIPMENT_CATEGORIES_BY_CODE.get(code) : undefined;
  const slots = new Set<number>();

  if (categories) {
    if (categories.has('ring')) {
      slots.add(6);
      slots.add(7);
    }

    if (categories.has('amulet')) {
      slots.add(2);
    }

    if (categories.has('helm')) {
      slots.add(1);
    }

    if (categories.has('gloves')) {
      slots.add(10);
    }

    if (categories.has('boots')) {
      slots.add(9);
    }

    if (categories.has('belt')) {
      slots.add(8);
    }

    if (categories.has('shield') || categories.has('any shield')) {
      slots.add(5);
    }

    const isWeaponLike = [...categories].some((category) => category.includes('weapon'));
    if (isWeaponLike) {
      slots.add(4);
      slots.add(5);
    }

    const isBodyArmor = categories.has('armor') || categories.has('any armor');
    const hasArmorPieceSlot =
      slots.has(1) || slots.has(8) || slots.has(9) || slots.has(10) || slots.has(5);
    if (isBodyArmor && !hasArmorPieceSlot) {
      slots.add(3);
    }
  }

  if (slots.size > 0) {
    return slots;
  }

  const rawEquippedId = normalizeItemId((item as { equipped_id?: unknown }).equipped_id);
  if (!rawEquippedId) {
    return undefined;
  }

  const normalizedSlot = normalizeWeaponSetSlotId(rawEquippedId);
  if (normalizedSlot === 6 || normalizedSlot === 7) {
    return new Set([6, 7]);
  }

  if (normalizedSlot === 4 || normalizedSlot === 5) {
    return new Set([4, 5]);
  }

  return new Set([normalizedSlot]);
}

function assertEligibleForEquippedSlot(item: d2sTypes.IItem, targetSlotId: number): void {
  const normalizedTargetSlotId = normalizeWeaponSetSlotId(targetSlotId);
  const eligibleSlots = resolveEligibleEquippedSlots(item);
  if (!eligibleSlots || eligibleSlots.size === 0) {
    return;
  }

  if (!eligibleSlots.has(normalizedTargetSlotId)) {
    throw new Error('Item cannot be equipped in target slot');
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
        assertEligibleForEquippedSlot(item, targetEquippedSlotId);
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
