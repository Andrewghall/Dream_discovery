'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function AdminHeader() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => {
        if (!r.ok) return null;
        return r.json();
      })
      .then(data => {
        if (!data) return;
        setLogoUrl(data.orgLogoUrl || null);
        setOrgName(data.orgName || null);
      })
      .catch(() => null);
  }, []);

  const src = logoUrl || process.env.NEXT_PUBLIC_PLATFORM_LOGO || null;
  if (!src) return null;

  return (
    <div className="no-print">
      <div className="container mx-auto px-4 py-6 flex justify-center">
        <Link href="/admin" className="inline-flex items-center hover:opacity-80 transition-opacity">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={orgName || 'Logo'} className="h-[120px] w-auto max-w-[400px] object-contain" />
        </Link>
      </div>
    </div>
  );
}
