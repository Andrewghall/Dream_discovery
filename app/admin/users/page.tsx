import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Plus, UserCheck, UserX, Mail, Shield, Building, Users } from 'lucide-react';
import { getSession } from '@/lib/auth/session';

export default async function UsersPage() {
  const session = await getSession();

  if (!session || session.role === 'TENANT_USER') {
    redirect('/tenant/login');
  }

  const isPlatformAdmin = session.role === 'PLATFORM_ADMIN';
  const where = isPlatformAdmin ? {} : { organizationId: session.organizationId! };

  const users = await prisma.user.findMany({
    where,
    include: {
      organization: true,
      _count: {
        select: {
          loginAttempts: true,
          sessions: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Fetch seat usage for tenant admins
  let seatInfo: { used: number; max: number } | null = null;
  if (!isPlatformAdmin && session.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { maxSeats: true },
    });
    if (org) {
      seatInfo = { used: users.length, max: org.maxSeats };
    }
  }

  const stats = {
    total: users.length,
    active: users.filter(u => u.isActive).length,
    inactive: users.filter(u => !u.isActive).length,
    platformAdmins: users.filter(u => u.role === 'PLATFORM_ADMIN').length,
    tenantUsers: users.filter(u => u.role === 'TENANT_USER').length,
  };

  const roleColor = (role: string) => {
    if (role === 'PLATFORM_ADMIN') return 'bg-purple-100 text-purple-800';
    if (role === 'TENANT_ADMIN') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <Link href="/admin" className="text-indigo-600 hover:text-indigo-700 text-sm">← Back to Dashboard</Link>
            <h1 className="text-3xl font-bold text-gray-900 mt-4">User Management</h1>
            <p className="text-gray-600 mt-1">
              {isPlatformAdmin ? 'All users across all organizations' : 'Users in your organization'}
            </p>
          </div>
          <Link href="/admin/users/new">
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </Link>
        </div>

        {seatInfo && (
          <div className={`mb-6 rounded-lg border px-4 py-3 text-sm flex items-center gap-2 ${
            seatInfo.used >= seatInfo.max
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}>
            <Users className="h-4 w-4 flex-shrink-0" />
            <span>
              <strong>{seatInfo.used}</strong> of <strong>{seatInfo.max}</strong> licensed seats used
              {seatInfo.used >= seatInfo.max && ' — seat limit reached. Contact your account manager to add more seats.'}
            </span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Active</p>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Inactive</p>
            <p className="text-2xl font-bold text-gray-500">{stats.inactive}</p>
          </div>
          {isPlatformAdmin ? (
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Platform Admins</p>
              <p className="text-2xl font-bold text-purple-600">{stats.platformAdmins}</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600">Tenant Users</p>
              <p className="text-2xl font-bold text-blue-600">{stats.tenantUsers}</p>
            </div>
          )}
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">All Users</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  {isPlatformAdmin && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          <span className="text-indigo-600 font-medium text-sm">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColor(user.role)}`}>
                        {user.role === 'PLATFORM_ADMIN' ? (
                          <Shield className="h-3 w-3 mr-1" />
                        ) : (
                          <Building className="h-3 w-3 mr-1" />
                        )}
                        {user.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    {isPlatformAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.organization?.name || '—'}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <UserCheck className="h-3 w-3 mr-1" />Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          <UserX className="h-3 w-3 mr-1" />Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/users/${user.id}`}>
                          <Button variant="ghost" size="sm">Edit</Button>
                        </Link>
                        <form action="/api/admin/users/send-reset" method="POST">
                          <input type="hidden" name="userId" value={user.id} />
                          <Button variant="ghost" size="sm" type="submit" title="Send password reset">
                            <Mail className="h-4 w-4" />
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
