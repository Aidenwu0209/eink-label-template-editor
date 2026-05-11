/**
 * Type-safe event bus for cross-module communication
 */
type EventHandler<T = any> = (data: T) => void;

export class EventBus<Events extends Record<string, any>> {
  private handlers = new Map<string, Set<EventHandler>>();

  on<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    const key = event as string;
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set());
    }
    this.handlers.get(key)!.add(handler);
  }

  off<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    this.handlers.get(event as string)?.delete(handler);
  }

  emit<K extends keyof Events>(event: K, data?: Events[K]): void {
    this.handlers.get(event as string)?.forEach((fn) => fn(data));
  }

  once<K extends keyof Events>(event: K, handler: EventHandler<Events[K]>): void {
    const wrapped: EventHandler<Events[K]> = (data) => {
      handler(data);
      this.off(event, wrapped);
    };
    this.on(event, wrapped);
  }

  removeAllListeners(): void {
    this.handlers.clear();
  }
}
