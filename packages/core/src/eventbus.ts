import type { BusTopic } from "./enums.js";

export type BusHandler<T = unknown> = (context: T) => void;

/** Unsubscribe function returned by {@link EventBus.on}. */
export type Unsubscribe = () => void;

export interface EventBus {
  /** Subscribe to a topic. Returns an unsubscribe function. */
  on<T = unknown>(action: BusTopic, handler: BusHandler<T>): Unsubscribe;
  /** Remove a previously registered handler. No-op if it was not registered. */
  off<T = unknown>(action: BusTopic, handler: BusHandler<T>): void;
  /** Fire a topic, invoking every subscribed handler with `context`. */
  trigger<T = unknown>(action: BusTopic, context?: T): void;
  /** Pause delivery; triggered topics are buffered (last context per topic wins). */
  hold(): void;
  /** Resume delivery and flush the buffered topics. */
  release(): void;
  /** Remove every handler (primarily for tests / teardown). */
  reset(): void;
}

/**
 * Creates an isolated event bus.
 *
 * Behaviour matches the original DPaint.js bus: while {@link EventBus.hold} is
 * active, triggers are coalesced per-topic into a buffer and replayed on
 * {@link EventBus.release}. The typed `off` method and the unsubscribe handle
 * returned by `on` are additions required for React component teardown.
 */
export function createEventBus(): EventBus {
  const handlers = new Map<BusTopic, Array<BusHandler>>();
  let active = true;
  let buffer = new Map<BusTopic, unknown>();

  const bus: EventBus = {
    on(action, handler) {
      const list = handlers.get(action) ?? [];
      list.push(handler as BusHandler);
      handlers.set(action, list);
      return () => bus.off(action, handler);
    },

    off(action, handler) {
      const list = handlers.get(action);
      if (!list) return;
      const index = list.indexOf(handler as BusHandler);
      if (index >= 0) list.splice(index, 1);
      if (list.length === 0) handlers.delete(action);
    },

    trigger(action, context) {
      if (!active) {
        buffer.set(action, context);
        return;
      }
      const list = handlers.get(action);
      if (!list) return;
      // Iterate a copy so handlers may safely unsubscribe during dispatch.
      for (const handler of list.slice()) handler(context);
    },

    hold() {
      active = false;
    },

    release() {
      const pending = buffer;
      buffer = new Map();
      active = true;
      for (const [action, context] of pending) bus.trigger(action, context);
    },

    reset() {
      handlers.clear();
      buffer.clear();
      active = true;
    },
  };

  return bus;
}

/** Shared application-wide event bus (mirrors the original singleton export). */
export const EventBus: EventBus = createEventBus();

export default EventBus;
