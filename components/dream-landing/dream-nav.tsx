'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const NAV_LINKS = [
  { href: '#ethentaflow', label: 'Technology' },
  { href: '#methodology', label: 'Methodology' },
  { href: '#insights', label: 'Insights' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#ask-dream', label: 'Ask DREAM' },
];

export function DreamNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white ${
        scrolled ? 'shadow-sm border-b border-slate-200/50' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/dream" className="flex-shrink-0">
          <Image
            src="/ethenta-logo.png"
            alt="Ethenta"
            width={130}
            height={38}
            priority
          />
        </Link>

        {/* Centre links — hidden on mobile */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-3 py-2 text-sm font-medium rounded-lg transition-colors text-slate-600 hover:text-[#0d0d0d] hover:bg-slate-50"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Sign In */}
        <Link
          href="/login"
          className="px-5 py-2 text-sm font-semibold rounded-lg transition-all bg-[#0d0d0d] text-white hover:bg-[#333] shadow-sm"
        >
          Sign In
        </Link>
      </div>
    </nav>
  );
}
