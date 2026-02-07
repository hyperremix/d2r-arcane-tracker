import type { RunItem } from 'electron/types/grail';

/**
 * Builder class for creating RunItem test fixtures
 * Follows the builder pattern for flexible test data creation
 */
export class RunItemBuilder {
  private runItem: RunItem = {
    id: 'default-run-item',
    runId: 'default-run',
    foundTime: new Date('2024-01-01T10:01:00Z'),
    created: new Date('2024-01-01T10:01:00Z'),
  };

  /**
   * Create a new builder instance
   */
  static new(): RunItemBuilder {
    return new RunItemBuilder();
  }

  /**
   * Set the run item ID
   */
  withId(id: string): this {
    this.runItem.id = id;
    return this;
  }

  /**
   * Set the run ID
   */
  withRunId(runId: string): this {
    this.runItem.runId = runId;
    return this;
  }

  /**
   * Set the grail progress ID
   */
  withGrailProgressId(grailProgressId: string): this {
    this.runItem.grailProgressId = grailProgressId;
    return this;
  }

  /**
   * Set the item name (for manual entries)
   */
  withName(name: string): this {
    this.runItem.name = name;
    return this;
  }

  /**
   * Set the found time
   */
  withFoundTime(foundTime: Date): this {
    this.runItem.foundTime = foundTime;
    return this;
  }

  /**
   * Build and return the RunItem
   */
  build(): RunItem {
    return { ...this.runItem };
  }
}
