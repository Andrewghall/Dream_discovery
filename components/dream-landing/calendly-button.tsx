'use client';

import { useCallback } from 'react';

/**
 * Calendly Popup Button
 *
 * Renders a `<button>` that opens the Calendly popup widget on click.
 * URL comes from `NEXT_PUBLIC_CALENDLY_URL` env var  -  nothing hard-coded.
 *
 * Gracefully degrades:
 *  1. If env var is empty → falls back to mailto:Andrew.Hall@ethenta.com
 *  2. If widget script fails to load → opens Calendly URL in a new tab
 */

const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || '';

declare global {
  interface Window {
    Calendly?: {
      initPopupWidget: (opts: { url: string }) => void;
    };
  }
}

/* ── Singleton script loader ─────────────────────────────── */

let loadState: 'idle' | 'loading' | 'loaded' | 'error' = 'idle';
const waiters: (() => void)[] = [];

function loadCalendlyAssets(): Promise<void> {
  if (loadState === 'loaded') return Promise.resolve();
  if (loadState === 'error') return Promise.resolve(); // fallback path

  if (loadState === 'loading') {
    return new Promise((resolve) => {
      waiters.push(resolve);
    });
  }

  loadState = 'loading';

  return new Promise((resolve) => {
    // CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://assets.calendly.com/assets/external/widget.css';
    document.head.appendChild(link);

    // JS
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    script.onload = () => {
      loadState = 'loaded';
      resolve();
      waiters.forEach((w) => w());
      waiters.length = 0;
    };
    script.onerror = () => {
      loadState = 'error';
      resolve();
      waiters.forEach((w) => w());
      waiters.length = 0;
    };
    document.head.appendChild(script);
  });
}

/* ── Component ───────────────────────────────────────────── */

interface CalendlyButtonProps {
  className?: string;
  children: React.ReactNode;
}

export function CalendlyButton({ className, children }: CalendlyButtonProps) {
  const handleClick = useCallback(async () => {
    if (!CALENDLY_URL) {
      window.location.href =
        'mailto:Andrew.Hall@ethenta.com?subject=DREAM%20Demo%20Request';
      return;
    }

    await loadCalendlyAssets();

    if (window.Calendly) {
      window.Calendly.initPopupWidget({ url: CALENDLY_URL });
    } else {
      // Widget failed to load  -  open in new tab as fallback
      window.open(CALENDLY_URL, '_blank', 'noopener,noreferrer');
    }
  }, []);

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
