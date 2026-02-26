'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Settings,
  FileText,
  Radio,
  Search,
  Globe,
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Menu,
  X,
  ChevronLeft,
} from 'lucide-react';

interface WorkshopSidebarProps {
  workshopId: string;
  workshopName: string;
}

const NAV_SECTIONS = [
  {
    label: 'WORKFLOW',
    items: [
      { label: 'Setup', path: '', icon: Settings },
      { label: 'Prep', path: '/prep', icon: FileText },
      { label: 'Live Session', path: '/cognitive-guidance', icon: Radio },
    ],
  },
  {
    label: 'ANALYSE',
    items: [
      { label: 'Discovery', path: '/discovery', icon: Search },
      { label: 'Hemisphere', path: '/hemisphere', icon: Globe },
      { label: 'Spider', path: '/spider', icon: BarChart3 },
    ],
  },
  {
    label: 'OUTPUT',
    items: [
      { label: 'Scratchpad', path: '/scratchpad', icon: BookOpen },
    ],
  },
];

export function WorkshopSidebar({ workshopId, workshopName }: WorkshopSidebarProps) {
  const pathname = usePathname();
  const basePath = `/admin/workshops/${workshopId}`;
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (itemPath: string) => {
    const fullPath = `${basePath}${itemPath}`;
    if (itemPath === '') {
      // Setup page — exact match only
      return pathname === basePath || pathname === `${basePath}/`;
    }
    return pathname.startsWith(fullPath);
  };

  const sidebar = (
    <nav className="flex flex-col h-full bg-card border-r">
      {/* Workshop name header */}
      <div className="p-4 border-b">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Workshop</p>
        <h2 className="text-sm font-semibold truncate mt-0.5" title={workshopName}>
          {workshopName}
        </h2>
      </div>

      {/* Nav sections */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    href={`${basePath}${item.path}`}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Back to dashboard */}
      <div className="p-3 border-t">
        <Link
          href="/admin"
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile hamburger toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-md bg-card border shadow-sm"
        aria-label="Toggle navigation"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar (slide-over) */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-40 w-56 transform transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebar}
      </aside>

      {/* Desktop sidebar (persistent) */}
      <aside className="hidden lg:block w-56 shrink-0">
        {sidebar}
      </aside>
    </>
  );
}
