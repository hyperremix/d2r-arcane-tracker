import type { Run } from 'electron/types/grail';

/**
 * Builder class for creating Run test fixtures
 * Follows the builder pattern for flexible test data creation
 */
export class RunBuilder {
  private run: Run = {
    id: 'default-run',
    sessionId: 'default-session',
    runNumber: 1,
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: new Date('2024-01-01T10:05:00Z'),
    duration: 300000,
    created: new Date('2024-01-01T10:00:00Z'),
    lastUpdated: new Date('2024-01-01T10:05:00Z'),
  };

  /**
   * Create a new builder instance
   */
  static new(): RunBuilder {
    return new RunBuilder();
  }

  /**
   * Set the run ID
   */
  withId(id: string): this {
    this.run.id = id;
    return this;
  }

  /**
   * Set the session ID
   */
  withSessionId(sessionId: string): this {
    this.run.sessionId = sessionId;
    return this;
  }

  /**
   * Set the run number
   */
  withRunNumber(runNumber: number): this {
    this.run.runNumber = runNumber;
    return this;
  }

  /**
   * Set the start time
   */
  withStartTime(startTime: Date): this {
    this.run.startTime = startTime;
    return this;
  }

  /**
   * Set the end time
   */
  withEndTime(endTime: Date): this {
    this.run.endTime = endTime;
    return this;
  }

  /**
   * Remove the end time (in-progress run)
   */
  withoutEndTime(): this {
    delete this.run.endTime;
    return this;
  }

  /**
   * Set the duration
   */
  withDuration(duration: number): this {
    this.run.duration = duration;
    return this;
  }

  /**
   * Remove the duration
   */
  withoutDuration(): this {
    delete this.run.duration;
    return this;
  }

  /**
   * Set the character ID
   */
  withCharacterId(characterId: string): this {
    this.run.characterId = characterId;
    return this;
  }

  /**
   * Build and return the Run
   */
  build(): Run {
    return { ...this.run };
  }

  /**
   * Build multiple runs with the same base configuration
   */
  buildMany(count: number): Run[] {
    return Array.from({ length: count }, (_, index) => ({
      ...this.run,
      id: `${this.run.id}-${index}`,
      runNumber: this.run.runNumber + index,
    }));
  }
}
