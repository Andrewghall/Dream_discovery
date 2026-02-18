'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useAutoSave(
  version: number,
  saveFn: () => Promise<void>,
  debounceMs: number = 2000
): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  useEffect(() => {
    // Skip the initial render — don't save on page load
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (version === 0) return;

    // Clear pending timeout
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setStatus('saving');

    timeoutRef.current = setTimeout(async () => {
      try {
        await saveFnRef.current();
        setStatus('saved');
        setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 3000);
      } catch (err) {
        console.error('[useAutoSave] Save failed:', err);
        setStatus('error');
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [version, debounceMs]);

  return status;
}
