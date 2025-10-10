import type { EventHandler, EventPayload, EventType } from '../types/events';

/**
 * Type-safe EventBus implementation for decoupled event-driven communication.
 * Replaces EventEmitter-based architecture with dependency injection pattern.
 */
export class EventBus {
  private listeners: Map<EventType, Set<EventHandler<EventType>>>;

  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event with a typed handler.
   * @param event - The event type to subscribe to
   * @param handler - The handler function to invoke when event is emitted
   * @returns Unsubscribe function to remove this specific handler
   */
  on<T extends EventType>(event: T, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    // Type assertion needed due to Map limitations with generic types
    const handlers = this.listeners.get(event) as unknown as Set<EventHandler<T>>;
    handlers.add(handler);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Emit an event with a typed payload.
   * All registered handlers for this event type will be invoked.
   * Errors in handlers are caught and logged to prevent cascade failures.
   * @param event - The event type to emit
   * @param payload - The event payload data
   */
  emit<T extends EventType>(event: T, payload: EventPayload<T>): void {
    const handlers = this.listeners.get(event);

    if (!handlers || handlers.size === 0) {
      return;
    }

    // Invoke all handlers, catching errors to prevent cascade failures
    for (const handler of handlers) {
      try {
        // Type assertion needed due to Map limitations with generic types
        const typedHandler = handler as unknown as EventHandler<T>;
        const result = typedHandler(payload);

        // Handle async handlers
        if (result instanceof Promise) {
          result.catch((error) => {
            console.error(`[EventBus] Async handler error for event '${event}':`, error);
          });
        }
      } catch (error) {
        console.error(`[EventBus] Handler error for event '${event}':`, error);
      }
    }
  }

  /**
   * Unsubscribe a specific handler from an event.
   * @param event - The event type to unsubscribe from
   * @param handler - The specific handler to remove
   */
  off<T extends EventType>(event: T, handler: EventHandler<T>): void {
    const handlers = this.listeners.get(event);

    if (!handlers) {
      return;
    }

    // Type assertion needed due to Map limitations with generic types
    (handlers as unknown as Set<EventHandler<T>>).delete(handler);

    // Clean up empty handler sets
    if (handlers.size === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Remove all event listeners.
   * Useful for cleanup and testing.
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * Get the count of listeners for a specific event type.
   * Useful for debugging and testing.
   * @param event - The event type to check
   * @returns Number of registered handlers for this event
   */
  listenerCount(event: EventType): number {
    const handlers = this.listeners.get(event);
    return handlers ? handlers.size : 0;
  }
}
