import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export type DbSetting = typeof settings.$inferSelect;
export type DbSettingInsert = typeof settings.$inferInsert;
