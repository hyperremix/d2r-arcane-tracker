import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit configuration. The drizzle schema in `electron/database/drizzle/schema` is the
 * single source of truth for the database schema. `bun run db:generate` writes a new migration
 * to `electron/database/migrations`; the app applies pending migrations at startup.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './electron/database/drizzle/schema/index.ts',
  out: './electron/database/migrations',
});
