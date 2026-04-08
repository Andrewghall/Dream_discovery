'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Menu, X } from 'lucide-react';
import { CalendlyButton } from './calendly-button';

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
  { href: '/dream/compare', label: 'Compare' },
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

  // Close mobile menu on navigation — intentional synchronous reset on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileSolutionsOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <nav
      aria-label="Main navigation"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white ${
        scrolled ? 'shadow-sm border-b border-slate-200/50' : ''
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Mobile hamburger — left side */}
        <button
          className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        {/* Logo */}
        <Link href="/dream" className="flex-shrink-0 lg:mr-6">
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

        {/* Right side: Experience + WhatsApp + Book a Demo + Sign In */}
        <div className="hidden lg:flex items-center gap-3">
          <a
            href="/experience"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg text-[#5cf28e] border border-[#5cf28e]/25 bg-[#5cf28e]/5 hover:bg-[#5cf28e]/15 transition-all"
          >
            <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3 shrink-0">
              <path d="M2 1.5a.5.5 0 0 1 .8-.4l7 4.5a.5.5 0 0 1 0 .8l-7 4.5A.5.5 0 0 1 2 10.5v-9Z"/>
            </svg>
            The DREAM Story
          </a>
          <a
            href="https://wa.me/447471944765"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg text-slate-600 hover:text-[#25D366] hover:bg-slate-50 transition-all"
            title="Chat on WhatsApp"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[#25D366]">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </a>
          <CalendlyButton
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#5cf28e] text-[#0d0d0d] hover:bg-[#50c878] transition-all shadow-sm cursor-pointer"
          >
            Book a Demo
          </CalendlyButton>
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-semibold rounded-lg transition-all border border-slate-200 text-slate-700 hover:bg-slate-50"
          >
            Sign In
          </Link>
        </div>

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
                href="/experience"
                className="block text-center px-4 py-2.5 text-sm font-semibold rounded-lg border border-[#5cf28e]/30 text-[#33824d] hover:bg-[#5cf28e]/10 transition-all"
              >
                The DREAM Story
              </a>
              <CalendlyButton
                className="block w-full text-center px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#5cf28e] text-[#0d0d0d] hover:bg-[#50c878] transition-all cursor-pointer"
              >
                Book a Demo
              </CalendlyButton>
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
