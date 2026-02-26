import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, Download, Eye } from 'lucide-react';

export default async function TenantWorkshopDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();

  if (!session || !session.organizationId) {
    redirect('/tenant/login');
  }

  // Await params (Next.js 15 requirement)
  const { id: workshopId } = await params;

  // Set organization context for RLS
  await prisma.$executeRawUnsafe(
    `SET LOCAL app.current_org_id = '${session.organizationId.replace(/'/g, "''")}'`
  );

  // Fetch workshop - RLS will ensure it belongs to this organization
  const workshop = await prisma.workshop.findUnique({
    where: {
      id: workshopId,
    },
    include: {
      participants: {
        orderBy: {
          createdAt: 'desc',
        },
      },
      scratchpad: true,
      organization: true,
    },
  });

  if (!workshop) {
    redirect('/tenant/dashboard');
  }

  // Verify it belongs to the tenant's organization
  if (workshop.organizationId !== session.organizationId) {
    redirect('/tenant/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/tenant/dashboard">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {workshop.name}
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  {workshop.organization.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{session.email}</span>
              <form action="/api/auth/tenant-logout" method="POST">
                <Button variant="outline" size="sm" type="submit">
                  Logout
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Workshop Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Workshop Details
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        workshop.status === 'COMPLETED'
                          ? 'bg-green-100 text-green-800'
                          : workshop.status === 'IN_PROGRESS'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {workshop.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {workshop.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Description</label>
                    <p className="mt-1 text-sm text-gray-900">{workshop.description}</p>
                  </div>
                )}

                {workshop.businessContext && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Business Context</label>
                    <p className="mt-1 text-sm text-gray-900">{workshop.businessContext}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-700">Workshop Type</label>
                  <p className="mt-1 text-sm text-gray-900 capitalize">
                    {workshop.workshopType.toLowerCase()}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Created</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(workshop.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Scratchpad Access */}
            {workshop.scratchpad && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Workshop Output
                </h2>
                <div className="flex gap-4">
                  <Link href={`/admin/workshops/${workshop.id}/scratchpad`}>
                    <Button className="btn-org-primary">
                      <Eye className="h-4 w-4 mr-2" />
                      View Scratchpad
                    </Button>
                  </Link>
                  <a href={`/api/admin/workshops/${workshop.id}/export-html`} download>
                    <Button variant="outline" className="btn-org-secondary-outline">
                      <Download className="h-4 w-4 mr-2" />
                      Download for Client
                    </Button>
                  </a>
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  Download a white-labeled HTML package to share with your client
                </p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Participants */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Participants
                </h2>
                <span className="text-sm text-gray-600">
                  {workshop.participants.length} total
                </span>
              </div>

              {workshop.participants.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">No participants yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {workshop.participants.map((participant) => (
                    <div
                      key={participant.id}
                      className="border border-gray-200 rounded-lg p-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {participant.name}
                          </p>
                          <p className="text-xs text-gray-600">{participant.email}</p>
                          {participant.role && (
                            <p className="text-xs text-gray-500 mt-1">
                              {participant.role}
                            </p>
                          )}
                        </div>
                        <div>
                          {participant.responseCompletedAt ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Completed
                            </span>
                          ) : participant.responseStartedAt ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              In Progress
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              Pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Quick Actions
              </h2>
              <div className="space-y-3">
                <Link href={`/admin/workshops/${workshop.id}/participants`}>
                  <Button variant="outline" className="w-full justify-start">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Participants
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
