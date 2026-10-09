/**
 * Validators for the vault and inventory IPC arguments.
 *
 * They check the shape of each renderer payload, keep the error messages the vault UI shows, and
 * return a normalized copy (trimmed paths, only known fields, defaults applied), so the vault
 * service receives typed input and only enforces the rules that need app state (save directory,
 * database rows, the save files themselves).
 */
import type {
  InventoryItemMoveInput,
  InventorySnapshotWindowTarget,
  InventoryStackSplitInput,
  StackSplitTarget,
  VaultItemFilter,
  VaultItemUpsertInput,
  VaultLocationContext,
  VaultSourceFileType,
} from '../types/grail';
import { VALID_EQUIPPED_SLOT_IDS } from '../utils/equipSlots';
import { VALID_SOURCE_FILE_TYPES } from '../utils/vaultState';
import type { UnvaultTargetOptions } from './contract';
import { ensure, type FieldValidator, isPlainObject } from './validation';

const MAX_SEARCH_TEXT_LENGTH = 120;
const MIN_PAGE = 1;
const MAX_PAGE = 10000;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 200;

const PRESENT_STATES: readonly NonNullable<VaultItemFilter['presentState']>[] = [
  'all',
  'present',
  'missing',
];
const VAULTED_STATES: readonly NonNullable<VaultItemFilter['vaultedState']>[] = [
  'all',
  'vaulted',
  'unvaulted',
];
const SORT_KEYS: readonly NonNullable<VaultItemFilter['sortBy']>[] = [
  'itemName',
  'lastSeenAt',
  'createdAt',
  'updatedAt',
  'vaultedAt',
];
const SORT_ORDERS: readonly NonNullable<VaultItemFilter['sortOrder']>[] = ['asc', 'desc'];
const LOCATION_CONTEXTS: readonly VaultLocationContext[] = [
  'equipped',
  'inventory',
  'stash',
  'mercenary',
  'corpse',
  'unknown',
];
/** Locations an item can be moved to (`unknown` is only a scan result). */
const MOVE_TARGET_CONTEXTS: readonly VaultLocationContext[] = [
  'equipped',
  'inventory',
  'stash',
  'mercenary',
  'corpse',
];

const SOURCE_FILE_TYPES_MESSAGE = 'must be one of: d2s, sss, d2x, d2i';

function isOneOf<T>(values: readonly T[], value: unknown): value is T {
  return (values as readonly unknown[]).includes(value);
}

