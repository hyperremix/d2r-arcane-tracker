import type {
  D2Item,
  GrailProgress,
  ItemDetectionEvent,
  Run,
  SaveFileEvent,
  Session,
} from './grail';

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
 * Payload for run-started event
 */
export interface RunStartedPayload {
  run: Run;
  session: Session;
  manual: boolean;
}

/**
 * Payload for run-ended event
 */
export interface RunEndedPayload {
  run: Run;
  session: Session;
  manual: boolean;
}

/**
 * Payload for run-paused event
 */
export interface RunPausedPayload {
  run: Run;
  session: Session;
}

/**
 * Payload for run-resumed event
 */
export interface RunResumedPayload {
  run: Run;
  session: Session;
}

/**
 * Payload for session-started event
 */
export interface SessionStartedPayload {
  session: Session;
}

/**
 * Payload for session-ended event
 */
export interface SessionEndedPayload {
  session: Session;
}

/**
 * Payload for run-item-added event
 */
export interface RunItemAddedPayload {
  runId: string;
  grailProgress: GrailProgress;
  item: D2Item;
}

/**
 * Union type of all application events with their payloads
 */
export type AppEvent =
  | { type: 'save-file-event'; payload: SaveFileEvent }
  | { type: 'item-detection'; payload: ItemDetectionEvent }
  | { type: 'monitoring-started'; payload: MonitoringStartedPayload }
  | { type: 'monitoring-stopped'; payload: Record<string, never> }
  | { type: 'monitoring-error'; payload: MonitoringErrorPayload }
  | { type: 'run-started'; payload: RunStartedPayload }
  | { type: 'run-ended'; payload: RunEndedPayload }
  | { type: 'run-paused'; payload: RunPausedPayload }
  | { type: 'run-resumed'; payload: RunResumedPayload }
  | { type: 'session-started'; payload: SessionStartedPayload }
  | { type: 'session-ended'; payload: SessionEndedPayload }
  | { type: 'run-item-added'; payload: RunItemAddedPayload };

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
