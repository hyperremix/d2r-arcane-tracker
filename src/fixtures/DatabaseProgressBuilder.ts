import type { DatabaseGrailProgress } from 'electron/types/grail';

/**
 * Builder class for creating DatabaseGrailProgress test fixtures
 * Follows the builder pattern for flexible test data creation
 */
export class DatabaseProgressBuilder {
  private progress: DatabaseGrailProgress = {
    id: 'default-progress-id',
    character_id: 'default-character-id',
    item_id: 'default-item-id',
    found_date: null,
    manually_added: 0,
    auto_detected: 1,
    difficulty: null,
    notes: null,
    is_ethereal: 0,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };

  /**
   * Create a new builder instance
   */
  static new(): DatabaseProgressBuilder {
    return new DatabaseProgressBuilder();
  }

  /**
   * Set the progress ID
   */
  withId(id: string): this {
    this.progress.id = id;
    return this;
  }

  /**
   * Set the character ID
   */
  withCharacterId(characterId: string): this {
    this.progress.character_id = characterId;
    return this;
  }

  /**
   * Set the item ID
   */
  withItemId(itemId: string): this {
    this.progress.item_id = itemId;
    return this;
  }

  /**
   * Set as found item (sets found_date to now)
   */
  asFound(): this {
    this.progress.found_date = new Date().toISOString();
    return this;
  }

  /**
   * Set as not found item (sets found_date to null)
   */
  asNotFound(): this {
    this.progress.found_date = null;
    return this;
  }

  /**
   * Set the found date
   */
  withFoundDate(foundDate: string): this {
    this.progress.found_date = foundDate;
    return this;
  }

  /**
   * Remove the found date
   */
  withoutFoundDate(): this {
    this.progress.found_date = null;
    return this;
  }

  /**
   * Set the manually added status
   */
  withManuallyAdded(manuallyAdded: boolean): this {
    this.progress.manually_added = manuallyAdded ? 1 : 0;
    return this;
  }

  /**
   * Set as manually added
   */
  asManuallyAdded(): this {
    this.progress.manually_added = 1;
    return this;
  }

  /**
   * Set as auto detected
   */
  asAutoDetected(): this {
    this.progress.manually_added = 0;
    return this;
  }

  /**
   * Set the auto detected status
   */
  withAutoDetected(autoDetected: boolean): this {
    this.progress.auto_detected = autoDetected ? 1 : 0;
    return this;
  }

  /**
   * Set the difficulty
   */
  withDifficulty(difficulty: DatabaseGrailProgress['difficulty']): this {
    this.progress.difficulty = difficulty;
    return this;
  }

  /**
   * Set as normal difficulty
   */
  asNormalDifficulty(): this {
    this.progress.difficulty = 'normal';
    return this;
  }

  /**
   * Set as nightmare difficulty
   */
  asNightmareDifficulty(): this {
    this.progress.difficulty = 'nightmare';
    return this;
  }

  /**
   * Set as hell difficulty
   */
  asHellDifficulty(): this {
    this.progress.difficulty = 'hell';
    return this;
  }

  /**
   * Remove difficulty
   */
  withoutDifficulty(): this {
    this.progress.difficulty = null;
    return this;
  }

  /**
   * Set the notes
   */
  withNotes(notes: string): this {
    this.progress.notes = notes;
    return this;
  }

  /**
   * Remove the notes
   */
  withoutNotes(): this {
    this.progress.notes = null;
    return this;
  }

  /**
   * Set the ethereal status
   */
  withIsEthereal(isEthereal: boolean): this {
    this.progress.is_ethereal = isEthereal ? 1 : 0;
    return this;
  }

  /**
   * Set as ethereal item
   */
  asEthereal(): this {
    this.progress.is_ethereal = 1;
    return this;
  }

  /**
   * Set as normal (non-ethereal) item
   */
  asNormal(): this {
    this.progress.is_ethereal = 0;
    return this;
  }

  /**
   * Set the created timestamp
   */
  withCreatedAt(createdAt: string): this {
    this.progress.created_at = createdAt;
    return this;
  }

  /**
   * Set the updated timestamp
   */
  withUpdatedAt(updatedAt: string): this {
    this.progress.updated_at = updatedAt;
    return this;
  }

  /**
   * Set as found item with date (common test case)
   */
  asFoundWithDate(foundDate: string = '2024-01-01T00:00:00.000Z'): this {
    this.progress.found_date = foundDate;
    return this;
  }

  /**
   * Set as manually added found item (common test case)
   */
  asManuallyAddedFound(): this {
    this.progress.found_date = new Date().toISOString();
    this.progress.manually_added = 1;
    this.progress.auto_detected = 0;
    return this;
  }

  /**
   * Set as auto detected found item (common test case)
   */
  asAutoDetectedFound(): this {
    this.progress.found_date = new Date().toISOString();
    this.progress.manually_added = 0;
    this.progress.auto_detected = 1;
    return this;
  }

  /**
   * Set as hell difficulty found item (common test case)
   */
  asHellFound(): this {
    this.progress.found_date = new Date().toISOString();
    this.progress.difficulty = 'hell';
    return this;
  }

  /**
   * Set as progress for Shako item (common test case)
   */
  forShako(): this {
    this.progress.item_id = 'shako';
    return this;
  }

  /**
   * Set as progress for Windforce item (common test case)
   */
  forWindforce(): this {
    this.progress.item_id = 'windforce';
    return this;
  }

  /**
   * Set as progress for Tal Rasha's Set item (common test case)
   */
  forTalRashasSet(): this {
    this.progress.item_id = 'tal-rashas-set';
    return this;
  }

  /**
   * Set as progress for TestCharacter (common test case)
   */
  forTestCharacter(): this {
    this.progress.character_id = 'char-1';
    return this;
  }

  /**
   * Build and return the DatabaseGrailProgress
   */
  build(): DatabaseGrailProgress {
    return { ...this.progress };
  }

  /**
   * Build multiple progress records with the same base configuration
   */
  buildMany(count: number): DatabaseGrailProgress[] {
    return Array.from({ length: count }, (_, index) => ({
      ...this.progress,
      id: `${this.progress.id}-${index}`,
    }));
  }
}
