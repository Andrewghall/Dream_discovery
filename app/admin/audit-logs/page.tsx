import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Filter } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { getSession } from '@/lib/auth/session';
import { ClearLogsButton } from './clear-logs-button';

export default async function AuditLogsPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const isPlatformAdmin = session.role === 'PLATFORM_ADMIN';
  const isTenantAdmin = session.role === 'TENANT_ADMIN';

  // Scope queries: platform admins see everything, tenant admins see their org only
  const auditWhere = isPlatformAdmin ? {} : { userEmail: session.email };
  const loginWhere = isPlatformAdmin ? {} : { email: session.email };

  // Fetch audit logs and login attempts in parallel
  const [auditLogs, loginAttempts] = await Promise.all([
    prisma.auditLog.findMany({
      where: auditWhere,
      take: 100,
      orderBy: { timestamp: 'desc' },
    }),
    prisma.loginAttempt.findMany({
      where: loginWhere,
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
    }),
  ]);

  // Combine and sort by date
  const allLogs = [
    ...auditLogs.map((log) => ({
      id: log.id,
      type: 'AUDIT' as const,
      action: log.action,
      resource: log.resourceType ? `${log.resourceType}${log.resourceId ? `:${log.resourceId}` : ''}` : '—',
      success: log.success,
      email: log.userEmail || 'System',
      userName: log.userEmail || 'System',
      details: log.metadata as Record<string, unknown> | null,
      ipAddress: log.ipAddress || '—',
      timestamp: log.timestamp,
    })),
    ...loginAttempts.map((attempt) => ({
      id: attempt.id,
      type: 'LOGIN' as const,
      action: attempt.success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
      resource: 'Authentication',
      success: attempt.success,
      email: attempt.email,
      userName: attempt.user?.name || attempt.email,
      details: attempt.failureReason ? { failureReason: attempt.failureReason } : null,
      ipAddress: attempt.ipAddress || '—',
      timestamp: attempt.createdAt,
    })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
              <p className="text-gray-600 mt-1">
                Complete audit trail of all security events and user actions
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            {isPlatformAdmin && <ClearLogsButton />}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <p className="text-sm text-gray-600">Total Events</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{allLogs.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600">Login Attempts</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{loginAttempts.length}</p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600">Failed Logins</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {loginAttempts.filter((a) => !a.success).length}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-sm text-gray-600">Audit Events</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{auditLogs.length}</p>
          </Card>
        </div>

        {/* Logs Table */}
        <Card>
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Events (Last 100 per type)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {allLogs.map((log) => (
                  <tr key={`${log.type}-${log.id}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.timestamp.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        log.type === 'LOGIN' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{log.userName}</div>
                      <div className="text-xs text-gray-500">{log.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.resource}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        log.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {log.success ? 'Success' : 'Failed'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {log.details
                        ? (log.details.failureReason as string || JSON.stringify(log.details).slice(0, 80))
                        : log.ipAddress}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="mt-6 text-sm text-gray-600">
          <p>
            <strong>Note:</strong> Audit logs are retained for compliance purposes. Events include
            login attempts, user modifications, and system events.
          </p>
          <p className="mt-2">
            For GDPR compliance, user-specific logs can be exported via the data export API.
          </p>
        </div>
      </div>
    </div>
  );
}
