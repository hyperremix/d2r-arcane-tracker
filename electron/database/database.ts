import path from 'node:path';
import type Database from 'better-sqlite3';
import { app } from 'electron';
import type {
  Character,
  GrailProgress,
  Item,
  Run,
  RunItem,
  RunStatistics,
  SaveFileState,
  Session,
  Settings,
  VaultItem,
  VaultItemFilter,
  VaultItemSearchResult,
  VaultItemUpsertInput,
} from '../types/grail';
import * as charactersModule from './characters';
import { openConnection, type RestoreSource, restoreDatabase } from './connection';
import { createDrizzleDb, type DrizzleDb } from './drizzle';
import * as itemsModule from './items';
import * as managementModule from './management';
import * as progressModule from './progress';
import * as runItemsModule from './run-items';
import * as runsModule from './runs';
import * as saveFileStatesModule from './save-file-states';
import * as schemaModule from './schema';
import * as sessionsModule from './sessions';
import * as settingsModule from './settings';
import * as statisticsModule from './statistics';
import * as vaultItemsModule from './vault-items';

/**
 * Main database class for managing Holy Grail tracking data.
 * Handles SQLite database operations for items, characters, progress, and settings.
 */
class GrailDatabase {
  rawDb: Database.Database;
  db: DrizzleDb;
  dbPath: string;
  private characterMapCache: Map<string, string> | null = null;

  /**
   * Initializes the GrailDatabase instance.
   * Sets up the database connection, configures pragmas, and initializes the schema.
   * The database file is stored in the user's data directory.
   */
  constructor() {
    // Get the user data directory
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'grail.db');

    // Initialize database (5s busy timeout, WAL journaling, foreign keys)
    this.rawDb = openConnection(this.dbPath);

    // Create Drizzle instance
    this.db = createDrizzleDb(this.rawDb);

