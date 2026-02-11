import { copyFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
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
  SessionStats,
  Settings,
  VaultCategory,
  VaultCategoryCreateInput,
  VaultCategoryUpdateInput,
  VaultItem,
  VaultItemFilter,
  VaultItemSearchResult,
  VaultItemUpdateInput,
  VaultItemUpsertByFingerprintInput,
  VaultItemUpsertInput,
} from '../types/grail';
import * as charactersModule from './characters';
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
import * as vaultCategoriesModule from './vault-categories';
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

    // Initialize database
    this.rawDb = new Database(this.dbPath, { timeout: 5000 }); // 5s busy timeout
    this.rawDb.pragma('journal_mode = WAL');
    this.rawDb.pragma('foreign_keys = ON');

    // Create Drizzle instance
    this.db = createDrizzleDb(this.rawDb);

    this.initializeSchema();
  }

  /**
   * Initializes the database schema by creating tables and indexes.
   * This method is called during database construction and handles schema creation errors.
   * @throws {Error} If schema initialization fails
   */
  private initializeSchema(): void {
    try {
      schemaModule.createSchema(this);
    } catch (error) {
      console.error('Failed to initialize database schema:', error);
      throw error;
    }
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
  getCharacterProgress(characterId: string, itemId: string): GrailProgress | null {
    return progressModule.getCharacterProgress(this, characterId, itemId);
  }
  upsertProgress(progress: GrailProgress): void {
    progressModule.upsertProgress(this, progress);
  }
  upsertProgressBatch(progressList: GrailProgress[]): void {
    progressModule.upsertProgressBatch(this, progressList);
  }

  // Settings
  getAllSettings(): Settings {
    return settingsModule.getAllSettings(this);
  }
  setSetting(key: keyof Settings, value: string): void {
    settingsModule.setSetting(this, key, value);
  }

  // Statistics
  getFilteredGrailStatistics(
    userSettings: Settings,
    characterId?: string,
  ): {
    totalItems: number;
    foundItems: number;
    uniqueItems: number;
    setItems: number;
    runes: number;
    foundUnique: number;
    foundSet: number;
    foundRunes: number;
  } {
    return statisticsModule.getFilteredGrailStatistics(this, userSettings, characterId);
  }
  getSessionStatistics(sessionId: string): SessionStats | null {
    return statisticsModule.getSessionStatistics(this, sessionId);
  }
  getOverallRunStatistics(): RunStatistics {
    return statisticsModule.getOverallRunStatistics(this);
  }

  // Schema/Seeding
  upsertItemsFromGrailData(): void {
    schemaModule.upsertItemsFromGrailData(this);
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
  getVaultItemById(itemId: string): VaultItem | null {
    return vaultItemsModule.getVaultItemById(this, itemId);
  }
  addVaultItem(item: VaultItemUpsertInput): VaultItem {
    return vaultItemsModule.addVaultItem(this, item);
  }
  updateVaultItem(itemId: string, updates: VaultItemUpdateInput): VaultItem | null {
    return vaultItemsModule.updateVaultItem(this, itemId, updates);
  }
  removeVaultItem(itemId: string): void {
    vaultItemsModule.removeVaultItem(this, itemId);
  }
  upsertVaultItemByFingerprint(input: VaultItemUpsertByFingerprintInput): VaultItem {
    return vaultItemsModule.upsertVaultItemByFingerprint(this, input);
  }
  searchVaultItems(filter: VaultItemFilter): VaultItemSearchResult {
    return vaultItemsModule.searchVaultItems(this, filter);
  }
  reconcileVaultItemsForScan(scan: {
    sourceFileType: 'd2s' | 'sss' | 'd2x' | 'd2i';
    sourceCharacterId?: string;
    sourceCharacterName?: string;
    presentFingerprints: string[];
    lastSeenAt?: Date;
  }): void {
    vaultItemsModule.reconcileVaultItemsForScan(this, scan);
  }
  setVaultItemsPresentInLatestScan(
    fingerprints: string[],
    present: boolean,
    lastSeenAt?: Date,
    sourceCharacterName?: string,
  ): void {
    vaultItemsModule.setVaultItemsPresentInLatestScan(
      this,
      fingerprints,
      present,
      lastSeenAt,
      sourceCharacterName,
    );
  }
  markVaultItemAsMissing(fingerprint: string, sourceCharacterName?: string): void {
    vaultItemsModule.markVaultItemAsMissing(this, fingerprint, sourceCharacterName);
  }

  // Vault categories
  getAllVaultCategories(): VaultCategory[] {
    return vaultCategoriesModule.getAllVaultCategories(this);
  }
  getVaultCategoryById(categoryId: string): VaultCategory | null {
    return vaultCategoriesModule.getVaultCategoryById(this, categoryId);
  }
  addVaultCategory(input: VaultCategoryCreateInput): void {
    vaultCategoriesModule.addVaultCategory(this, input);
  }
  updateVaultCategory(categoryId: string, updates: VaultCategoryUpdateInput): void {
    vaultCategoriesModule.updateVaultCategory(this, categoryId, updates);
  }
  removeVaultCategory(categoryId: string): void {
    vaultCategoriesModule.removeVaultCategory(this, categoryId);
  }
  setVaultItemCategories(vaultItemId: string, categoryIds: string[]): void {
    vaultCategoriesModule.setVaultItemCategories(this, vaultItemId, categoryIds);
  }

  // Management
  backup(backupPath: string): void {
    managementModule.backup(this, backupPath);
  }
  close(): void {
    managementModule.close(this);
  }
  truncateUserData(): void {
    managementModule.truncateUserData(this);
    this.characterMapCache = null;
  }
  getDatabasePath(): string {
    return managementModule.getDatabasePath(this);
  }

  // Restore methods stay as full implementations because they mutate this.rawDb/this.db
  restore(backupPath: string): void {
    // Save current database so we can recover if the restore fails
    const tempPath = `${this.dbPath}.pre-restore`;
    copyFileSync(this.dbPath, tempPath);

    this.rawDb.close();
    try {
      copyFileSync(backupPath, this.dbPath);
    } catch (error) {
      // Restore original database file from pre-restore backup
      copyFileSync(tempPath, this.dbPath);
      this.rawDb = new Database(this.dbPath);
      this.db = createDrizzleDb(this.rawDb);
      throw error;
    } finally {
      try {
        unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    this.rawDb = new Database(this.dbPath);
    this.db = createDrizzleDb(this.rawDb);
    this.characterMapCache = null;
    this.initializeSchema();
  }

  restoreFromBuffer(backupBuffer: Buffer): void {
    // Save current database so we can recover if the restore fails
    const tempPath = `${this.dbPath}.pre-restore`;
    copyFileSync(this.dbPath, tempPath);

    this.rawDb.close();
    try {
      writeFileSync(this.dbPath, backupBuffer);
    } catch (error) {
      // Restore original database file from pre-restore backup
      copyFileSync(tempPath, this.dbPath);
      this.rawDb = new Database(this.dbPath);
      this.db = createDrizzleDb(this.rawDb);
      throw error;
    } finally {
      try {
        unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    this.rawDb = new Database(this.dbPath);
    this.db = createDrizzleDb(this.rawDb);
    this.characterMapCache = null;
    this.initializeSchema();
  }
}

const grailDatabase = new GrailDatabase();

export { GrailDatabase, grailDatabase };
