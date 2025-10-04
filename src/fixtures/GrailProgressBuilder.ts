import type { Difficulty, GrailProgress } from 'electron/types/grail';

/**
 * Builder class for creating GrailProgress test fixtures
 * Follows the builder pattern for flexible test data creation
 */
export class GrailProgressBuilder {
  private progress: GrailProgress = {
    id: 'default-progress',
    characterId: 'default-character',
    itemId: 'default-item',
    found: true,
    foundDate: new Date('2024-01-01'),
    foundBy: 'Default Character',
    manuallyAdded: true,
    isEthereal: false,
  };

  /**
   * Create a new builder instance
   */
  static new(): GrailProgressBuilder {
    return new GrailProgressBuilder();
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
    this.progress.characterId = characterId;
    return this;
  }

  /**
   * Set the item ID
   */
  withItemId(itemId: string): this {
    this.progress.itemId = itemId;
    return this;
  }

  /**
   * Set the found status
   */
  withFound(found: boolean): this {
    this.progress.found = found;
    return this;
  }

  /**
   * Set the found date
   */
  withFoundDate(foundDate: Date): this {
    this.progress.foundDate = foundDate;
    return this;
  }

  /**
   * Remove the found date
   */
  withoutFoundDate(): this {
    delete this.progress.foundDate;
    return this;
  }

  /**
   * Set who found the item
   */
  withFoundBy(foundBy: string): this {
    this.progress.foundBy = foundBy;
    return this;
  }

  /**
   * Remove the foundBy field
   */
  withoutFoundBy(): this {
    delete this.progress.foundBy;
    return this;
  }

  /**
   * Set manually added status
   */
  withManuallyAdded(manuallyAdded: boolean): this {
    this.progress.manuallyAdded = manuallyAdded;
    return this;
  }

  /**
   * Set the difficulty
   */
  withDifficulty(difficulty: Difficulty): this {
    this.progress.difficulty = difficulty;
    return this;
  }

  /**
   * Remove the difficulty
   */
  withoutDifficulty(): this {
    delete this.progress.difficulty;
    return this;
  }

  /**
   * Set notes
   */
  withNotes(notes: string): this {
    this.progress.notes = notes;
    return this;
  }

  /**
   * Remove notes
   */
  withoutNotes(): this {
    delete this.progress.notes;
    return this;
  }

  /**
   * Set the ethereal status
   */
  withIsEthereal(isEthereal: boolean): this {
    this.progress.isEthereal = isEthereal;
    return this;
  }

  /**
   * Set as ethereal item
   */
  asEthereal(): this {
    this.progress.isEthereal = true;
    return this;
  }

  /**
   * Set as normal (non-ethereal) item
   */
  asNormal(): this {
    this.progress.isEthereal = false;
    return this;
  }

  /**
   * Build and return the GrailProgress
   */
  build(): GrailProgress {
    return { ...this.progress };
  }

  /**
   * Build multiple progress entries with the same base configuration
   */
  buildMany(count: number): GrailProgress[] {
    return Array.from({ length: count }, (_, index) => ({
      ...this.progress,
      id: `${this.progress.id}-${index}`,
      itemId: `${this.progress.itemId}-${index}`,
    }));
  }
}