function isSourceFileType(value: unknown): value is VaultSourceFileType {
  return typeof value === 'string' && VALID_SOURCE_FILE_TYPES.has(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

/** The trimmed string, or undefined for anything that is not a string. */
function trimmedString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

/** Copies an object without its `undefined` properties. */
function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function optionalString(value: unknown, field: string): string | undefined {
  ensure(value === undefined || typeof value === 'string', `${field} must be a string`);
  return value;
}

function optionalInteger(value: unknown, field: string): number | undefined {
  ensure(value === undefined || Number.isInteger(value), `${field} must be an integer`);
  return value as number | undefined;
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  ensure(value === undefined || typeof value === 'boolean', `${field} must be a boolean`);
  return value;
}

/** Accepts a Date or a date string (dates can arrive serialized) and returns a valid Date. */
function optionalDate(value: unknown, field: string): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  ensure(value instanceof Date || typeof value === 'string', `${field} must be a valid date`);
  const date = value instanceof Date ? value : new Date(value);
  ensure(!Number.isNaN(date.getTime()), `${field} must be a valid date`);
  return date;
}

/**
 * Validates a vault or inventory search filter. Omitted filters stay undefined.
 */
export const vaultItemFilter: FieldValidator<VaultItemFilter | undefined> = (value) => {
  if (value === undefined) {
    return undefined;
  }

  ensure(isPlainObject(value), 'Invalid search filter: expected an object');
  const {
    text,
    characterId,
    locationContext,
    sourceFileType,
    includeSocketed,
    presentState,
    vaultedState,
    page,
    pageSize,
    sortBy,
    sortOrder,
  } = value;

  if (text !== undefined) {
    ensure(typeof text === 'string', 'Search text must be a string');
    ensure(
      text.length <= MAX_SEARCH_TEXT_LENGTH,
      `Search text must be <= ${MAX_SEARCH_TEXT_LENGTH} characters`,
    );
  }
  if (page !== undefined) {
    ensure(Number.isInteger(page), 'Page must be an integer');
    ensure((page as number) >= MIN_PAGE, `Page must be >= ${MIN_PAGE}`);
    ensure((page as number) <= MAX_PAGE, `Page must be <= ${MAX_PAGE}`);
  }
  if (pageSize !== undefined) {
    ensure(Number.isInteger(pageSize), 'Page size must be an integer');
    ensure(
      (pageSize as number) >= MIN_PAGE_SIZE && (pageSize as number) <= MAX_PAGE_SIZE,
      `Page size must be between ${MIN_PAGE_SIZE} and ${MAX_PAGE_SIZE}`,
    );
  }
  ensure(
    presentState === undefined || isOneOf(PRESENT_STATES, presentState),
    'presentState must be one of: all, present, missing',
  );
  ensure(
    vaultedState === undefined || isOneOf(VAULTED_STATES, vaultedState),
    'vaultedState must be one of: all, vaulted, unvaulted',
  );
  ensure(
    sortBy === undefined || isOneOf(SORT_KEYS, sortBy),
    `sortBy must be one of: ${SORT_KEYS.join(', ')}`,
  );
  ensure(
    sortOrder === undefined || isOneOf(SORT_ORDERS, sortOrder),
    'sortOrder must be asc or desc',
  );
  ensure(
    sourceFileType === undefined || isSourceFileType(sourceFileType),
    `sourceFileType ${SOURCE_FILE_TYPES_MESSAGE}`,
  );
  ensure(
    locationContext === undefined || isOneOf(LOCATION_CONTEXTS, locationContext),
    'locationContext must be one of: equipped, inventory, stash, mercenary, corpse, unknown',
  );
  ensure(
    includeSocketed === undefined || typeof includeSocketed === 'boolean',
    'includeSocketed must be a boolean',
  );
  ensure(
    characterId === undefined || (typeof characterId === 'string' && characterId.length > 0),
    'characterId must be a non-empty string',
  );

  return withoutUndefined<VaultItemFilter>({
    text: text as string | undefined,
    characterId: characterId as string | undefined,
    locationContext: locationContext as VaultLocationContext | undefined,
    sourceFileType: sourceFileType as VaultSourceFileType | undefined,
    includeSocketed: includeSocketed as boolean | undefined,
    presentState: presentState as VaultItemFilter['presentState'],
    vaultedState: vaultedState as VaultItemFilter['vaultedState'],
    page: page as number | undefined,
    pageSize: pageSize as number | undefined,
    sortBy: sortBy as VaultItemFilter['sortBy'],
    sortOrder: sortOrder as VaultItemFilter['sortOrder'],
  });
};

function requiredText(value: unknown, message: string): string {
  ensure(typeof value === 'string' && value.length > 0, message);
  return value;
}

/**
 * Validates an item the renderer adds to the vault. Date fields may arrive as strings and are
 * converted to Dates.
 */
export const vaultItemUpsertInput: FieldValidator<VaultItemUpsertInput> = (value) => {
  ensure(isPlainObject(value), 'Vault item is required');
  ensure(isSourceFileType(value.sourceFileType), 'Invalid sourceFileType');
  ensure(isOneOf(LOCATION_CONTEXTS, value.locationContext), 'Invalid locationContext');
  ensure(typeof value.ethereal === 'boolean', 'ethereal must be a boolean');

  return withoutUndefined<VaultItemUpsertInput>({
    id: optionalString(value.id, 'id'),
    fingerprint: requiredText(value.fingerprint, 'Missing fingerprint'),
    itemName: requiredText(value.itemName, 'Missing itemName'),
    itemCode: optionalString(value.itemCode, 'itemCode'),
    type: optionalString(value.type, 'type'),
    quality: requiredText(value.quality, 'Missing quality'),
    ethereal: value.ethereal,
    socketCount: optionalInteger(value.socketCount, 'socketCount'),
    stackCount: optionalInteger(value.stackCount, 'stackCount'),
    rawItemJson: requiredText(value.rawItemJson, 'Missing rawItemJson'),
    sourceCharacterId: optionalString(value.sourceCharacterId, 'sourceCharacterId'),
    sourceCharacterName: optionalString(value.sourceCharacterName, 'sourceCharacterName'),
    sourceFileType: value.sourceFileType,
    sourceFilePath: optionalString(value.sourceFilePath, 'sourceFilePath'),
    locationContext: value.locationContext,
    stashTab: optionalInteger(value.stashTab, 'stashTab'),
    gridX: optionalInteger(value.gridX, 'gridX'),
    gridY: optionalInteger(value.gridY, 'gridY'),
    gridWidth: optionalInteger(value.gridWidth, 'gridWidth'),
    gridHeight: optionalInteger(value.gridHeight, 'gridHeight'),
    equippedSlotId: optionalInteger(value.equippedSlotId, 'equippedSlotId'),
    iconFileName: optionalString(value.iconFileName, 'iconFileName'),
    isSocketedItem: optionalBoolean(value.isSocketedItem, 'isSocketedItem'),
    grailItemId: optionalString(value.grailItemId, 'grailItemId'),
    isPresentInLatestScan: optionalBoolean(value.isPresentInLatestScan, 'isPresentInLatestScan'),
    lastSeenAt: optionalDate(value.lastSeenAt, 'lastSeenAt'),
    vaultedAt: optionalDate(value.vaultedAt, 'vaultedAt'),
    unvaultedAt: optionalDate(value.unvaultedAt, 'unvaultedAt'),
  });
};

/** ID of a vault row. */
export const vaultItemId: FieldValidator<string> = (value) =>
  requiredText(value, 'itemId is required');

/** Number of stack units to take out of the vault; omitted means the whole stack. */
export const withdrawCount: FieldValidator<number | undefined> = (value) => {
  ensure(
    value === undefined || (Number.isInteger(value) && (value as number) > 0),
    'withdrawCount must be a positive integer',
  );
  return value as number | undefined;
};

/**
 * Validates the save file position a vault item is written back to. Omitted targets stay
 * undefined (rows that were not taken out of a save file can be unvaulted without one).
 */
export const unvaultTargetOptions: FieldValidator<UnvaultTargetOptions | undefined> = (value) => {
  if (value === undefined) {
    return undefined;
  }

  ensure(isPlainObject(value), 'targetOptions must be an object');
  const targetFilePath = trimmedString(value.targetFilePath);
  ensure(
    targetFilePath !== undefined && targetFilePath.length > 0,
    'targetOptions.targetFilePath must be a non-empty string',
  );
  const { targetFileType, targetLocationContext, targetStashTab, targetEquippedSlotId } = value;
  ensure(
    isSourceFileType(targetFileType),
    `targetOptions.targetFileType ${SOURCE_FILE_TYPES_MESSAGE}`,
  );
  ensure(
    isOneOf(MOVE_TARGET_CONTEXTS, targetLocationContext),
    'targetOptions.targetLocationContext must be one of: equipped, inventory, stash, mercenary, corpse',
  );
  if (targetFileType !== 'd2s') {
    ensure(
      targetLocationContext === 'stash',
      'Shared stash targets must use targetLocationContext=stash',
    );
  }
  if (targetStashTab !== undefined) {
    ensure(
      targetLocationContext === 'stash',
      'targetOptions.targetStashTab is only allowed when targetLocationContext=stash',
    );
    ensure(
      isNonNegativeInteger(targetStashTab),
      'targetOptions.targetStashTab must be a non-negative integer',
    );
  }
  if (targetLocationContext === 'equipped') {
    ensure(
      Number.isInteger(targetEquippedSlotId) &&
        VALID_EQUIPPED_SLOT_IDS.has(targetEquippedSlotId as number),
      'targetOptions.targetEquippedSlotId must be one of: 1-12',
    );
  } else {
    ensure(
      targetEquippedSlotId === undefined,
      'targetOptions.targetEquippedSlotId is only allowed when targetLocationContext=equipped',
    );
  }
  ensure(
    isNonNegativeInteger(value.targetGridX),
    'targetOptions.targetGridX must be a non-negative integer',
  );
  ensure(
    isNonNegativeInteger(value.targetGridY),
    'targetOptions.targetGridY must be a non-negative integer',
  );

  return withoutUndefined<UnvaultTargetOptions>({
    targetFilePath,
    targetFileType,
    targetLocationContext,
    targetStashTab: targetStashTab as number | undefined,
    targetGridX: value.targetGridX,
    targetGridY: value.targetGridY,
    targetEquippedSlotId: targetEquippedSlotId as number | undefined,
  });
};

/**
 * Validates a request to move an item within or between save files. The returned input only has
 * the target fields of its location mode: stash targets default to tab 0, equipped targets have no
 * grid position.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Move validation covers every target mode.
export const inventoryItemMoveInput: FieldValidator<InventoryItemMoveInput> = (value) => {
  ensure(isPlainObject(value), 'Move input is required');
  const sourceFilePath = trimmedString(value.sourceFilePath);
  const targetFilePath = trimmedString(value.targetFilePath);
  const { rawItemJson, sourceFileType, targetFileType, targetLocationContext } = value;
  const { targetStashTab, targetEquippedSlotId, targetGridX, targetGridY } = value;

  ensure(sourceFilePath !== undefined && sourceFilePath.length > 0, 'sourceFilePath is required');
  ensure(targetFilePath !== undefined && targetFilePath.length > 0, 'targetFilePath is required');
  ensure(
    typeof rawItemJson === 'string' && rawItemJson.trim().length > 0,
    'rawItemJson is required',
  );
  ensure(isSourceFileType(sourceFileType), `sourceFileType ${SOURCE_FILE_TYPES_MESSAGE}`);
  ensure(isSourceFileType(targetFileType), `targetFileType ${SOURCE_FILE_TYPES_MESSAGE}`);
  ensure(
    isOneOf(MOVE_TARGET_CONTEXTS, targetLocationContext),
    'targetLocationContext must be one of: equipped, inventory, stash, mercenary, corpse',
  );

  const isStashTarget = targetLocationContext === 'stash';
  const isEquippedTarget = targetLocationContext === 'equipped';

  if (targetFileType !== 'd2s') {
    ensure(isStashTarget, 'Shared stash targets must use targetLocationContext=stash');
  }

  if (isEquippedTarget) {
    ensure(targetFileType === 'd2s', 'Equipped target requires targetFileType=d2s');
    ensure(
      Number.isInteger(targetEquippedSlotId) &&
        VALID_EQUIPPED_SLOT_IDS.has(targetEquippedSlotId as number),
      'targetEquippedSlotId must be one of: 1-12',
    );
  } else {
    ensure(
      targetEquippedSlotId === undefined,
      'targetEquippedSlotId is only allowed when targetLocationContext=equipped',
    );
  }

  if (isStashTarget) {
    ensure(
      targetStashTab === undefined || isNonNegativeInteger(targetStashTab),
      'targetStashTab must be a non-negative integer',
    );
  } else {
    ensure(
      targetStashTab === undefined,
      'targetStashTab is only allowed when targetLocationContext=stash',
    );
  }

  if (!isEquippedTarget) {
    ensure(Number.isInteger(targetGridX), 'targetGridX must be an integer');
    ensure(Number.isInteger(targetGridY), 'targetGridY must be an integer');
    ensure((targetGridX as number) >= 0, 'targetGridX must be >= 0');
    ensure((targetGridY as number) >= 0, 'targetGridY must be >= 0');
  }

  // The source tab only narrows the item lookup, so an unusable value is dropped instead of rejected
  const sourceStashTab =
    typeof value.sourceStashTab === 'number' && value.sourceStashTab >= 0
      ? value.sourceStashTab
      : undefined;

  return withoutUndefined<InventoryItemMoveInput>({
    sourceFilePath,
    sourceFileType,
    rawItemJson,
    sourceStashTab,
    targetFilePath,
    targetFileType,
    targetLocationContext,
    targetStashTab: isStashTarget ? ((targetStashTab as number | undefined) ?? 0) : undefined,
    targetGridX: isEquippedTarget ? undefined : (targetGridX as number),
    targetGridY: isEquippedTarget ? undefined : (targetGridY as number),
    targetEquippedSlotId: isEquippedTarget ? (targetEquippedSlotId as number) : undefined,
  });
};

function stackSplitTarget(value: unknown): StackSplitTarget {
  ensure(isPlainObject(value), 'Each target must be an object');
  const targetFilePath = trimmedString(value.targetFilePath);
  const { targetFileType, targetLocationContext, targetStashTab, targetGridX, targetGridY } = value;
  const isStashTarget = targetLocationContext === 'stash';

  ensure(
    targetFilePath !== undefined && targetFilePath.length > 0,
    'Each target must have a valid targetFilePath',
  );
  ensure(
    isSourceFileType(targetFileType),
    `Each target targetFileType ${SOURCE_FILE_TYPES_MESSAGE}`,
  );
  ensure(
    isOneOf(MOVE_TARGET_CONTEXTS, targetLocationContext) && targetLocationContext !== 'equipped',
    'Each target targetLocationContext must be valid',
  );
  if (targetFileType !== 'd2s') {
    ensure(isStashTarget, 'Shared stash targets must use targetLocationContext=stash');
  }
  if (targetStashTab !== undefined) {
    ensure(
      isStashTarget,
      'Each target targetStashTab is only allowed when targetLocationContext=stash',
    );
    ensure(
      isNonNegativeInteger(targetStashTab),
      'Each target targetStashTab must be a non-negative integer',
    );
  }
  ensure(Number.isInteger(targetGridX), 'Each target must have integer targetGridX');
  ensure(Number.isInteger(targetGridY), 'Each target must have integer targetGridY');
  ensure((targetGridX as number) >= 0, 'Each target targetGridX must be >= 0');
  ensure((targetGridY as number) >= 0, 'Each target targetGridY must be >= 0');

  return withoutUndefined<StackSplitTarget>({
    targetFilePath,
    targetFileType,
    targetLocationContext,
    targetStashTab: targetStashTab as number | undefined,
    targetGridX: targetGridX as number,
    targetGridY: targetGridY as number,
  });
}

/**
 * Validates a request to split items off a stack onto one or more target positions.
 */
export const inventoryStackSplitInput: FieldValidator<InventoryStackSplitInput> = (value) => {
  ensure(isPlainObject(value), 'Split input is required');
  const sourceFilePath = trimmedString(value.sourceFilePath);
  const sourceItemCode = trimmedString(value.sourceItemCode);
  const { sourceFileType, sourceStashTab, splitCount, targets } = value;

  ensure(sourceFilePath !== undefined && sourceFilePath.length > 0, 'sourceFilePath is required');
  ensure(isSourceFileType(sourceFileType), `sourceFileType ${SOURCE_FILE_TYPES_MESSAGE}`);
  ensure(sourceItemCode !== undefined && sourceItemCode.length > 0, 'sourceItemCode is required');
  ensure(isNonNegativeInteger(sourceStashTab), 'sourceStashTab must be a non-negative integer');
  ensure(
    Number.isInteger(splitCount) && (splitCount as number) > 0,
    'splitCount must be a positive integer',
  );
  ensure(Array.isArray(targets) && targets.length > 0, 'targets must be non-empty');

  return withoutUndefined<InventoryStackSplitInput>({
    sourceFilePath,
    sourceFileType,
    sourceStashTab,
    sourceItemCode,
    // Optional: an empty value means "not provided"
    sourceRawItemJson: trimmedString(value.sourceRawItemJson) || undefined,
    splitCount: splitCount as number,
    targets: targets.map(stackSplitTarget),
  });
};

/**
 * Validates the save file an inventory snapshot window is opened for.
 */
export const inventorySnapshotWindowTarget: FieldValidator<InventorySnapshotWindowTarget> = (
  value,
) => {
  ensure(isPlainObject(value), 'Snapshot target is required');
  const sourceFilePath = trimmedString(value.sourceFilePath);
  const characterName = trimmedString(value.characterName);

  ensure(sourceFilePath !== undefined && sourceFilePath.length > 0, 'sourceFilePath is required');
  ensure(isSourceFileType(value.sourceFileType), `sourceFileType ${SOURCE_FILE_TYPES_MESSAGE}`);
  ensure(characterName !== undefined && characterName.length > 0, 'characterName is required');

  return { sourceFilePath, sourceFileType: value.sourceFileType, characterName };
};
