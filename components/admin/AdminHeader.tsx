'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function AdminHeader() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => {
        if (!r.ok) return null;
        return r.json();
      })
      .then(data => {
        if (!data) return;
        setLogoUrl(data.orgLogoUrl || null);
      })
      .catch(() => null);
  }, []);

  const src = logoUrl || process.env.NEXT_PUBLIC_PLATFORM_LOGO || null;
  if (!src) return null;

  return (
    <div className="no-print border-b bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3 flex items-center gap-3">
        <Link href="/admin" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Logo" className="h-8 w-auto" />
        </Link>
      </div>
    </div>
  );
}
