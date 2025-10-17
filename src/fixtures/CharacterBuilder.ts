import type { Character, CharacterClass } from 'electron/types/grail';

/**
 * Builder class for creating Character test fixtures
 * Follows the builder pattern for flexible test data creation
 */
export class CharacterBuilder {
  private character: Character = {
    id: 'default-character',
    name: 'Default Character',
    characterClass: 'sorceress',
    level: 1,
    hardcore: false,
    expansion: true,
    lastUpdated: new Date('2024-01-01'),
    created: new Date('2024-01-01'),
  };

  /**
   * Create a new builder instance
   */
  static new(): CharacterBuilder {
    return new CharacterBuilder();
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
    this.character.characterClass = characterClass;
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
   * Set hardcore status
   */
  withHardcore(hardcore: boolean): this {
    this.character.hardcore = hardcore;
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
   * Set the save file path
   */
  withSaveFilePath(saveFilePath: string): this {
    this.character.saveFilePath = saveFilePath;
    return this;
  }

  /**
   * Remove the save file path
   */
  withoutSaveFilePath(): this {
    delete this.character.saveFilePath;
    return this;
  }

  /**
   * Set the last updated date
   */
  withLastUpdated(lastUpdated: Date): this {
    this.character.lastUpdated = lastUpdated;
    return this;
  }

  /**
   * Set the created date
   */
  withCreated(created: Date): this {
    this.character.created = created;
    return this;
  }

  /**
   * Set the deleted date
   */
  withDeleted(deleted: Date): this {
    this.character.deleted = deleted;
    return this;
  }

  /**
   * Remove the deleted date
   */
  withoutDeleted(): this {
    delete this.character.deleted;
    return this;
  }

  /**
   * Build and return the Character
   */
  build(): Character {
    return { ...this.character };
  }

  /**
   * Build multiple characters with the same base configuration
   */
  buildMany(count: number): Character[] {
    return Array.from({ length: count }, (_, index) => ({
      ...this.character,
      id: `${this.character.id}-${index}`,
      name: `${this.character.name} ${index + 1}`,
    }));
  }
}
