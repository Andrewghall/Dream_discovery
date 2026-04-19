import { nanoid } from 'nanoid';

export type DebugStage = 'tsm' | 'ingest' | 'split' | 'sse' | 'hemisphere' | 'quality';

export interface DebugLogEntry {
  id: string;
  ts: number;
  stage: DebugStage;
  event: string;
  status: 'pass' | 'blocked' | 'info' | 'error';
  // Common
  thoughtWindowId?: string;
  // TSM
  text?: string;
  chunks?: number;
  guardReason?: string;
  // Ingest
  httpStatus?: number;
  dataPointIds?: string[];
  requestText?: string;
  // Split
  wasSplit?: boolean;
  unitCount?: number;
  units?: string[];
  unitIntents?: string[];
  originalText?: string;
  filteredUnits?: Array<{ text: string; reason: string }>;
  // SSE
  dataPointId?: string;
  // Hemisphere
  nodeCount?: number;
  nodeId?: string;
  hemisphereAction?: 'added' | 'updated' | 'overwrite-prevented';
}

type Listener = (entry: DebugLogEntry) => void;
const listeners = new Set<Listener>();

export function emitDebug(partial: Omit<DebugLogEntry, 'id' | 'ts'>): void {
  if (listeners.size === 0) return;
  const entry: DebugLogEntry = { id: nanoid(6), ts: Date.now(), ...partial };
  listeners.forEach(fn => fn(entry));
}

export function subscribeDebug(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
