'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Building,
  Users,
  ShieldCheck,
  BarChart2,
  LogOut,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: string[];
}

const ADMIN_NAV: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: <LayoutDashboard className="h-4 w-4" />,
    roles: ['TENANT_ADMIN'],
  },
  {
    label: 'Platform',
    href: '/admin/platform',
    icon: <LayoutDashboard className="h-4 w-4" />,
    roles: ['PLATFORM_ADMIN'],
  },
  {
    label: 'Organizations',
    href: '/admin/organizations',
    icon: <Building className="h-4 w-4" />,
    roles: ['PLATFORM_ADMIN'],
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: <Users className="h-4 w-4" />,
    roles: ['TENANT_ADMIN'],
  },
  {
    label: 'Audit Logs',
    href: '/admin/audit-logs',
    icon: <ShieldCheck className="h-4 w-4" />,
    roles: ['PLATFORM_ADMIN', 'TENANT_ADMIN'],
  },
  {
    label: 'Analytics',
    href: '/admin/analytics',
    icon: <BarChart2 className="h-4 w-4" />,
    roles: ['PLATFORM_ADMIN', 'TENANT_ADMIN'],
  },
];

const TENANT_NAV: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/tenant/dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />,
    roles: ['TENANT_ADMIN', 'TENANT_USER'],
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: <Users className="h-4 w-4" />,
    roles: ['TENANT_ADMIN'],
  },
];

interface AdminHeaderProps {
  section: 'admin' | 'tenant';
}

export function AdminHeader({ section }: AdminHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgPrimaryColor, setOrgPrimaryColor] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

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
        setOrgPrimaryColor(data.orgPrimaryColor || null);
        setRole(data.role || null);
      })
      .catch(() => null);
  }, []);

  const handleLogout = async () => {
    if (section === 'admin') {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/dream');
    } else {
      await fetch('/api/auth/tenant-logout', { method: 'POST' });
      router.push('/dream');
    }
  };

  const navItems = section === 'admin' ? ADMIN_NAV : TENANT_NAV;
  const dashboardHref = section === 'admin'
    ? (role === 'PLATFORM_ADMIN' ? '/admin/platform' : '/admin')
    : '/tenant/dashboard';
  const src = logoUrl || process.env.NEXT_PUBLIC_PLATFORM_LOGO || null;

  // Hide header on workshop sub-pages — sidebar handles navigation there
  const isWorkshopPage = /^\/admin\/workshops\/[^/]+\/.+/.test(pathname) || /^\/admin\/workshops\/[^/]+$/.test(pathname);
  if (isWorkshopPage) return null;

  const visibleNavItems = role
    ? navItems.filter(item => item.roles.includes(role))
    : [];

  const isActive = (href: string) => {
    if (href === '/admin' && section === 'admin') return pathname === '/admin';
    if (href === '/tenant/dashboard' && section === 'tenant') return pathname === '/tenant/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <header
      className="no-print sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={orgPrimaryColor
        ? { borderBottomColor: orgPrimaryColor, borderBottomWidth: '3px' }
        : undefined}
    >
      <div className="container mx-auto flex items-center justify-between px-4">
        {/* Left: Logo */}
        <Link
          href={dashboardHref}
          className="flex-shrink-0 inline-flex items-center hover:opacity-80 transition-opacity py-2"
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={orgName || 'Logo'}
              className="w-[200px] h-auto max-h-20 object-contain"
            />
          ) : (
            <span className="text-xl font-bold">{orgName || 'DREAM Discovery'}</span>
          )}
        </Link>

        {/* Right: Nav items */}
        <nav className="flex items-center gap-1">
          {visibleNavItems.map(item => (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive(item.href) ? 'secondary' : 'ghost'}
                size="default"
                className="gap-2"
              >
                {item.icon}
                {item.label}
              </Button>
            </Link>
          ))}

          <Button
            variant="ghost"
            size="default"
            onClick={handleLogout}
            className="gap-2 ml-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </nav>
      </div>
    </header>
  );
}
