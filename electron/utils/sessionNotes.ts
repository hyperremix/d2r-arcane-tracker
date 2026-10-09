/**
 * Longest session notes (in UTF-16 code units, i.e. `string.length`) that can be saved.
 * Shared by the IPC validator in the main process and the notes editors in the renderer.
 */
export const MAX_SESSION_NOTES_LENGTH = 10_000;
