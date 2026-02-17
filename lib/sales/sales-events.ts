// In-memory event store for sales call real-time updates
// Separate from DREAM's workshop-events.ts — completely independent

type SalesEventListener = (event: SalesEvent) => void;

export interface SalesEvent {
  type: string;
  payload: Record<string, unknown>;
}

const globalStore = globalThis as unknown as {
  __salesRealtimeStore?: Map<string, Set<SalesEventListener>>;
};

if (!globalStore.__salesRealtimeStore) {
  globalStore.__salesRealtimeStore = new Map();
}

const store = globalStore.__salesRealtimeStore;

export function emitSalesEvent(workshopId: string, event: SalesEvent): void {
  const listeners = store.get(workshopId);
  if (!listeners) return;
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (e) {
      console.error('Sales event listener error:', e);
    }
  }
}

export function subscribeSalesEvents(workshopId: string, listener: SalesEventListener): () => void {
  if (!store.has(workshopId)) {
    store.set(workshopId, new Set());
  }
  store.get(workshopId)!.add(listener);

  return () => {
    const listeners = store.get(workshopId);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        store.delete(workshopId);
      }
    }
  };
}
