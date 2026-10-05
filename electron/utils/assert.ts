/** Throws an Error with `message` when `condition` is false. Used to validate IPC input. */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
