'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Settings,
  FileText,
  Radio,
  Globe,
  BookOpen,
  Compass,
  Send,
  Menu,
  X,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Brain,
  BarChart2,
} from 'lucide-react';

interface WorkshopSidebarProps {
  workshopId: string;
  workshopName: string;
  domainPack?: string | null;
}

function buildNavSections(_domainPack?: string | null) {
  return [
    {
      label: 'Workflow',
      items: [
        { label: 'Setup', path: '', icon: Settings },
        { label: 'Prep', path: '/prep', icon: FileText },
        { label: 'Invite', path: '/invite', icon: Send },
        { label: 'Live Session', path: '/cognitive-guidance', icon: Radio },
        { label: 'Field Discovery', path: '/discovery/field', icon: Compass },
      ],
    },
    {
      label: 'Output Analysis',
      items: [
        { label: 'Insight Map', path: '/hemisphere', icon: Globe },
        { label: 'Synthesised Output', path: '/intelligence', icon: Brain },
        { label: 'Discovery Output', path: '/discovery-output', icon: BarChart2 },
        { label: 'Download Report', path: '/scratchpad', icon: BookOpen },
      ],
    },
  ];
}

export function WorkshopSidebar({ workshopId, workshopName, domainPack }: WorkshopSidebarProps) {
  const pathname = usePathname();
  const basePath = `/admin/workshops/${workshopId}`;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const navSections = buildNavSections(domainPack);

  const isActive = (itemPath: string) => {
    const fullPath = `${basePath}${itemPath}`;
    if (itemPath === '') {
      // Setup page - exact match only
      return pathname === basePath || pathname === `${basePath}/`;
    }
    if (itemPath === '/discovery') {
      // Discovery - exact match to avoid matching /discovery/field
      return pathname === fullPath || pathname === `${fullPath}/`;
    }
    return pathname.startsWith(fullPath);
  };

  // ── Full (expanded) sidebar content ────────────────────
  const expandedSidebar = (
    <nav className="flex flex-col h-full bg-card border-r">
      {/* Back + Workshop name header */}
      <div className="p-4 border-b">
        <Link
          href="/admin"
          onClick={() => setMobileOpen(false)}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ChevronLeft className="h-3 w-3" />
          All Workshops
        </Link>
        <h2 className="text-sm font-semibold truncate" title={workshopName}>
          {workshopName}
        </h2>
      </div>

      {/* Nav sections */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold text-muted-foreground/70 tracking-wide">
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

      {/* Bottom: collapse toggle + logout */}
      <div className="p-3 border-t space-y-1">
        <button
          onClick={() => setCollapsed(true)}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          title="Collapse sidebar"
        >
          <ChevronsLeft className="h-4 w-4" />
          Collapse
        </button>
        <Link
          href="/dream"
          onClick={async (e) => {
            e.preventDefault();
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/dream';
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Link>
      </div>
    </nav>
  );

  // ── Collapsed sidebar - icons only with tooltips ───────
  const collapsedSidebar = (
    <nav className="flex flex-col h-full bg-card border-r items-center">
      {/* Back arrow */}
      <div className="py-4 border-b w-full flex justify-center">
        <Link
          href="/admin"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          title="All Workshops"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </div>

      {/* Nav icons */}
      <div className="flex-1 overflow-y-auto py-3 px-1.5 space-y-1 w-full">
        {navSections.flatMap((section) =>
          section.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                href={`${basePath}${item.path}`}
                className={`flex items-center justify-center p-2 rounded-md transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                }`}
                title={item.label}
              >
                <Icon className="h-4 w-4" />
              </Link>
            );
          }),
        )}
      </div>

      {/* Bottom: expand toggle + logout */}
      <div className="py-3 px-1.5 border-t space-y-1 w-full">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-center w-full p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          title="Expand sidebar"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
        <Link
          href="/dream"
          onClick={async (e) => {
            e.preventDefault();
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/dream';
          }}
          className="flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
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

      {/* Mobile sidebar (slide-over - always expanded) */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 z-40 w-56 transform transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {expandedSidebar}
      </aside>

      {/* Desktop sidebar - collapsible */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-200 ${
          collapsed ? 'w-12' : 'w-56'
        }`}
      >
        {collapsed ? collapsedSidebar : expandedSidebar}
      </aside>
    </>
  );
}
