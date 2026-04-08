'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

const NAV = [
  { label: 'Dashboard',  href: '/executive/dashboard' },
  { label: 'Insights',   href: '/executive/insights'  },
  { label: 'Roadmap',    href: '/executive/roadmap'   },
  { label: 'Evidence',   href: '/executive/evidence'  },
  { label: 'Ask DREAM',  href: '/executive/ask'       },
];

interface ExecNavbarProps {
  name: string;
  orgName: string;
}

export function ExecNavbar({ name, orgName }: ExecNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/executive/logout', { method: 'POST' });
    } finally {
      router.push('/executive');
    }
  };

  return (
    <header className="border-b border-white/[0.07] bg-[#0a0a0a]/90 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-14 flex items-center gap-6">
        {/* Logo */}
        <Link href="/executive/dashboard" className="flex-shrink-0">
          <img src="/ethenta-logo.png" alt="DREAM" style={{ height: 16, opacity: 0.7, filter: 'invert(1) brightness(0.9)' }} />
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-1 flex-1">
          {NAV.map(item => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? 'text-[#5cf28e] bg-[#5cf28e]/10'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: identity + logout */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-white/60 leading-none">{name}</p>
            <p className="text-[10px] text-white/25 leading-none mt-0.5">{orgName}</p>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-[11px] text-white/25 hover:text-white/50 transition-colors disabled:opacity-40"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
