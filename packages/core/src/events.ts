type EventMap = {
  "setup:start": undefined;
  "setup:complete": undefined;
  "service:ready": string;
  "service:crash": string;
  "all:ready": undefined;
};

type EventHandler<T> = (data: T) => void | Promise<void>;

export type { EventMap, EventHandler };

export class EventBus {
  private handlers = new Map<string, Set<EventHandler<unknown>>>();

  on<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler<unknown>);
  }

  off<K extends keyof EventMap>(event: K, handler: EventHandler<EventMap[K]>): void {
    this.handlers.get(event)?.delete(handler as EventHandler<unknown>);
  }

  async emit<K extends keyof EventMap>(event: K, data: EventMap[K]): Promise<void> {
    const handlers = this.handlers.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      await handler(data);
    }
  }
}
