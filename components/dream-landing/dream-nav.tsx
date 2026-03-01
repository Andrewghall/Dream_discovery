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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/50'
          : 'bg-transparent'
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
            className={`transition-all duration-300 ${scrolled ? '' : 'brightness-0 invert'}`}
          />
        </Link>

        {/* Centre links — hidden on mobile */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                scrolled
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Sign In */}
        <Link
          href="/login"
          className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
            scrolled
              ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-sm hover:from-teal-400 hover:to-cyan-400'
              : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'
          }`}
        >
          Sign In
        </Link>
      </div>
    </nav>
  );
}
