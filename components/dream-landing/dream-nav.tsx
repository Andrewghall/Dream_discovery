'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu, X } from 'lucide-react';

interface NavChild {
  href: string;
  label: string;
  featured?: boolean;
}

interface NavGroup {
  group: string;
  items: NavChild[];
}

interface NavLink {
  href?: string;
  label: string;
  children?: NavGroup[];
}

const NAV_LINKS: NavLink[] = [
  { href: '/dream/technology', label: 'Technology' },
  { href: '/dream/methodology', label: 'Methodology' },
  { href: '/dream/insights', label: 'Insights' },
  { href: '/dream/how-it-works', label: 'How It Works' },
  {
    label: 'Solutions',
    children: [
      {
        group: 'Industries',
        items: [
          { href: '/dream/industries', label: 'All Industries' },
          { href: '/dream/industries/financial-services', label: 'Financial Services' },
          { href: '/dream/industries/healthcare', label: 'Healthcare' },
          { href: '/dream/industries/government', label: 'Government & Public Sector' },
          { href: '/dream/industries/retail', label: 'Retail & Consumer' },
          { href: '/dream/industries/technology-sector', label: 'Technology' },
          { href: '/dream/industries/professional-services', label: 'Professional Services' },
        ],
      },
      {
        group: 'Use Cases',
        items: [
          { href: '/dream/use-cases', label: 'All Use Cases' },
          { href: '/dream/use-cases/enterprise-ai-adoption', label: 'Enterprise AI Adoption', featured: true },
        ],
      },
    ],
  },
];

export function DreamNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSolutionsOpen, setMobileSolutionsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
    setMobileSolutionsOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

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

        {/* Desktop nav links */}
        <div className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map((link) =>
            link.href ? (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive(link.href)
                    ? 'text-[#0d0d0d] bg-slate-100'
                    : 'text-slate-600 hover:text-[#0d0d0d] hover:bg-slate-50'
                }`}
              >
                {link.label}
              </Link>
            ) : (
              /* Dropdown for Solutions */
              <div key={link.label} className="relative group">
                <button
                  className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    pathname.startsWith('/dream/industries') || pathname.startsWith('/dream/use-cases')
                      ? 'text-[#0d0d0d] bg-slate-100'
                      : 'text-slate-600 hover:text-[#0d0d0d] hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
                </button>

                {/* Dropdown panel */}
                <div className="absolute top-full left-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-4 min-w-[280px]">
                    {link.children?.map((group, gi) => (
                      <div key={group.group} className={gi > 0 ? 'mt-3 pt-3 border-t border-slate-100' : ''}>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
                          {group.group}
                        </p>
                        {group.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-lg transition-colors ${
                              isActive(item.href)
                                ? 'text-[#0d0d0d] bg-slate-100 font-medium'
                                : 'text-slate-600 hover:text-[#0d0d0d] hover:bg-slate-50'
                            }`}
                          >
                            {item.label}
                            {item.featured && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#5cf28e]/20 text-[#33824d]">
                                New
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ),
          )}
        </div>

        {/* Right side: Book a Demo + Sign In */}
        <div className="hidden lg:flex items-center gap-3">
          <a
            href="mailto:hello@ethenta.com?subject=DREAM%20Demo%20Request"
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#5cf28e] text-[#0d0d0d] hover:bg-[#50c878] transition-all shadow-sm"
          >
            Book a Demo
          </a>
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-all border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Sign In
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-slate-100 shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-4 space-y-1">
            {NAV_LINKS.map((link) =>
              link.href ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    isActive(link.href)
                      ? 'text-[#0d0d0d] bg-slate-100'
                      : 'text-slate-600 hover:text-[#0d0d0d] hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                </Link>
              ) : (
                <div key={link.label}>
                  <button
                    onClick={() => setMobileSolutionsOpen(!mobileSolutionsOpen)}
                    className={`flex items-center justify-between w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      pathname.startsWith('/dream/industries') || pathname.startsWith('/dream/use-cases')
                        ? 'text-[#0d0d0d] bg-slate-100'
                        : 'text-slate-600 hover:text-[#0d0d0d] hover:bg-slate-50'
                    }`}
                  >
                    {link.label}
                    <ChevronDown className={`h-4 w-4 transition-transform ${mobileSolutionsOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {mobileSolutionsOpen && (
                    <div className="ml-3 mt-1 space-y-1">
                      {link.children?.map((group) => (
                        <div key={group.group}>
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-3 mb-1 px-3">
                            {group.group}
                          </p>
                          {group.items.map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`block px-3 py-2 text-sm rounded-lg transition-colors ${
                                isActive(item.href)
                                  ? 'text-[#0d0d0d] bg-slate-100 font-medium'
                                  : 'text-slate-500 hover:text-[#0d0d0d] hover:bg-slate-50'
                              }`}
                            >
                              {item.label}
                            </Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}

            <div className="pt-3 mt-3 border-t border-slate-100 space-y-2">
              <a
                href="mailto:hello@ethenta.com?subject=DREAM%20Demo%20Request"
                className="block text-center px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#5cf28e] text-[#0d0d0d] hover:bg-[#50c878] transition-all"
              >
                Book a Demo
              </a>
              <Link
                href="/login"
                className="block text-center px-4 py-2.5 text-sm font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
