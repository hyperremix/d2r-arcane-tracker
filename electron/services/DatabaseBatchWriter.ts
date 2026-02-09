import type { GrailDatabase } from '../database/database';
import type { Character, GrailProgress, RunItem } from '../types/grail';
import { createServiceLogger } from '../utils/serviceLogger';

const log = createServiceLogger('DatabaseBatchWriter');

/**
 * Service for batching database writes to improve performance and reduce event loop blocking.
 * Accumulates character and progress updates in memory and flushes them in batches using transactions.
 */
export class DatabaseBatchWriter {
  private characterQueue: Map<string, Character>;
  private progressQueue: Map<string, GrailProgress>;
  private runItemQueue: Map<string, RunItem>;
  private flushTimer: NodeJS.Timeout | null;
  private readonly database: GrailDatabase;
  private readonly BATCH_DELAY = 100; // ms - delay before auto-flushing
  private readonly BATCH_SIZE_THRESHOLD = 50; // items - flush immediately if queue exceeds this
  private readonly MAX_FLUSH_RETRIES = 3; // max consecutive failures before dropping items
  private consecutiveFailures = 0;
  private onFlushCallback?: () => void;

  /**
   * Creates a new DatabaseBatchWriter instance.
   * @param database - GrailDatabase instance to write batches to
   * @param onFlushCallback - Optional callback invoked after successful flush
   */
  constructor(database: GrailDatabase, onFlushCallback?: () => void) {
    this.database = database;
    this.characterQueue = new Map();
    this.progressQueue = new Map();
    this.runItemQueue = new Map();
    this.flushTimer = null;
    this.onFlushCallback = onFlushCallback;
  }

  /**
   * Queues a character for batch writing.
   * If the queue size exceeds the threshold, flushes immediately.
   * Otherwise, schedules a flush after the batch delay.
   * @param character - Character to queue for writing
   */
  queueCharacter(character: Character): void {
    this.characterQueue.set(character.id, character);
    this.scheduleFlush();
  }

  /**
   * Queues a grail progress entry for batch writing.
   * If the queue size exceeds the threshold, flushes immediately.
   * Otherwise, schedules a flush after the batch delay.
   * @param progress - Progress entry to queue for writing
   */
  queueProgress(progress: GrailProgress): void {
    this.progressQueue.set(progress.id, progress);
    this.scheduleFlush();
  }

  /**
   * Queues a run item for batch writing.
   * If the queue size exceeds the threshold, flushes immediately.
   * Otherwise, schedules a flush after the batch delay.
   * @param runItem - Run item to queue for writing
   */
  queueRunItem(runItem: RunItem): void {
    this.runItemQueue.set(runItem.id, runItem);
    this.scheduleFlush();
  }

  /**
   * Schedules a flush operation.
   * If queue size exceeds threshold, flushes immediately.
   * Otherwise, schedules a delayed flush (debounced).
   * @private
   */
  private scheduleFlush(): void {
    const totalQueueSize =
      this.characterQueue.size + this.progressQueue.size + this.runItemQueue.size;

    // Flush immediately if threshold exceeded
    if (totalQueueSize >= this.BATCH_SIZE_THRESHOLD) {
      log.info(
        'scheduleFlush',
        `Queue size (${totalQueueSize}) exceeded threshold (${this.BATCH_SIZE_THRESHOLD}), flushing immediately`,
      );
      this.flush();
      return;
    }

    // Schedule delayed flush (debounced)
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }

    this.flushTimer = setTimeout(() => {
      this.flush();
    }, this.BATCH_DELAY);
  }

  /**
   * Immediately flushes all queued writes to the database using transactions.
   * Clears the queues and cancels any pending flush timer.
   */
  flush(): void {
    // Clear the timer if it exists
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const characterCount = this.characterQueue.size;
    const progressCount = this.progressQueue.size;
    const runItemCount = this.runItemQueue.size;

    if (characterCount === 0 && progressCount === 0 && runItemCount === 0) {
      return; // Nothing to flush
    }

    log.info(
      'flush',
      `Flushing ${characterCount} characters, ${progressCount} progress entries, and ${runItemCount} run items`,
    );

    try {
      // Flush characters in batch
      if (characterCount > 0) {
        const characters = Array.from(this.characterQueue.values());
        this.database.upsertCharactersBatch(characters);
        this.characterQueue.clear();
        log.info('flush', `Flushed ${characterCount} characters`);
      }

      // Flush progress in batch
      if (progressCount > 0) {
        const progressList = Array.from(this.progressQueue.values());
        this.database.upsertProgressBatch(progressList);
        this.progressQueue.clear();
        log.info('flush', `Flushed ${progressCount} progress entries`);
      }

      // Flush run items in batch
      if (runItemCount > 0) {
        const runItems = Array.from(this.runItemQueue.values());
        this.database.addRunItemsBatch(runItems);
        this.runItemQueue.clear();
        log.info('flush', `Flushed ${runItemCount} run items`);
      }

      // Invoke callback after successful flush
      this.consecutiveFailures = 0;
      if (this.onFlushCallback) {
        this.onFlushCallback();
      }
    } catch (error) {
      this.consecutiveFailures++;
      log.error('flush', error, {
        attempt: this.consecutiveFailures,
        maxRetries: this.MAX_FLUSH_RETRIES,
      });

      if (this.consecutiveFailures >= this.MAX_FLUSH_RETRIES) {
        const remaining = {
          characters: this.characterQueue.size,
          progress: this.progressQueue.size,
          runItems: this.runItemQueue.size,
        };
        log.error('flush', 'Max retries exceeded, dropping remaining unflushed items', remaining, {
          surfaceToUI: true,
          userMessage: 'Database write failed — some item data was lost',
        });
        this.characterQueue.clear();
        this.progressQueue.clear();
        this.runItemQueue.clear();
        this.consecutiveFailures = 0;
      }
    }
  }

  /**
   * Gets the current size of the character queue.
   * @returns Number of queued characters
   */
  getCharacterQueueSize(): number {
    return this.characterQueue.size;
  }

  /**
   * Gets the current size of the progress queue.
   * @returns Number of queued progress entries
   */
  getProgressQueueSize(): number {
    return this.progressQueue.size;
  }

  /**
   * Gets the current size of the run item queue.
   * @returns Number of queued run items
   */
  getRunItemQueueSize(): number {
    return this.runItemQueue.size;
  }

  /**
   * Clears all queues and cancels pending flushes.
   * Used for testing and cleanup.
   */
  clear(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.characterQueue.clear();
    this.progressQueue.clear();
    this.runItemQueue.clear();
  }
}
