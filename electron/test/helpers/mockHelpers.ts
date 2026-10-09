import type { Mock } from 'vitest';
import { vi } from 'vitest';

/**
 * Wraps a factory in a plain `function` so it can be used as a mock implementation of a class.
 * Vitest 4+ only allows `function` or class implementations to be called with `new`;
 * an arrow function would throw "is not a constructor".
 * @param {() => T} factory - Creates the instance returned by `new Mock()`.
 * @returns {() => T} A constructor-callable implementation for `vi.fn` or `mockImplementation`.
 */
export function constructorImplementation<T>(factory: () => T): () => T {
  // biome-ignore lint/complexity/useArrowFunction: arrow functions cannot be called with `new`
  return function () {
    return factory();
  };
}

/**
 * Creates a `vi.fn` mock that can be called with `new` and returns the factory's result.
 * @param {() => T} factory - Creates the instance returned by `new Mock()`.
 * @returns {Mock<() => T>} A constructor-callable mock function.
 */
export function createConstructorMock<T>(factory: () => T): Mock<() => T> {
  return vi.fn(constructorImplementation(factory));
}