    this.initializeSchema();
  }

  /**
   * Applies pending migrations and prepares settings and item data (see `initializeSchema`).
   * Called when the database is opened.
   * @throws {Error} If schema initialization fails
   */
  private initializeSchema(): void {
    try {
      schemaModule.initializeSchema(this);
    } catch (error) {
      console.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  /**
   * Runs `fn` in a database transaction: all its writes are committed together, or none if it
   * throws. Nested calls become savepoints.
   * @param fn - Synchronous function doing the reads and writes
   * @returns The result of `fn`
   */
  transaction<T>(fn: () => T): T {
    return this.rawDb.transaction(fn)();
  }

  // Items
  getAllItems(): Item[] {
    return itemsModule.getAllItems(this);
  }
  getAllRunewords(): Item[] {
    return itemsModule.getAllRunewords(this);
  }
  getFilteredItems(userSettings: Settings): Item[] {
    return itemsModule.getFilteredItems(this, userSettings);
  }
  insertItems(itemsToInsert: Item[]): void {
    itemsModule.insertItems(this, itemsToInsert);
  }

  // Characters
  getAllCharacters(): Character[] {
    return charactersModule.getAllCharacters(this);
  }
  getCharacterMap(): Map<string, string> {
    if (!this.characterMapCache) {
      const characters = this.getAllCharacters();
      this.characterMapCache = new Map(characters.map((c) => [c.id, c.name]));
    }
    return this.characterMapCache;
  }
  updateCharacter(id: string, updates: Partial<Character>): void {
    charactersModule.updateCharacter(this, id, updates);
    this.characterMapCache = null;
  }
  upsertCharactersBatch(chars: Character[]): void {
    charactersModule.upsertCharactersBatch(this, chars);
    this.characterMapCache = null;
  }
  getCharacterByName(name: string): Character | undefined {
    return charactersModule.getCharacterByName(this, name);
  }
  getCharacterById(id: string): Character | undefined {
    return charactersModule.getCharacterById(this, id);
  }
  getCharacterBySaveFilePath(saveFilePath: string): Character | undefined {
    return charactersModule.getCharacterBySaveFilePath(this, saveFilePath);
  }
  upsertCharacter(character: Character): void {
    charactersModule.upsertCharacter(this, character);
    this.characterMapCache = null;
  }

  // Progress
  getAllProgress(): GrailProgress[] {
    return progressModule.getAllProgress(this);
  }
  getFilteredProgress(userSettings: Settings): GrailProgress[] {
    return progressModule.getFilteredProgress(this, userSettings);
  }
  getProgressByCharacter(characterId: string): GrailProgress[] {
    return progressModule.getProgressByCharacter(this, characterId);
  }
  getProgressByItem(itemId: string): GrailProgress[] {
    return progressModule.getProgressByItem(this, itemId);
  }
  getProgressById(progressId: string): GrailProgress | null {
    return progressModule.getProgressById(this, progressId);
  }
  getCharacterProgress(characterId: string, itemId: string): GrailProgress | null {
    return progressModule.getCharacterProgress(this, characterId, itemId);
  }
  upsertProgress(progress: GrailProgress): void {
    progressModule.upsertProgress(this, progress);
  }
  upsertProgressBatch(progressList: GrailProgress[]): void {
    progressModule.upsertProgressBatch(this, progressList);
  }
  deleteManualProgress(progressId: string): boolean {
    return progressModule.deleteManualProgress(this, progressId);
  }

  // Settings
  getAllSettings(): Settings {
    return settingsModule.getAllSettings(this);
  }
  setSetting(key: keyof Settings, value: string): void {
    settingsModule.setSetting(this, key, value);
  }

  // Statistics
  getOverallRunStatistics(): RunStatistics {
    return statisticsModule.getOverallRunStatistics(this);
  }

  // Save file states
  getSaveFileState(filePath: string): SaveFileState | null {
    return saveFileStatesModule.getSaveFileState(this, filePath);
  }
  upsertSaveFileState(state: SaveFileState): void {
    saveFileStatesModule.upsertSaveFileState(this, state);
  }
  getAllSaveFileStates(): SaveFileState[] {
    return saveFileStatesModule.getAllSaveFileStates(this);
  }
  deleteSaveFileState(filePath: string): void {
    saveFileStatesModule.deleteSaveFileState(this, filePath);
  }
  clearAllSaveFileStates(): void {
    saveFileStatesModule.clearAllSaveFileStates(this);
  }

  // Sessions
  getAllSessions(includeArchived = false): Session[] {
    return sessionsModule.getAllSessions(this, includeArchived);
  }
  getSessionById(sessionId: string): Session | null {
    return sessionsModule.getSessionById(this, sessionId);
  }
  getActiveSession(): Session | null {
    return sessionsModule.getActiveSession(this);
  }
  upsertSession(session: Session): void {
    sessionsModule.upsertSession(this, session);
  }
  archiveSession(sessionId: string): void {
    sessionsModule.archiveSession(this, sessionId);
  }
  deleteSession(sessionId: string): void {
    sessionsModule.deleteSession(this, sessionId);
  }

  // Runs
  getRunsBySession(sessionId: string): Run[] {
    return runsModule.getRunsBySession(this, sessionId);
  }
  getActiveRun(sessionId: string): Run | null {
    return runsModule.getActiveRun(this, sessionId);
  }
  upsertRun(run: Run): void {
    runsModule.upsertRun(this, run);
  }
  deleteRun(runId: string): void {
    runsModule.deleteRun(this, runId);
  }

  // Run items
  getRunItems(runId: string): RunItem[] {
    return runItemsModule.getRunItems(this, runId);
  }
  getSessionItems(sessionId: string): RunItem[] {
    return runItemsModule.getSessionItems(this, sessionId);
  }
  addRunItem(runItem: RunItem): void {
    runItemsModule.addRunItem(this, runItem);
  }
  addRunItemsBatch(items: RunItem[]): void {
    runItemsModule.addRunItemsBatch(this, items);
  }
  deleteRunItem(itemId: string): void {
    runItemsModule.deleteRunItem(this, itemId);
  }

  // Vault items
  getVaultItemById(itemId: string): VaultItem | undefined {
    return vaultItemsModule.getVaultItemById(this, itemId);
  }
  addVaultItemWithUndo(item: VaultItemUpsertInput): vaultItemsModule.VaultAddResult {
    return vaultItemsModule.addVaultItemWithUndo(this, item);
  }
  removeVaultItem(itemId: string): void {
    vaultItemsModule.removeVaultItem(this, itemId);
  }
  searchVaultItems(filter: VaultItemFilter): VaultItemSearchResult {
    return vaultItemsModule.searchVaultItems(this, filter);
  }
  reconcileVaultItemsForScan(scan: vaultItemsModule.VaultScanReconciliationInput): void {
    vaultItemsModule.reconcileVaultItemsForScan(this, scan);
  }
  getVaultSourceFilePathsPresentInLatestScan(): string[] {
    return vaultItemsModule.getVaultSourceFilePathsPresentInLatestScan(this);
  }
  markVaultItemsMissingForSourceFiles(sourceFilePaths: string[]): void {
    vaultItemsModule.markVaultItemsMissingForSourceFiles(this, sourceFilePaths);
  }
  unvaultVaultItem(itemId: string, withdrawCount?: number): void {
    vaultItemsModule.unvaultVaultItem(this, itemId, withdrawCount);
  }

  // Management
  backup(backupPath: string): Promise<void> {
    return managementModule.backup(this, backupPath);
  }
  close(): void {
    managementModule.close(this);
  }
  truncateUserData(newSaveDir?: string): void {
    managementModule.truncateUserData(this, newSaveDir);
    this.characterMapCache = null;
  }
  getDatabasePath(): string {
    return managementModule.getDatabasePath(this);
  }

  restore(backupPath: string): void {
    this.restoreFrom({ kind: 'file', path: backupPath });
  }

  restoreFromBuffer(backupBuffer: Buffer): void {
    this.restoreFrom({ kind: 'buffer', data: backupBuffer });
  }

  /**
   * Validates the backup, swaps it in and reopens the connection with the standard pragmas.
   * The previous database is restored if anything fails after the swap; if that rollback
   * fails too, `rawDb` stays closed until the app restarts (the old data is kept as `.pre-restore`).
   * @param source - The backup to restore
   */
  private restoreFrom(source: RestoreSource): void {
    restoreDatabase(
      {
        dbPath: this.dbPath,
        closeConnection: () => this.rawDb.close(),
        openConnectionAndInitialize: () => this.openConnectionAndInitialize(),
      },
      source,
    );
  }

  /**
   * Opens a new connection on the database file and initializes the schema.
   * Closes the new connection again if schema initialization fails.
   */
  private openConnectionAndInitialize(): void {
    const rawDb = openConnection(this.dbPath);
    this.rawDb = rawDb;
    this.db = createDrizzleDb(rawDb);
    this.characterMapCache = null;
    try {
      this.initializeSchema();
    } catch (error) {
      rawDb.close();
      throw error;
    }
  }
}

export { GrailDatabase };
