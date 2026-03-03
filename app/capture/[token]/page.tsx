'use client';

import * as React from 'react';
import { use } from 'react';
import { CaptureSessionForm } from '@/components/field-discovery/capture-session-form';
import { DesktopCaptureControls } from '@/components/field-discovery/desktop-capture-controls';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2, WifiOff } from 'lucide-react';
import type { SessionFormData, DomainPack } from '@/components/field-discovery/capture-session-form';

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
  | { status: 'session'; info: TokenInfo; sessionId: string };

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

  // -------------------------------------------------------------------------
  // Online / offline detection
  // -------------------------------------------------------------------------

  React.useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
    }
    function handleOffline() {
      setIsOffline(true);
    }

    setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Validate token on mount
  // -------------------------------------------------------------------------

  React.useEffect(() => {
    let cancelled = false;

    async function validate() {
      try {
        const res = await fetch(`/api/capture-tokens/${token}`);
        if (!res.ok) {
          if (!cancelled) setState({ status: 'invalid' });
          return;
        }
        const data: TokenInfo = await res.json();
        if (!cancelled) {
          if (data.valid) {
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
    return () => {
      cancelled = true;
    };
  }, [token]);

  // -------------------------------------------------------------------------
  // Session creation handler
  // -------------------------------------------------------------------------

  async function handleStartSession(formData: SessionFormData) {
    if (state.status !== 'ready') return;

    try {
      const res = await fetch(
        `/api/admin/workshops/${state.info.workshopId}/capture-sessions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            deviceType: 'MOBILE',
          }),
        }
      );

      if (!res.ok) {
        console.error('Failed to create capture session');
        return;
      }

      const { session } = await res.json();
      setState({
        status: 'session',
        info: state.info,
        sessionId: session.id,
      });
    } catch (err) {
      console.error('Error creating capture session:', err);
    }
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
          <span className="text-sm font-medium text-yellow-300">Offline</span>
        </div>
      )}

      {/* Loading state */}
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
          <h2 className="text-lg font-semibold text-red-300">
            Invalid or expired capture link
          </h2>
          <p className="text-center text-sm text-white/50">
            This link may have expired or been revoked. Please request a new
            capture link from your workshop administrator.
          </p>
        </div>
      )}

      {/* Ready state - show form */}
      {state.status === 'ready' && (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">
              {state.info.workshopName || 'Workshop'}
            </h2>
            {state.info.domainPack && (
              <Badge variant="secondary" className="w-fit text-xs">
                {state.info.domainPack}
              </Badge>
            )}
          </div>

          <CaptureSessionForm
            onSubmit={handleStartSession}
            domainPackConfig={state.info.domainPackConfig}
          />
        </>
      )}

      {/* Active session - show capture controls */}
      {state.status === 'session' && (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">
              {state.info.workshopName || 'Workshop'}
            </h2>
            {state.info.domainPack && (
              <Badge variant="secondary" className="w-fit text-xs">
                {state.info.domainPack}
              </Badge>
            )}
          </div>

          <DesktopCaptureControls
            sessionId={state.sessionId}
            workshopId={state.info.workshopId!}
            onSessionComplete={() => {
              setState({ status: 'ready', info: state.info });
            }}
          />
        </>
      )}
    </div>
  );
}
