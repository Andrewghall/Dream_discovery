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
    roles: ['PLATFORM_ADMIN', 'TENANT_ADMIN'],
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
        setRole(data.role || null);
      })
      .catch(() => null);
  }, []);

  const handleLogout = async () => {
    if (section === 'admin') {
      await fetch('/api/auth/logout');
      router.push('/login');
    } else {
      await fetch('/api/auth/tenant-logout', { method: 'POST' });
      router.push('/login');
    }
  };

  const navItems = section === 'admin' ? ADMIN_NAV : TENANT_NAV;
  const dashboardHref = section === 'admin' ? '/admin' : '/tenant/dashboard';
  const src = logoUrl || process.env.NEXT_PUBLIC_PLATFORM_LOGO || null;

  const visibleNavItems = role
    ? navItems.filter(item => item.roles.includes(role))
    : [];

  const isActive = (href: string) => {
    if (href === '/admin' && section === 'admin') return pathname === '/admin';
    if (href === '/tenant/dashboard' && section === 'tenant') return pathname === '/tenant/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <header className="no-print sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
              className="max-h-16 w-auto max-w-[250px] object-contain"
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
