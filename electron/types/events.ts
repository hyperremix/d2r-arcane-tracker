import type { ItemDetectionEvent, SaveFileEvent } from './grail';

/**
 * Payload for monitoring-started event
 */
export interface MonitoringStartedPayload {
  directory: string;
  saveFileCount: number;
}

/**
 * Payload for monitoring-error event
 */
export interface MonitoringErrorPayload {
  type: string;
  message: string;
  directory: string | null;
  saveFileCount?: number;
}

/**
 * Union type of all application events with their payloads
 */
export type AppEvent =
  | { type: 'save-file-event'; payload: SaveFileEvent }
  | { type: 'item-detection'; payload: ItemDetectionEvent }
  | { type: 'monitoring-started'; payload: MonitoringStartedPayload }
  | { type: 'monitoring-stopped'; payload: Record<string, never> }
  | { type: 'monitoring-error'; payload: MonitoringErrorPayload };

/**
 * Extract event type names
 */
export type EventType = AppEvent['type'];

/**
 * Extract payload type for a given event type
 */
export type EventPayload<T extends EventType> = Extract<AppEvent, { type: T }>['payload'];

/**
 * Event handler function type that accepts a payload and returns void or Promise<void>
 */
export type EventHandler<T extends EventType> = (payload: EventPayload<T>) => void | Promise<void>;
