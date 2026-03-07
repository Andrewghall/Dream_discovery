/**
 * IndexedDB store for pending capture sessions created while offline.
 *
 * When a mobile user taps "Start Session" with no network, we generate a
 * local UUID, record the session metadata here, and allow recording to
 * proceed. On reconnection the capture page syncs these to the server.
 */

const DB_NAME = 'dream-capture-offline';
const DB_VERSION = 2; // bump from v1 (added pending-sessions store)
const UPLOADS_STORE = 'pending-uploads';
const SESSIONS_STORE = 'pending-sessions';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(UPLOADS_STORE)) {
        db.createObjectStore(UPLOADS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: 'localId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export interface PendingSession {
  localId: string;       // client-generated UUID (e.g. "local-abc123")
  workshopId: string;
  captureToken: string;
  formData: Record<string, unknown>;
  createdAt: number;     // Date.now()
  serverId?: string;     // filled in after successful sync
}

export async function storePendingSession(session: PendingSession): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSIONS_STORE, 'readwrite');
    tx.objectStore(SESSIONS_STORE).put(session);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function getPendingSessions(): Promise<PendingSession[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSIONS_STORE, 'readonly');
    const req = tx.objectStore(SESSIONS_STORE).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result ?? []); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

export async function updatePendingSession(localId: string, updates: Partial<PendingSession>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSIONS_STORE, 'readwrite');
    const store = tx.objectStore(SESSIONS_STORE);
    const getReq = store.get(localId);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (existing) store.put({ ...existing, ...updates });
      tx.oncomplete = () => { db.close(); resolve(); };
    };
    getReq.onerror = () => { db.close(); reject(getReq.error); };
  });
}

export async function removePendingSession(localId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SESSIONS_STORE, 'readwrite');
    tx.objectStore(SESSIONS_STORE).delete(localId);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
