import { createServiceLogger } from '../../utils/serviceLogger';

const log = createServiceLogger('SaveFileMonitor');

/**
 * Executes an array of async tasks with a concurrency limit.
 * This prevents resource exhaustion when many files need to be parsed.
 * A task that throws is logged and leaves `undefined` at its position.
 * @template T - The return type of the tasks
 * @param {Array<() => Promise<T>>} tasks - Array of async task functions
 * @param {number} limit - Maximum number of concurrent tasks
 * @returns {Promise<T[]>} Promise that resolves with all task results in order
 */
export async function executeConcurrently<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  const queue = tasks.map((task, index) => ({ task, index }));

  const worker = async (): Promise<void> => {
    let item = queue.shift();
    while (item !== undefined) {
      try {
        results[item.index] = await item.task();
      } catch (error) {
        log.error('executeConcurrently', error, { taskIndex: item.index });
        results[item.index] = undefined as T;
      }
      item = queue.shift();
    }
  };

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);

  return results;
}
