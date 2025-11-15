import type { Run, RunItem, Session } from '../../types/grail';

/**
 * Builder class for creating Session test fixtures
 * Follows the builder pattern for flexible test data creation
 */
export class SessionBuilder {
  private session: Session = {
    id: 'default-session',
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: undefined,
    totalRunTime: 0,
    totalSessionTime: 0,
    runCount: 0,
    archived: false,
    notes: undefined,
    created: new Date('2024-01-01T10:00:00Z'),
    lastUpdated: new Date('2024-01-01T10:00:00Z'),
  };

  /**
   * Create a new builder instance
   */
  static new(): SessionBuilder {
    return new SessionBuilder();
  }

  /**
   * Set the session ID
   */
  withId(id: string): this {
    this.session.id = id;
    return this;
  }

  /**
   * Set the start time
   */
  withStartTime(startTime: Date): this {
    this.session.startTime = startTime;
    return this;
  }

  /**
   * Set the end time
   */
  withEndTime(endTime: Date | undefined): this {
    this.session.endTime = endTime;
    return this;
  }

  /**
   * Set the total run time in milliseconds
   */
  withTotalRunTime(totalRunTime: number): this {
    this.session.totalRunTime = totalRunTime;
    return this;
  }

  /**
   * Set the total session time in milliseconds
   */
  withTotalSessionTime(totalSessionTime: number): this {
    this.session.totalSessionTime = totalSessionTime;
    return this;
  }

  /**
   * Set the run count
   */
  withRunCount(runCount: number): this {
    this.session.runCount = runCount;
    return this;
  }

  /**
   * Set the archived status
   */
  withArchived(archived: boolean): this {
    this.session.archived = archived;
    return this;
  }

  /**
   * Set the notes
   */
  withNotes(notes: string | undefined): this {
    this.session.notes = notes;
    return this;
  }

  /**
   * Set the created date
   */
  withCreated(created: Date): this {
    this.session.created = created;
    return this;
  }

  /**
   * Set the last updated date
   */
  withLastUpdated(lastUpdated: Date): this {
    this.session.lastUpdated = lastUpdated;
    return this;
  }

  /**
   * Build and return the session object
   */
  build(): Session {
    return { ...this.session };
  }
}

/**
 * Builder class for creating Run test fixtures
 * Follows the builder pattern for flexible test data creation
 */
export class RunBuilder {
  private run: Run = {
    id: 'default-run',
    sessionId: 'default-session',
    characterId: 'default-character',
    runNumber: 1,
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: undefined,
    duration: undefined,
    created: new Date('2024-01-01T10:00:00Z'),
    lastUpdated: new Date('2024-01-01T10:00:00Z'),
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
   * Set the character ID
   */
  withCharacterId(characterId: string): this {
    this.run.characterId = characterId;
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
  withEndTime(endTime: Date | undefined): this {
    this.run.endTime = endTime;
    return this;
  }

  /**
   * Set the duration in milliseconds
   */
  withDuration(duration: number | undefined): this {
    this.run.duration = duration;
    return this;
  }

  /**
   * Set the created date
   */
  withCreated(created: Date): this {
    this.run.created = created;
    return this;
  }

  /**
   * Set the last updated date
   */
  withLastUpdated(lastUpdated: Date): this {
    this.run.lastUpdated = lastUpdated;
    return this;
  }

  /**
   * Build and return the run object
   */
  build(): Run {
    return { ...this.run };
  }
}

/**
 * Builder class for creating RunItem test fixtures
 * Follows the builder pattern for flexible test data creation
 */
export class RunItemBuilder {
  private runItem: RunItem = {
    id: 'default-run-item',
    runId: 'default-run',
    grailProgressId: 'default-progress',
    foundTime: new Date('2024-01-01T10:00:00Z'),
    created: new Date('2024-01-01T10:00:00Z'),
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
   * Set the found time
   */
  withFoundTime(foundTime: Date): this {
    this.runItem.foundTime = foundTime;
    return this;
  }

  /**
   * Set the created date
   */
  withCreated(created: Date): this {
    this.runItem.created = created;
    return this;
  }

  /**
   * Build and return the run item object
   */
  build(): RunItem {
    return { ...this.runItem };
  }
}
