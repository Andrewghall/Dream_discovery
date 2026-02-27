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

/**
 * Persist an event to the workshop_event_outbox table (durable, cross-isolate)
 * then best-effort emit via in-memory SSE (works in dev, unreliable on Vercel serverless).
 *
 * Use this instead of `emitWorkshopEvent` for any event emitted inside `after()` callbacks.
 */
export async function persistAndEmit(
  workshopId: string,
  event: { id?: string; type: string; createdAt: number; payload: unknown },
) {
  const { nanoid } = await import('nanoid');
  const id = event.id || nanoid();

  // Durable write — this is the source of truth on Vercel
  try {
    const { prisma } = await import('@/lib/prisma');
    await (prisma as any).workshopEventOutbox.create({
      data: {
        id,
        workshopId,
        type: event.type,
        payload: event.payload as any,
      },
    });
  } catch (e) {
    console.error('[EventOutbox] Failed to persist:', event.type, e instanceof Error ? e.message : e);
  }

  // Best-effort SSE emit (works in same-isolate / local dev)
  emitWorkshopEvent(workshopId, { id, type: event.type, createdAt: event.createdAt, payload: event.payload });
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
