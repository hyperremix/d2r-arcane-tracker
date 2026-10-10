/**
 * Small composable validators for renderer-provided IPC arguments.
 *
 * Every value that arrives over IPC is untrusted. Field validators check one argument and either
 * return it (narrowed to its contract type) or throw an {@link IpcValidationError}; {@link args}
 * combines them into a validator for a channel's whole argument list.
 */

/** Error thrown when a renderer passes an argument that does not match the IPC contract. */
export class IpcValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IpcValidationError';
  }
}

/** Validates a single argument and returns it narrowed to `T`. */
export type FieldValidator<T> = (value: unknown) => T;

/** Validates the raw argument list of a channel and returns it as the contract tuple `A`. */
export type ArgsValidator<A extends unknown[]> = (rawArgs: readonly unknown[]) => A;

type ValidatedTuple<V extends readonly FieldValidator<unknown>[]> = {
  -readonly [K in keyof V]: V[K] extends FieldValidator<infer T> ? T : never;
};

/**
 * Throws an {@link IpcValidationError} with `message` when `condition` is false.
 * @param condition - Condition that must hold
 * @param message - Error message describing the invalid input
 */
export function ensure(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new IpcValidationError(message);
  }
}

/** Validator for channels without arguments; extra arguments are ignored. */
export const noArgs: ArgsValidator<[]> = () => [];

/**
 * Combines field validators into a validator for a channel's positional arguments.
 * Missing trailing arguments are passed to their validator as `undefined`; extra ones are dropped.
 * @param validators - One validator per positional argument
 * @returns Validator producing the validated argument tuple
 */
export function args<const V extends readonly FieldValidator<unknown>[]>(
  ...validators: V
): ArgsValidator<ValidatedTuple<V>> {
  return (rawArgs) =>
    validators.map((validate, index) => validate(rawArgs[index])) as ValidatedTuple<V>;
}

/**
 * Accepts `undefined` or a value accepted by `validator`.
 * @param validator - Validator for the value when present
 */
export function optional<T>(validator: FieldValidator<T>): FieldValidator<T | undefined> {
  return (value) => (value === undefined ? undefined : validator(value));
}

/**
 * Accepts any string.
 * @param message - Error message for invalid input
 */
export function string(message: string): FieldValidator<string> {
  return (value) => {
    ensure(typeof value === 'string', message);
    return value;
  };
}

/**
 * Accepts a string with at least one non-whitespace character. The value is returned unchanged.
 * @param message - Error message for invalid input
 */
export function nonEmptyString(message: string): FieldValidator<string> {
  return (value) => {
    ensure(typeof value === 'string' && value.trim().length > 0, message);
    return value;
  };
}

/**
 * Accepts a boolean.
 * @param message - Error message for invalid input
 */
export function boolean(message: string): FieldValidator<boolean> {
  return (value) => {
    ensure(typeof value === 'boolean', message);
    return value;
  };
}

/**
 * Accepts a finite number.
 * @param message - Error message for invalid input
 */
export function finiteNumber(message: string): FieldValidator<number> {
  return (value) => {
    ensure(typeof value === 'number' && Number.isFinite(value), message);
    return value;
  };
}

/**
 * Accepts one of a fixed set of values.
 * @param values - Allowed values
 * @param message - Error message for invalid input
 */
export function oneOf<const T>(values: readonly T[], message: string): FieldValidator<T> {
  return (value) => {
    ensure((values as readonly unknown[]).includes(value), message);
    return value as T;
  };
}

/**
 * Checks that a value is a plain object (not null and not an array).
 * @param value - Value to check
 * @returns True for plain objects
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Accepts a plain object. Only the container is checked: use it for payloads whose fields the
 * handler validates and normalizes itself.
 * @param message - Error message for invalid input
 */
export function plainObject<T extends object>(message: string): FieldValidator<T> {
  return (value) => {
    ensure(isPlainObject(value), message);
    return value as T;
  };
}

/**
 * Passes the value through unchanged. Only for arguments whose handler validates them itself
 * because it reports invalid input as a failed result instead of rejecting (the widget handlers).
 */
export function validatedByHandler<T>(): FieldValidator<T> {
  return (value) => value as T;
}
