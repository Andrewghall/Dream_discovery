'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building, Users, ShieldCheck, Activity, LogIn } from 'lucide-react';

interface Organisation {
  id: string;
  name: string;
  logoUrl: string | null;
  adminName: string | null;
  billingEmail: string | null;
}

interface AuditLog {
  id: string;
  type: string;
  action: string;
  resource: string;
  success: boolean;
  email: string;
  timestamp: string;
  details: Record<string, unknown> | null;
}

const NAV_CARDS = [
  {
    title: 'Organisations',
    description: 'Manage tenants, configure branding, and set organisation-level settings.',
    href: '/admin/organizations',
    icon: Building,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
  },
  {
    title: 'Users',
    description: 'View platform users, manage roles, and handle account access.',
    href: '/admin/users',
    icon: Users,
    color: 'text-violet-600',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
  },
  {
    title: 'Audit Logs',
    description: 'Review a full trail of security events and administrative actions.',
    href: '/admin/audit-logs',
    icon: ShieldCheck,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  {
    title: 'Sessions',
    description: 'Monitor active and historical platform sessions.',
    href: '/admin/sessions',
    icon: Activity,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
  },
];

export default function PlatformAdminPage() {
  const router = useRouter();
  const [userName, setUserName] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [enteringOrgId, setEnteringOrgId] = useState<string | null>(null);

  const handleEnterWorkspace = async (orgId: string) => {
    setEnteringOrgId(orgId);
    try {
      const res = await fetch('/api/admin/platform/enter-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      });
      if (!res.ok) {
        console.error('[enter-org] failed', await res.text());
        return;
      }
      // Hard navigate so the new session cookie is picked up
      window.location.href = '/admin';
    } catch (err) {
      console.error('[enter-org]', err);
    } finally {
      setEnteringOrgId(null);
    }
  };

  useEffect(() => {
    // Guard: only PLATFORM_ADMIN should be here
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => {
        if (r.status === 401) { router.push('/login'); return null; }
        return r.json();
      })
      .then(data => {
        if (!data) return;
        if (data.role !== 'PLATFORM_ADMIN') {
          // Tenant users have no business on this page
          router.push('/admin');
          return;
        }
        setUserName(data.name || null);
      })
      .catch(() => null);

    // Fetch organisations for the workspace switcher
    fetch('/api/admin/organizations', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (data) setOrganisations(data.organizations || []); })
      .catch(() => null);

    // Recent audit logs
    fetch('/api/admin/audit-logs?limit=15', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data) setAuditLogs(data.logs || []);
      })
      .catch(() => null)
      .finally(() => setLogsLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tight">Platform Administration</h1>
            <Badge variant="outline" className="text-xs">Platform Admin</Badge>
          </div>
          <p className="text-muted-foreground">
            {userName ? `Welcome, ${userName}. ` : ''}
            This console is for platform-level operations only. Workshop content is managed by each tenant.
          </p>
        </div>

        {/* Navigation cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {NAV_CARDS.map(card => {
            const Icon = card.icon;
            return (
              <Link key={card.href} href={card.href}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer border-border/60">
                  <CardHeader className="pb-2">
                    <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
                      <Icon className={`h-5 w-5 ${card.color}`} />
                    </div>
                    <CardTitle className="text-base">{card.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">
                      {card.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Client workspace access */}
        {organisations.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <LogIn className="h-4 w-4" />
                Enter Client Workspace
              </CardTitle>
              <CardDescription>
                Access a client's workspace to provide support. Your session will be scoped to their organisation.
                Navigate back to <strong>/admin/platform</strong> to return to platform admin view.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {organisations.map(org => (
                  <div key={org.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium">{org.name}</p>
                      {org.adminName && (
                        <p className="text-xs text-muted-foreground">{org.adminName}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={enteringOrgId === org.id}
                      onClick={() => handleEnterWorkspace(org.id)}
                    >
                      <LogIn className="h-3.5 w-3.5 mr-1.5" />
                      {enteringOrgId === org.id ? 'Entering…' : 'Enter'}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest platform security events and administrative actions</CardDescription>
              </div>
              <Link href="/admin/audit-logs">
                <button className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors">
                  View all logs
                </button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="text-sm text-muted-foreground py-4 text-center">Loading activity…</div>
            ) : auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="pb-2 pr-4 font-medium">Time</th>
                      <th className="pb-2 pr-4 font-medium">Action</th>
                      <th className="pb-2 pr-4 font-medium">User</th>
                      <th className="pb-2 pr-4 font-medium">Resource</th>
                      <th className="pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {auditLogs.map(log => (
                      <tr key={`${log.type}-${log.id}`} className="hover:bg-muted/30">
                        <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString(undefined, {
                            month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2 pr-4 whitespace-nowrap font-mono text-xs">{log.action}</td>
                        <td className="py-2 pr-4 text-muted-foreground max-w-[160px] truncate">{log.email}</td>
                        <td className="py-2 pr-4 text-muted-foreground text-xs max-w-[120px] truncate">{log.resource}</td>
                        <td className="py-2">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                            log.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {log.success ? 'OK' : 'Fail'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
