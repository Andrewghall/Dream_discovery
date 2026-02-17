import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Button } from '@/components/ui/button';
import { Monitor, Smartphone, X } from 'lucide-react';

async function getAdminSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    return null;
  }

  try {
    const decoded = Buffer.from(sessionCookie.value, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export default async function ActiveSessionsPage() {
  const session = await getAdminSession();

  if (!session || session.role !== 'PLATFORM_ADMIN') {
    redirect('/login');
  }

  // Get all active sessions
  const sessions = await prisma.session.findMany({
    where: {
      expiresAt: {
        gt: new Date(),
      },
      revokedAt: null,
    },
    include: {
      user: {
        select: {
          email: true,
          name: true,
          role: true,
        },
      },
    },
    orderBy: {
      lastActivityAt: 'desc',
    },
  });

  const currentSessionId = session.sessionId;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Active Sessions</h1>
          <p className="text-gray-600 mt-2">
            Monitor and manage all active user sessions
          </p>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                All Active Sessions
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {sessions.length} active session{sessions.length !== 1 ? 's' : ''}
              </p>
            </div>
            <form action="/api/auth/logout-all" method="POST">
              <Button type="submit" variant="outline" className="text-red-600 border-red-600 hover:bg-red-50">
                Logout All Users
              </Button>
            </form>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <Monitor className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No active sessions
              </h3>
              <p className="text-gray-600">
                All users are logged out
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {sessions.map((s) => {
                const isCurrentSession = s.id === currentSessionId;
                const deviceIcon = s.userAgent?.toLowerCase().includes('mobile')
                  ? Smartphone
                  : Monitor;
                const DeviceIcon = deviceIcon;

                return (
                  <div key={s.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-4">
                        <DeviceIcon className="h-6 w-6 text-gray-400 mt-1" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">
                              {s.user.name} ({s.user.email})
                            </p>
                            {isCurrentSession && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Current Session
                              </span>
                            )}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              s.user.role === 'PLATFORM_ADMIN'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {s.user.role.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            IP: {s.ipAddress || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {s.userAgent || 'Unknown device'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Last active: {new Date(s.lastActivityAt).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            Expires: {new Date(s.expiresAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {!isCurrentSession && (
                        <form action={`/api/auth/revoke-session`} method="POST">
                          <input type="hidden" name="sessionId" value={s.id} />
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Revoke
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
