import type {
  Character,
  GrailProgress,
  Item,
  Run,
  RunItem,
  SaveFileState,
  Session,
  VaultItem,
} from '../types/grail';
import type {
  DbCharacter,
  DbGrailProgress,
  DbItem,
  DbRun,
  DbRunItem,
  DbSaveFileState,
  DbSession,
  DbVaultItem,
} from './drizzle';

export function toISOString(date: Date | undefined | null): string | null {
  if (!date) return null;
  return date.toISOString();
}

export function fromISOString(dateStr: string | null | undefined): Date | undefined {
  if (!dateStr) return undefined;
  return new Date(dateStr);
}

// SQLite's CURRENT_TIMESTAMP format: UTC without a timezone designator.
const SQLITE_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/;

/**
 * Parses a created_at/updated_at column value.
 * SQLite `CURRENT_TIMESTAMP` values are UTC, so they are parsed as UTC instead of local time.
 * Missing or unparseable values (such as the literal text 'CURRENT_TIMESTAMP' written by
 * older versions) fall back to the current time, so callers never receive an Invalid Date.
 * @param value - The stored timestamp text
 * @returns A valid Date
 */
export function fromDbTimestamp(value: string | null | undefined): Date {
  if (value) {
    const normalized = SQLITE_DATETIME_PATTERN.test(value) ? `${value.replace(' ', 'T')}Z` : value;
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

// App to Database type mappers
export function itemToDbValues(item: Item) {
  return {
    id: item.id,
    name: item.name,
    link: item.link,
    code: item.code ?? null,
    itemBase: item.itemBase ?? null,
    imageFilename: item.imageFilename ?? null,
    type: item.type,
    category: item.category,
    subCategory: item.subCategory,
    treasureClass: item.treasureClass,
    setName: item.setName ?? null,
    runes: item.runes ? JSON.stringify(item.runes) : null,
    etherealType: item.etherealType,
  };
}

// Database to App type mappers
export function dbItemToItem(dbItem: DbItem): Item {
  let runesArray: string[] | undefined;
  if (dbItem.runes) {
    try {
      runesArray = JSON.parse(dbItem.runes) as string[];
    } catch {
      runesArray = undefined;
    }
  }

  return {
    id: dbItem.id,
    name: dbItem.name,
    link: dbItem.link ?? '',
    code: dbItem.code ?? undefined,
    itemBase: dbItem.itemBase ?? undefined,
    imageFilename: dbItem.imageFilename ?? undefined,
    etherealType: dbItem.etherealType,
    type: dbItem.type,
    category: dbItem.category,
    subCategory: dbItem.subCategory,
    treasureClass: dbItem.treasureClass,
    setName: dbItem.setName ?? undefined,
    runes: runesArray,
  };
}

export function dbCharacterToCharacter(dbChar: DbCharacter): Character {
  return {
    id: dbChar.id,
    name: dbChar.name,
    characterClass: dbChar.characterClass,
    level: dbChar.level,
    hardcore: dbChar.hardcore,
    expansion: dbChar.expansion,
    saveFilePath: dbChar.saveFilePath ?? undefined,
    lastUpdated: fromDbTimestamp(dbChar.updatedAt),
    created: fromDbTimestamp(dbChar.createdAt),
    deleted: dbChar.deletedAt ? new Date(dbChar.deletedAt) : undefined,
  };
}

export function dbProgressToProgress(dbProg: DbGrailProgress): GrailProgress {
  return {
    id: dbProg.id,
    characterId: dbProg.characterId,
    itemId: dbProg.itemId,
    foundDate: fromISOString(dbProg.foundDate),
    foundBy: undefined, // This field is not stored in database
    manuallyAdded: dbProg.manuallyAdded,
    difficulty: dbProg.difficulty ?? undefined,
    notes: dbProg.notes ?? undefined,
    isEthereal: dbProg.isEthereal,
    fromInitialScan: dbProg.fromInitialScan,
  };
}

export function dbSaveFileStateToSaveFileState(dbState: DbSaveFileState): SaveFileState {
  return {
    id: dbState.id,
    filePath: dbState.filePath,
    lastModified: new Date(dbState.lastModified),
    lastParsed: new Date(dbState.lastParsed),
    created: fromDbTimestamp(dbState.createdAt),
    updated: fromDbTimestamp(dbState.updatedAt),
  };
}

export function dbSessionToSession(dbSession: DbSession): Session {
  return {
    id: dbSession.id,
    startTime: new Date(dbSession.startTime),
    endTime: fromISOString(dbSession.endTime),
    totalRunTime: dbSession.totalRunTime ?? 0,
    totalSessionTime: dbSession.totalSessionTime ?? 0,
    runCount: dbSession.runCount ?? 0,
    archived: dbSession.archived ?? false,
    notes: dbSession.notes ?? undefined,
    created: fromDbTimestamp(dbSession.createdAt),
    lastUpdated: fromDbTimestamp(dbSession.updatedAt),
  };
}

export function dbRunToRun(dbRun: DbRun): Run {
  return {
    id: dbRun.id,
    sessionId: dbRun.sessionId,
    characterId: dbRun.characterId ?? undefined,
    runNumber: dbRun.runNumber,
    startTime: new Date(dbRun.startTime),
    endTime: fromISOString(dbRun.endTime),
    duration: dbRun.duration ?? undefined,
    created: fromDbTimestamp(dbRun.createdAt),
    lastUpdated: fromDbTimestamp(dbRun.updatedAt),
  };
}

export function dbRunItemToRunItem(dbRunItem: DbRunItem): RunItem {
  return {
    id: dbRunItem.id,
    runId: dbRunItem.runId,
    grailProgressId: dbRunItem.grailProgressId ?? undefined,
    name: dbRunItem.name ?? undefined,
    foundTime: new Date(dbRunItem.foundTime),
    created: fromDbTimestamp(dbRunItem.createdAt),
  };
}

function extractVaultItemSpatialFields(dbItem: DbVaultItem) {
  return {
    stashTab: dbItem.stashTab ?? undefined,
    gridX: dbItem.gridX ?? undefined,
    gridY: dbItem.gridY ?? undefined,
    gridWidth: dbItem.gridWidth ?? undefined,
    gridHeight: dbItem.gridHeight ?? undefined,
    equippedSlotId: dbItem.equippedSlotId ?? undefined,
  };
}

export function dbVaultItemToVaultItem(dbItem: DbVaultItem): VaultItem {
  return {
    id: dbItem.id,
    fingerprint: dbItem.fingerprint,
    itemName: dbItem.itemName,
    itemCode: dbItem.itemCode ?? undefined,
    quality: dbItem.quality,
    ethereal: dbItem.ethereal,
    socketCount: dbItem.socketCount ?? undefined,
    stackCount: dbItem.stackCount ?? 1,
    rawItemJson: dbItem.rawItemJson,
    sourceCharacterId: dbItem.sourceCharacterId ?? undefined,
    sourceCharacterName: dbItem.sourceCharacterName ?? undefined,
    sourceFileType: dbItem.sourceFileType,
    sourceFilePath: dbItem.sourceFilePath ?? undefined,
    locationContext: dbItem.locationContext,
    ...extractVaultItemSpatialFields(dbItem),
    iconFileName: dbItem.iconFileName ?? undefined,
    isSocketedItem: dbItem.isSocketedItem ?? false,
    grailItemId: dbItem.grailItemId ?? undefined,
    isPresentInLatestScan: dbItem.isPresentInLatestScan,
    lastSeenAt: fromISOString(dbItem.lastSeenAt),
    vaultedAt: fromISOString(dbItem.vaultedAt),
    unvaultedAt: fromISOString(dbItem.unvaultedAt),
    created: fromDbTimestamp(dbItem.createdAt),
    lastUpdated: fromDbTimestamp(dbItem.updatedAt),
  };
}
