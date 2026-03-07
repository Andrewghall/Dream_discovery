'use client';

import * as React from 'react';
import { use } from 'react';
import { CaptureSessionForm } from '@/components/field-discovery/capture-session-form';
import { DesktopCaptureControls } from '@/components/field-discovery/desktop-capture-controls';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Loader2, WifiOff } from 'lucide-react';
import type { SessionFormData, DomainPack } from '@/components/field-discovery/capture-session-form';
import {
  storePendingSession,
  getPendingSessions,
  removePendingSession,
} from '@/lib/field-discovery/pending-sessions-store';
import { getPendingUploads, removePendingUpload } from '@/lib/field-discovery/offline-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TokenInfo = {
  valid: boolean;
  workshopId?: string;
  workshopName?: string;
  domainPack?: string | null;
  domainPackConfig?: DomainPack | null;
};

type PageState =
  | { status: 'loading' }
  | { status: 'invalid' }
  | { status: 'ready'; info: TokenInfo }
  | { status: 'session'; info: TokenInfo; sessionId: string; isLocal: boolean }
  | { status: 'complete'; info: TokenInfo; segmentCount: number };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MobileCaptureTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [state, setState] = React.useState<PageState>({ status: 'loading' });
  const [isOffline, setIsOffline] = React.useState(false);
  const [sessionsRecorded, setSessionsRecorded] = React.useState(0);
  const [startError, setStartError] = React.useState<string | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [syncResult, setSyncResult] = React.useState<{ synced: number } | null>(null);

  // -------------------------------------------------------------------------
  // Online / offline detection + auto-sync on reconnect
  // -------------------------------------------------------------------------

  React.useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      syncOfflineData();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // -------------------------------------------------------------------------
  // Validate token on mount
  // -------------------------------------------------------------------------

  React.useEffect(() => {
    let cancelled = false;

    async function validate() {
      // If offline, try to read cached token info from sessionStorage
      if (!navigator.onLine) {
        const cached = sessionStorage.getItem(`capture-token-${token}`);
        if (cached) {
          try {
            const info: TokenInfo = JSON.parse(cached);
            if (!cancelled && info.valid) {
              setState({ status: 'ready', info });
              return;
            }
          } catch { /* ignore */ }
        }
        // Offline and no cache — show offline message but stay in loading
        if (!cancelled) setState({ status: 'ready', info: { valid: true } });
        return;
      }

      try {
        const res = await fetch(`/api/capture-tokens/${token}`);
        if (!res.ok) {
          if (!cancelled) setState({ status: 'invalid' });
          return;
        }
        const data: TokenInfo = await res.json();
        if (!cancelled) {
          if (data.valid) {
            // Cache for offline use
            sessionStorage.setItem(`capture-token-${token}`, JSON.stringify(data));
            setState({ status: 'ready', info: data });
          } else {
            setState({ status: 'invalid' });
          }
        }
      } catch {
        if (!cancelled) setState({ status: 'invalid' });
      }
    }

    validate();
    return () => { cancelled = true; };
  }, [token]);

  // -------------------------------------------------------------------------
  // Sync offline data when back online
  // -------------------------------------------------------------------------

  async function syncOfflineData() {
    const pendingSessions = await getPendingSessions();
    const pendingUploads = await getPendingUploads();

    if (pendingSessions.length === 0 && pendingUploads.length === 0) return;

    setSyncing(true);
    let synced = 0;

    // 1. Create any sessions that were created offline
    for (const pending of pendingSessions) {
      if (pending.serverId) continue; // already synced
      try {
        const res = await fetch(`/api/capture/${pending.captureToken}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...pending.formData, deviceType: 'MOBILE' }),
        });
        if (res.ok) {
          const { session } = await res.json();
          await removePendingSession(pending.localId);
          synced++;

          // 2. Upload any queued segments for this local session
          const myUploads = pendingUploads.filter(
            (u) => (u.metadata.sessionId as string)?.startsWith(pending.localId),
          );
          for (const upload of myUploads) {
            try {
              const fd = new FormData();
              fd.append('audio', upload.audioBlob, `segment-${upload.metadata.segmentIndex}.webm`);
              fd.append('segmentIndex', String(upload.metadata.segmentIndex));
              fd.append('startedAt', new Date(upload.metadata.startedAt as number).toISOString());
              fd.append('stoppedAt', new Date(upload.metadata.stoppedAt as number).toISOString());

              const tRes = await fetch(
                `/api/capture/${pending.captureToken}/sessions/${session.id}/segments/transcribe`,
                { method: 'POST', body: fd },
              );
              if (tRes.ok) {
                await removePendingUpload(upload.id);
                synced++;
              }
            } catch { /* best effort */ }
          }

          // Trigger analysis
          await fetch(
            `/api/capture/${pending.captureToken}/sessions/${session.id}/analyse`,
            { method: 'POST' },
          ).catch(() => { /* best effort */ });
        }
      } catch { /* best effort */ }
    }

    setSyncing(false);
    if (synced > 0) setSyncResult({ synced });
  }

  // -------------------------------------------------------------------------
  // Session creation handler — uses token route, falls back offline
  // -------------------------------------------------------------------------

  async function handleStartSession(formData: SessionFormData) {
    if (state.status !== 'ready') return;
    setStartError(null);

    // Offline path — create local session stored in IndexedDB
    if (!navigator.onLine) {
      const localId = `local-${crypto.randomUUID().slice(0, 8)}`;
      await storePendingSession({
        localId,
        workshopId: state.info.workshopId ?? '',
        captureToken: token,
        formData: formData as unknown as Record<string, unknown>,
        createdAt: Date.now(),
      });
      setState({ status: 'session', info: state.info, sessionId: localId, isLocal: true });
      return;
    }

    try {
      const res = await fetch(`/api/capture/${token}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, deviceType: 'MOBILE' }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Could not create session' }));
        setStartError(err.error ?? 'Could not create session — please try again');
        return;
      }

      const { session } = await res.json();
      setState({ status: 'session', info: state.info, sessionId: session.id, isLocal: false });
    } catch {
      // Network error mid-request — go offline mode
      const localId = `local-${crypto.randomUUID().slice(0, 8)}`;
      await storePendingSession({
        localId,
        workshopId: state.info.workshopId ?? '',
        captureToken: token,
        formData: formData as unknown as Record<string, unknown>,
        createdAt: Date.now(),
      });
      setState({ status: 'session', info: state.info, sessionId: localId, isLocal: true });
    }
  }

  // -------------------------------------------------------------------------
  // Header
  // -------------------------------------------------------------------------

  function WorkshopHeader({ info }: { info: TokenInfo }) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">
            {info.workshopName || 'Workshop'}
          </h2>
          {sessionsRecorded > 0 && (
            <Badge variant="secondary" className="bg-green-500/20 text-xs text-green-300">
              {sessionsRecorded} recorded
            </Badge>
          )}
        </div>
        {info.domainPack && (
          <Badge variant="secondary" className="w-fit text-xs">
            {info.domainPack}
          </Badge>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-4">
      {/* Offline indicator */}
      {isOffline && (
        <div className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
          <WifiOff className="size-4 text-yellow-400" />
          <span className="text-sm font-medium text-yellow-300">
            Offline — recordings will be saved locally and uploaded when you reconnect
          </span>
        </div>
      )}

      {/* Sync status */}
      {syncing && (
        <div className="flex items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2">
          <Loader2 className="size-4 animate-spin text-blue-400" />
          <span className="text-sm font-medium text-blue-300">Syncing offline recordings…</span>
        </div>
      )}
      {syncResult && !syncing && (
        <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2">
          <CheckCircle2 className="size-4 text-green-400" />
          <span className="text-sm font-medium text-green-300">
            Sync complete — {syncResult.synced} item{syncResult.synced !== 1 ? 's' : ''} uploaded
          </span>
        </div>
      )}

      {/* Loading */}
      {state.status === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="size-8 animate-spin text-blue-400" />
          <p className="text-sm text-white/60">Validating capture link...</p>
        </div>
      )}

      {/* Invalid token */}
      {state.status === 'invalid' && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-6 py-12">
          <AlertCircle className="size-10 text-red-400" />
          <h2 className="text-lg font-semibold text-red-300">Invalid or expired capture link</h2>
          <p className="text-center text-sm text-white/50">
            This link may have expired or been revoked. Please request a new capture link from your
            workshop administrator.
          </p>
        </div>
      )}

      {/* Ready — show session form */}
      {state.status === 'ready' && (
        <>
          <WorkshopHeader info={state.info} />
          {startError && (
            <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              <AlertCircle className="size-4 shrink-0" />
              {startError}
            </div>
          )}
          <CaptureSessionForm
            onSubmit={handleStartSession}
            domainPackConfig={state.info.domainPackConfig}
          />
        </>
      )}

      {/* Active session */}
      {state.status === 'session' && (
        <>
          <WorkshopHeader info={state.info} />
          <DesktopCaptureControls
            sessionId={state.sessionId}
            workshopId={state.info.workshopId ?? ''}
            captureToken={token}
            isLocalSession={state.isLocal}
            onSessionComplete={() => {
              setSessionsRecorded((prev) => prev + 1);
              setState({ status: 'complete', info: state.info, segmentCount: 0 });
            }}
          />
        </>
      )}

      {/* Session complete */}
      {state.status === 'complete' && (
        <>
          <WorkshopHeader info={state.info} />
          <div className="flex flex-col items-center gap-5 rounded-lg border border-green-500/30 bg-green-500/10 px-6 py-12">
            <CheckCircle2 className="size-14 text-green-400" />
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-xl font-semibold text-green-300">Session Complete</h2>
              <p className="text-center text-sm text-white/60">
                {isOffline
                  ? 'Recording saved locally — it will be uploaded and analysed when you reconnect.'
                  : 'Your recording has been transcribed and is being analysed.'}
              </p>
            </div>
            <Badge variant="secondary" className="bg-green-500/20 text-sm text-green-300">
              {sessionsRecorded} {sessionsRecorded === 1 ? 'session' : 'sessions'} recorded
            </Badge>
            <button
              type="button"
              onClick={() => setState({ status: 'ready', info: state.info })}
              className="mt-2 w-full rounded-lg bg-white/10 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/20 active:bg-white/25"
            >
              Record Another
            </button>
            <p className="text-xs text-white/40">Close this tab when finished</p>
          </div>
        </>
      )}
    </div>
  );
}
