import type { Metadata, Viewport } from 'next';
import { Radio } from 'lucide-react';
import Script from 'next/script';

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'DREAM Field Capture',
  description: 'Mobile field capture for DREAM Discovery workshops',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'DREAM Capture',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#3b82f6',
};

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function CaptureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#1e293b] text-white">
      {/* --- Header --- */}
      <header className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Radio className="size-5 text-blue-400" />
        <h1 className="text-base font-semibold tracking-tight">
          DREAM Field Capture
        </h1>
      </header>

      {/* --- Main content --- */}
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6">
        {children}
      </main>

      {/* --- Service worker registration --- */}
      <Script
        id="sw-register"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function () {
                navigator.serviceWorker.register('/sw.js').then(
                  function (reg) {
                    console.log('[SW] Registered:', reg.scope);
                  },
                  function (err) {
                    console.warn('[SW] Registration failed:', err);
                  }
                );
              });
            }
          `,
        }}
      />
    </div>
  );
}
