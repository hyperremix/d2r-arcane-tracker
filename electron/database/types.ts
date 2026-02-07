import type Database from 'better-sqlite3';
import type { DrizzleDb } from './drizzle';

export interface DatabaseContext {
  readonly db: DrizzleDb;
  readonly rawDb: Database.Database;
  readonly dbPath: string;
}
