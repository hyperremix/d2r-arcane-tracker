import type { CharacterClass, DatabaseCharacter } from 'electron/types/grail';

/**
 * Builder class for creating DatabaseCharacter test fixtures
 * Follows the builder pattern for flexible test data creation
 */
export class DatabaseCharacterBuilder {
  private character: DatabaseCharacter = {
    id: 'default-char-id',
    name: 'DefaultCharacter',
    character_class: 'amazon',
    level: 1,
    difficulty: 'normal',
    hardcore: false,
    expansion: true,
    save_file_path: undefined,
    deleted_at: undefined,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  /**
   * Create a new builder instance
   */
  static new(): DatabaseCharacterBuilder {
    return new DatabaseCharacterBuilder();
  }

  /**
   * Set the character ID
   */
  withId(id: string): this {
    this.character.id = id;
    return this;
  }

  /**
   * Set the character name
   */
  withName(name: string): this {
    this.character.name = name;
    return this;
  }

  /**
   * Set the character class
   */
  withCharacterClass(characterClass: CharacterClass): this {
    this.character.character_class = characterClass;
    return this;
  }

  /**
   * Set the character level
   */
  withLevel(level: number): this {
    this.character.level = level;
    return this;
  }

  /**
   * Set the difficulty
   */
  withDifficulty(difficulty: DatabaseCharacter['difficulty']): this {
    this.character.difficulty = difficulty;
    return this;
  }

  /**
   * Set as hardcore character
   */
  asHardcore(): this {
    this.character.hardcore = true;
    return this;
  }

  /**
   * Set as softcore character
   */
  asSoftcore(): this {
    this.character.hardcore = false;
    return this;
  }

  /**
   * Set expansion status
   */
  withExpansion(expansion: boolean): this {
    this.character.expansion = expansion;
    return this;
  }

  /**
   * Set as expansion character
   */
  asExpansion(): this {
    this.character.expansion = true;
    return this;
  }

  /**
   * Set as classic character
   */
  asClassic(): this {
    this.character.expansion = false;
    return this;
  }

  /**
   * Set the save file path
   */
  withSaveFilePath(saveFilePath: string): this {
    this.character.save_file_path = saveFilePath;
    return this;
  }

  /**
   * Remove the save file path
   */
  withoutSaveFilePath(): this {
    this.character.save_file_path = undefined;
    return this;
  }

  /**
   * Set the deleted timestamp
   */
  withDeletedAt(deletedAt: string): this {
    this.character.deleted_at = deletedAt;
    return this;
  }

  /**
   * Set as deleted character
   */
  asDeleted(): this {
    this.character.deleted_at = '2024-01-01T00:00:00.000Z';
    return this;
  }

  /**
   * Set as active character (not deleted)
   */
  asActive(): this {
    this.character.deleted_at = undefined;
    return this;
  }

  /**
   * Set the created timestamp
   */
  withCreatedAt(createdAt: string): this {
    this.character.created_at = createdAt;
    return this;
  }

  /**
   * Set the updated timestamp
   */
  withUpdatedAt(updatedAt: string): this {
    this.character.updated_at = updatedAt;
    return this;
  }

  /**
   * Set as Amazon character (common test case)
   */
  asAmazon(): this {
    this.character.character_class = 'amazon';
    return this;
  }

  /**
   * Set as Sorceress character (common test case)
   */
  asSorceress(): this {
    this.character.character_class = 'sorceress';
    return this;
  }

  /**
   * Set as Paladin character (common test case)
   */
  asPaladin(): this {
    this.character.character_class = 'paladin';
    return this;
  }

  /**
   * Set as Barbarian character (common test case)
   */
  asBarbarian(): this {
    this.character.character_class = 'barbarian';
    return this;
  }

  /**
   * Set as Necromancer character (common test case)
   */
  asNecromancer(): this {
    this.character.character_class = 'necromancer';
    return this;
  }

  /**
   * Set as Druid character (common test case)
   */
  asDruid(): this {
    this.character.character_class = 'druid';
    return this;
  }

  /**
   * Set as Assassin character (common test case)
   */
  asAssassin(): this {
    this.character.character_class = 'assassin';
    return this;
  }

  /**
   * Build and return the DatabaseCharacter
   */
  build(): DatabaseCharacter {
    return { ...this.character };
  }

  /**
   * Build multiple characters with the same base configuration
   */
  buildMany(count: number): DatabaseCharacter[] {
    return Array.from({ length: count }, (_, index) => ({
      ...this.character,
      id: `${this.character.id}-${index}`,
      name: `${this.character.name} ${index + 1}`,
    }));
  }
}
