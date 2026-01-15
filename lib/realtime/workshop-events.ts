export type WorkshopRealtimeEvent = {
  id: string;
  type: string;
  createdAt: number;
  payload: unknown;
};

type Listener = (event: WorkshopRealtimeEvent) => void;

type Store = {
  listenersByWorkshop: Map<string, Set<Listener>>;
};

function getStore(): Store {
  const g = globalThis as typeof globalThis & { __workshopRealtimeStore?: Store };
  if (!g.__workshopRealtimeStore) {
    g.__workshopRealtimeStore = {
      listenersByWorkshop: new Map<string, Set<Listener>>(),
    };
  }
  return g.__workshopRealtimeStore;
}

export function emitWorkshopEvent(workshopId: string, event: WorkshopRealtimeEvent) {
  const store = getStore();
  const listeners = store.listenersByWorkshop.get(workshopId);
  if (!listeners || listeners.size === 0) return;
  for (const l of listeners) {
    try {
      l(event);
    } catch {
      // ignore listener errors
    }
  }
}

export function subscribeWorkshopEvents(workshopId: string, listener: Listener): () => void {
  const store = getStore();
  const set = store.listenersByWorkshop.get(workshopId) || new Set<Listener>();
  set.add(listener);
  store.listenersByWorkshop.set(workshopId, set);

  return () => {
    const current = store.listenersByWorkshop.get(workshopId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) store.listenersByWorkshop.delete(workshopId);
  };
}
