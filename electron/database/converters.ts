import type {
  Character,
  GrailProgress,
  Item,
  Run,
  RunItem,
  SaveFileState,
  Session,
  VaultCategory,
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
  DbVaultCategory,
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
    lastUpdated: new Date(dbChar.updatedAt ?? new Date().toISOString()),
    created: new Date(dbChar.createdAt ?? new Date().toISOString()),
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
    created: new Date(dbState.createdAt ?? new Date().toISOString()),
    updated: new Date(dbState.updatedAt ?? new Date().toISOString()),
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
    created: new Date(dbSession.createdAt ?? new Date().toISOString()),
    lastUpdated: new Date(dbSession.updatedAt ?? new Date().toISOString()),
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
    created: new Date(dbRun.createdAt ?? new Date().toISOString()),
    lastUpdated: new Date(dbRun.updatedAt ?? new Date().toISOString()),
  };
}

export function dbRunItemToRunItem(dbRunItem: DbRunItem): RunItem {
  return {
    id: dbRunItem.id,
    runId: dbRunItem.runId,
    grailProgressId: dbRunItem.grailProgressId ?? undefined,
    name: dbRunItem.name ?? undefined,
    foundTime: new Date(dbRunItem.foundTime),
    created: new Date(dbRunItem.createdAt ?? new Date().toISOString()),
  };
}

export function dbVaultCategoryToVaultCategory(dbCategory: DbVaultCategory): VaultCategory {
  return {
    id: dbCategory.id,
    name: dbCategory.name,
    color: dbCategory.color ?? undefined,
    metadata: dbCategory.metadata ?? undefined,
    created: new Date(dbCategory.createdAt ?? new Date().toISOString()),
    lastUpdated: new Date(dbCategory.updatedAt ?? new Date().toISOString()),
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
    rawItemJson: dbItem.rawItemJson,
    sourceCharacterId: dbItem.sourceCharacterId ?? undefined,
    sourceCharacterName: dbItem.sourceCharacterName ?? undefined,
    sourceFileType: dbItem.sourceFileType,
    locationContext: dbItem.locationContext,
    stashTab: dbItem.stashTab ?? undefined,
    gridX: dbItem.gridX ?? undefined,
    gridY: dbItem.gridY ?? undefined,
    gridWidth: dbItem.gridWidth ?? undefined,
    gridHeight: dbItem.gridHeight ?? undefined,
    equippedSlotId: dbItem.equippedSlotId ?? undefined,
    iconFileName: dbItem.iconFileName ?? undefined,
    isSocketedItem: dbItem.isSocketedItem ?? false,
    grailItemId: dbItem.grailItemId ?? undefined,
    isPresentInLatestScan: dbItem.isPresentInLatestScan,
    lastSeenAt: fromISOString(dbItem.lastSeenAt),
    vaultedAt: fromISOString(dbItem.vaultedAt),
    unvaultedAt: fromISOString(dbItem.unvaultedAt),
    created: new Date(dbItem.createdAt ?? new Date().toISOString()),
    lastUpdated: new Date(dbItem.updatedAt ?? new Date().toISOString()),
  };
}
