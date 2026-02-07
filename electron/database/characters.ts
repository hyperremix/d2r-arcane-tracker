import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Character } from '../types/grail';
import { dbCharacterToCharacter, toISOString } from './converters';
import { schema } from './drizzle';
import type { DatabaseContext } from './types';

const { characters } = schema;

export function getAllCharacters(ctx: DatabaseContext): Character[] {
  const dbChars = ctx.db
    .select()
    .from(characters)
    .where(isNull(characters.deletedAt))
    .orderBy(desc(characters.updatedAt))
    .all();
  return dbChars.map(dbCharacterToCharacter);
}

export function updateCharacter(
  ctx: DatabaseContext,
  id: string,
  updates: Partial<Character>,
): void {
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic update object
  const updateObj: Record<string, any> = {};

  if (updates.name !== undefined) updateObj.name = updates.name;
  if (updates.characterClass !== undefined) updateObj.characterClass = updates.characterClass;
  if (updates.level !== undefined) updateObj.level = updates.level;
  if (updates.hardcore !== undefined) updateObj.hardcore = updates.hardcore;
  if (updates.expansion !== undefined) updateObj.expansion = updates.expansion;
  if (updates.saveFilePath !== undefined) updateObj.saveFilePath = updates.saveFilePath;
  if (updates.deleted !== undefined) updateObj.deletedAt = toISOString(updates.deleted);

  if (Object.keys(updateObj).length === 0) return;

  ctx.db.update(characters).set(updateObj).where(eq(characters.id, id)).run();
}

export function upsertCharactersBatch(ctx: DatabaseContext, chars: Character[]): void {
  if (chars.length === 0) return;

  const insertMany = ctx.rawDb.transaction(() => {
    for (const char of chars) {
      ctx.db
        .insert(characters)
        .values({
          id: char.id,
          name: char.name,
          characterClass: char.characterClass,
          level: char.level,
          hardcore: char.hardcore,
          expansion: char.expansion,
          saveFilePath: char.saveFilePath ?? null,
        })
        .onConflictDoUpdate({
          target: characters.id,
          set: {
            name: char.name,
            characterClass: char.characterClass,
            level: char.level,
            hardcore: char.hardcore,
            expansion: char.expansion,
            saveFilePath: char.saveFilePath ?? null,
          },
        })
        .run();
    }
  });
  insertMany();
}

export function getCharacterByName(ctx: DatabaseContext, name: string): Character | undefined {
  const dbChar = ctx.db
    .select()
    .from(characters)
    .where(and(eq(characters.name, name), isNull(characters.deletedAt)))
    .get();
  return dbChar ? dbCharacterToCharacter(dbChar) : undefined;
}

export function getCharacterById(ctx: DatabaseContext, id: string): Character | undefined {
  const dbChar = ctx.db
    .select()
    .from(characters)
    .where(and(eq(characters.id, id), isNull(characters.deletedAt)))
    .get();
  return dbChar ? dbCharacterToCharacter(dbChar) : undefined;
}

export function getCharacterBySaveFilePath(
  ctx: DatabaseContext,
  saveFilePath: string,
): Character | undefined {
  const dbChar = ctx.db
    .select()
    .from(characters)
    .where(and(eq(characters.saveFilePath, saveFilePath), isNull(characters.deletedAt)))
    .get();
  return dbChar ? dbCharacterToCharacter(dbChar) : undefined;
}

export function upsertCharacter(ctx: DatabaseContext, character: Character): void {
  ctx.db
    .insert(characters)
    .values({
      id: character.id,
      name: character.name,
      characterClass: character.characterClass,
      level: character.level,
      hardcore: character.hardcore,
      expansion: character.expansion,
      saveFilePath: character.saveFilePath ?? null,
    })
    .onConflictDoUpdate({
      target: characters.id,
      set: {
        name: character.name,
        characterClass: character.characterClass,
        level: character.level,
        hardcore: character.hardcore,
        expansion: character.expansion,
        saveFilePath: character.saveFilePath ?? null,
      },
    })
    .run();
}
