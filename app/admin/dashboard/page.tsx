import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Building,
  Users,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
} from 'lucide-react';

export default async function AdminDashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const isPlatformAdmin = session.role === 'PLATFORM_ADMIN';
  const isTenantAdmin = session.role === 'TENANT_ADMIN';

  // Scope queries for tenant admins to their organization
  const orgFilter = !isPlatformAdmin && session.organizationId
    ? { organizationId: session.organizationId }
    : {};
  const userWhere = !isPlatformAdmin && session.organizationId
    ? { organizationId: session.organizationId }
    : {};

  // Get statistics
  const [
    totalOrganizations,
    totalWorkshops,
    totalParticipants,
    totalUsers,
    activeUsers,
    recentWorkshops,
    failedLogins,
    activeSessions,
  ] = await Promise.all([
    isPlatformAdmin ? prisma.organization.count() : Promise.resolve(1),
    prisma.workshop.count({ where: orgFilter }),
    prisma.workshopParticipant.count({
      where: !isPlatformAdmin && session.organizationId
        ? { workshop: { organizationId: session.organizationId } }
        : {},
    }),
    prisma.user.count({ where: userWhere }),
    prisma.user.count({ where: { isActive: true, ...userWhere } }),
    prisma.workshop.findMany({
      where: orgFilter,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        organization: true,
        _count: { select: { participants: true } },
      },
    }),
    prisma.loginAttempt.count({
      where: {
        success: false,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
        ...(isPlatformAdmin ? {} : { email: session.email }),
      },
    }),
    prisma.session.count({
      where: {
        expiresAt: { gt: new Date() },
        revokedAt: null,
        ...(!isPlatformAdmin && session.organizationId
          ? { user: { organizationId: session.organizationId } }
          : {}),
      },
    }),
  ]);

  const workshopsByStatus = await prisma.workshop.groupBy({
    by: ['status'],
    where: orgFilter,
    _count: true,
  });

  const stats = {
    organizations: totalOrganizations,
    workshops: totalWorkshops,
    participants: totalParticipants,
    users: { total: totalUsers, active: activeUsers },
    sessions: activeSessions,
    failedLogins24h: failedLogins,
    workshopsByStatus: {
      draft: workshopsByStatus.find((w) => w.status === 'DRAFT')?._count || 0,
      inProgress: workshopsByStatus.find((w) => w.status === 'IN_PROGRESS')?._count || 0,
      completed: workshopsByStatus.find((w) => w.status === 'COMPLETED')?._count || 0,
    },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Platform Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Welcome back, {session.email}
          </p>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Organizations</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.organizations}
                </p>
              </div>
              <Building className="h-12 w-12 text-indigo-600" />
            </div>
            <Link href="/admin/organizations" className="text-sm text-indigo-600 hover:text-indigo-700 mt-4 inline-block">
              View all →
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Workshops</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.workshops}
                </p>
              </div>
              <FileText className="h-12 w-12 text-blue-600" />
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <span className="text-gray-500">{stats.workshopsByStatus.draft} draft</span> ·{' '}
              <span className="text-blue-600">{stats.workshopsByStatus.inProgress} active</span> ·{' '}
              <span className="text-green-600">{stats.workshopsByStatus.completed} done</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Users</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.users.total}
                </p>
              </div>
              <Users className="h-12 w-12 text-green-600" />
            </div>
            <Link href="/admin/users" className="text-sm text-green-600 hover:text-green-700 mt-4 inline-block">
              {stats.users.active} active →
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Participants</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.participants}
                </p>
              </div>
              <TrendingUp className="h-12 w-12 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Security Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Security Status</h2>
              {stats.failedLogins24h > 10 ? (
                <AlertTriangle className="h-6 w-6 text-red-600" />
              ) : (
                <CheckCircle className="h-6 w-6 text-green-600" />
              )}
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Active Sessions</span>
                <Link href="/admin/sessions" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                  {stats.sessions} sessions →
                </Link>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Failed Logins (24h)</span>
                <span className={`text-sm font-medium ${
                  stats.failedLogins24h > 10 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {stats.failedLogins24h}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link href="/admin/users/new">
                <Button className="w-full justify-start" variant="outline">
                  <Users className="h-4 w-4 mr-2" />
                  Create New User
                </Button>
              </Link>
              <Link href="/admin/sessions">
                <Button className="w-full justify-start" variant="outline">
                  <Clock className="h-4 w-4 mr-2" />
                  View Active Sessions
                </Button>
              </Link>
              <Link href="/admin/audit-logs">
                <Button className="w-full justify-start" variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  View Audit Logs
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Workshops */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Workshops</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentWorkshops.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No workshops yet
              </div>
            ) : (
              recentWorkshops.map((workshop) => (
                <div key={workshop.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">
                        {workshop.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {workshop.organization.name} · {workshop._count.participants} participants
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        workshop.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-800'
                          : workshop.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {workshop.status.replace('_', ' ')}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(workshop.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
